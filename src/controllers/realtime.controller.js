import {
  deleteRealtimeValue,
  getRealtimeValue,
  patchRealtimeValue,
  postRealtimeValue,
  putRealtimeValue,
} from "../services/realtime.service.js";

function resolveRealtimePath(req) {
  if (req.params?.[0] !== undefined) {
    return req.params[0];
  }

  return String(req.path || "").replace(/^\/+/, "");
}

export async function getRealtimeController(req, res) {
  res.json(await getRealtimeValue(resolveRealtimePath(req), req.user, req.query ?? {}));
}

export async function postRealtimeController(req, res) {
  res.status(201).json(await postRealtimeValue(resolveRealtimePath(req), req.body ?? {}, req.user));
}

export async function putRealtimeController(req, res) {
  res.json(await putRealtimeValue(resolveRealtimePath(req), req.body ?? {}, req.user));
}

export async function patchRealtimeController(req, res) {
  res.json(await patchRealtimeValue(resolveRealtimePath(req), req.body ?? {}, req.user));
}

export async function deleteRealtimeController(req, res) {
  res.json(await deleteRealtimeValue(resolveRealtimePath(req), req.user));
}