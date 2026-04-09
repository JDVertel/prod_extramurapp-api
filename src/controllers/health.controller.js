import { getHealthStatus } from "../services/health.service.js";

export async function health(_req, res) {
  res.json(getHealthStatus());
}