import { io } from "../server.js";

export function emitReportsDataUpdated(
  source: string,
  payload: Record<string, unknown> = {},
) {
  io.emit("reports:data_updated", {
    source,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}
