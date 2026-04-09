export function normalizePath(inputPath = "") {
  const clean = String(inputPath).replace(/^\/+/, "").replace(/\.json$/, "");
  return clean.replace(/\/+$/, "");
}

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function splitSegments(path = "") {
  return String(path).split("/").filter(Boolean);
}

export function isNumericSegment(segment) {
  return /^\d+$/.test(String(segment));
}

export function deepMerge(target, source) {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  const output = { ...target };
  Object.keys(source).forEach((key) => {
    if (isObject(source[key]) && isObject(output[key])) {
      output[key] = deepMerge(output[key], source[key]);
    } else {
      output[key] = source[key];
    }
  });

  return output;
}

export function setBySegments(obj, segments, value) {
  let current = obj;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!current[segment] || typeof current[segment] !== "object") {
      current[segment] = {};
    }
    current = current[segment];
  }
  current[segments[segments.length - 1]] = value;
}

export function getBySegments(target, segments) {
  let current = target;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      if (!isNumericSegment(segment)) {
        return undefined;
      }
      current = current[Number(segment)];
      continue;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

export function setBySegmentsDeep(target, segments, value) {
  if (!segments.length) {
    return value;
  }

  const root = target === undefined ? {} : target;
  let current = root;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];
    const nextShouldBeArray = isNumericSegment(nextSegment);

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isNaN(index)) {
        return root;
      }

      if (current[index] === undefined || current[index] === null || typeof current[index] !== "object") {
        current[index] = nextShouldBeArray ? [] : {};
      }
      current = current[index];
      continue;
    }

    if (current[segment] === undefined || current[segment] === null || typeof current[segment] !== "object") {
      current[segment] = nextShouldBeArray ? [] : {};
    }
    current = current[segment];
  }

  const lastSegment = segments[segments.length - 1];
  if (Array.isArray(current)) {
    const index = Number(lastSegment);
    if (!Number.isNaN(index)) {
      current[index] = value;
    }
  } else {
    current[lastSegment] = value;
  }

  return root;
}

export function deleteBySegmentsDeep(target, segments) {
  if (!segments.length || target === null || target === undefined) {
    return { changed: false, next: target };
  }

  const root = target;
  let current = root;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];

    if (Array.isArray(current)) {
      if (!isNumericSegment(segment)) {
        return { changed: false, next: root };
      }
      current = current[Number(segment)];
      continue;
    }

    if (!current || typeof current !== "object") {
      return { changed: false, next: root };
    }

    current = current[segment];
  }

  const last = segments[segments.length - 1];

  if (Array.isArray(current)) {
    if (!isNumericSegment(last)) {
      return { changed: false, next: root };
    }

    const index = Number(last);
    if (index < 0 || index >= current.length) {
      return { changed: false, next: root };
    }

    current.splice(index, 1);
    return { changed: true, next: root };
  }

  if (!current || typeof current !== "object") {
    return { changed: false, next: root };
  }

  if (!(last in current)) {
    return { changed: false, next: root };
  }

  delete current[last];
  return { changed: true, next: root };
}