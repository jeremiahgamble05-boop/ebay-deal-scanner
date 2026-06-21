import app from "./app";
import { logger } from "./lib/logger";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { addWebSocketClient } from "./lib/scanner";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = request.url ?? "";
  if (url.startsWith("/api/v1/ws/deals")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
      addWebSocketClient(ws);
      ws.send(JSON.stringify({ type: "connected", message: "Deal scanner connected" }));
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
