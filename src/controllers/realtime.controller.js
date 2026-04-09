import {
  deleteRealtimeValue,
  getRealtimeValue,
  patchRealtimeValue,
  postRealtimeValue,
  putRealtimeValue,
} from "../services/realtime.service.js";

export async function getRealtimeController(req, res) {
  res.json(await getRealtimeValue(req.params[0]));
}

export async function postRealtimeController(req, res) {
  res.status(201).json(await postRealtimeValue(req.params[0], req.body ?? {}));
}

export async function putRealtimeController(req, res) {
  res.json(await putRealtimeValue(req.params[0], req.body ?? {}));
}

export async function patchRealtimeController(req, res) {
  res.json(await patchRealtimeValue(req.params[0], req.body ?? {}));
}

export async function deleteRealtimeController(req, res) {
  res.json(await deleteRealtimeValue(req.params[0]));
}