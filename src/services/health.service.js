export function getHealthStatus() {
  return {
    ok: true,
    service: "extramurapp-api",
    timestamp: new Date().toISOString(),
  };
}