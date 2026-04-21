import {
  deepMerge,
  deleteBySegmentsDeep,
  getBySegments,
  isObject,
  normalizePath,
  setBySegmentsDeep,
  splitSegments,
} from "../models/realtime.model.js";
import {
  deleteRealtimePath,
  findExactRealtimeNode,
  findRealtimeNodesByCandidates,
  listRealtimeNodes,
  parseMysqlJson,
  upsertRealtimeNode,
} from "../repositories/realtime.repository.js";

async function getClosestAncestor(path) {
  const segments = splitSegments(path);
  const candidates = [];

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const candidate = segments.slice(0, index).join("/");
    if (candidate) {
      candidates.push(candidate);
    }
  }

  const rows = await findRealtimeNodesByCandidates(candidates);
  if (!rows.length) {
    return null;
  }

  rows.sort((left, right) => right.path.length - left.path.length);
  const best = rows[0];
  return {
    path: best.path,
    value: parseMysqlJson(best.value),
    remainingSegments: splitSegments(path.slice(best.path.length + 1)),
  };
}

export async function getRealtimeValue(inputPath) {
  const prefixPath = normalizePath(inputPath);
  const rows = await listRealtimeNodes(prefixPath);

  if (!rows.length) {
    const ancestor = await getClosestAncestor(prefixPath);
    if (!ancestor) {
      return null;
    }

    const nested = getBySegments(ancestor.value, ancestor.remainingSegments);
    return nested === undefined ? null : nested;
  }

  let exactValue;
  const nestedTree = {};

  rows.forEach((row) => {
    const rowPath = row.path;
    const parsed = parseMysqlJson(row.value);

    if (rowPath === prefixPath || (!prefixPath && rowPath === "")) {
      exactValue = parsed;
      return;
    }

    const relative = prefixPath ? rowPath.slice(prefixPath.length + 1) : rowPath;
    const segments = relative.split("/").filter(Boolean);
    if (segments.length) {
      setBySegmentsDeep(nestedTree, segments, parsed);
    }
  });

  if (exactValue === undefined) {
    return Object.keys(nestedTree).length ? nestedTree : null;
  }

  if (isObject(exactValue) && Object.keys(nestedTree).length) {
    return deepMerge(exactValue, nestedTree);
  }

  return exactValue;
}

export async function putRealtimeValue(inputPath, value) {
  const path = normalizePath(inputPath);

  if (!path) {
    await deleteRealtimePath("");
    await upsertRealtimeNode("", value);
    return value;
  }

  const exact = await findExactRealtimeNode(path);
  if (exact) {
    await upsertRealtimeNode(path, value);
    return value;
  }

  const ancestor = await getClosestAncestor(path);
  if (!ancestor) {
    await upsertRealtimeNode(path, value);
    return value;
  }

  const nextRoot = setBySegmentsDeep(ancestor.value, ancestor.remainingSegments, value);
  await upsertRealtimeNode(ancestor.path, nextRoot);
  return value;
}

export async function patchRealtimeValue(inputPath, patchPayload) {
  const path = normalizePath(inputPath);
  const current = await getRealtimeValue(path);
  const next = deepMerge(isObject(current) ? current : {}, patchPayload ?? {});
  await putRealtimeValue(path, next);
  return next;
}

export async function postRealtimeValue(inputPath, payload) {
  const parentPath = normalizePath(inputPath);
  const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const parentValue = await getRealtimeValue(parentPath);

  if (parentValue === null || parentValue === undefined) {
    await putRealtimeValue(`${parentPath}/${key}`, payload ?? {});
    return { name: key };
  }

  if (isObject(parentValue)) {
    const nextParent = { ...parentValue, [key]: payload ?? {} };
    await putRealtimeValue(parentPath, nextParent);
    return { name: key };
  }

  await putRealtimeValue(`${parentPath}/${key}`, payload ?? {});
  return { name: key };
}

export async function deleteRealtimeValue(inputPath) {
  const path = normalizePath(inputPath);
  if (!path) {
    await deleteRealtimePath("");
    return null;
  }

  const exact = await findExactRealtimeNode(path);
  if (exact) {
    await deleteRealtimePath(path);
    return null;
  }

  const ancestor = await getClosestAncestor(path);
  if (!ancestor) {
    await deleteRealtimePath(path);
    return null;
  }

  const { changed, next } = deleteBySegmentsDeep(ancestor.value, ancestor.remainingSegments);
  if (changed) {
    await upsertRealtimeNode(ancestor.path, next);
  }

  return null;
}