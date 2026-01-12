import http from "http";
import { WebSocketServer, WebSocket, type RawData } from "ws";

import { makeKeyController } from "@/api/controllers";
import { connectionManager, logger } from "@/api/utils";

type ClientMessage =
  | { type: "start"; batchSize?: number }
  | { type: "prefetch"; batchSize?: number }
  | { type: "cancel" };

const keyController = makeKeyController();

function sendMessage(socket: WebSocket, payload: unknown) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

function parseClientMessage(data: RawData): ClientMessage | null {
  try {
    const raw = typeof data === "string" ? data : data.toString();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const type = (parsed as { type?: string }).type;
    if (type === "start" || type === "prefetch" || type === "cancel") {
      return parsed as ClientMessage;
    }
    return null;
  } catch {
    return null;
  }
}

function resolveConnectionId(request: http.IncomingMessage): string | null {
  if (!request.url) {
    return null;
  }

  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url, `http://${host}`);
  const connectionId = url.searchParams.get("connectionId");
  return connectionId && connectionId.trim().length > 0 ? connectionId : null;
}

export function registerDumpWebsocket() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (socket, request) => {
    const connectionId = resolveConnectionId(request);
    if (!connectionId) {
      sendMessage(socket, {
        type: "dump-error",
        message: "Missing connection id"
      });
      socket.close();
      return;
    }

    let running = false;
    let cancelRequested = false;

    socket.on("close", () => {
      cancelRequested = true;
    });

    socket.on("message", async (data) => {
      const message = parseClientMessage(data);
      if (!message) {
        sendMessage(socket, {
          type: "dump-error",
          message: "Invalid message payload"
        });
        return;
      }

      if (message.type === "cancel") {
        cancelRequested = true;
        return;
      }

      if (message.type === "prefetch") {
        if (running) {
          return;
        }

        const connection = connectionManager().get(connectionId);
        if (!connection) {
          sendMessage(socket, {
            type: "dump-error",
            message: "Connection not found"
          });
          socket.close();
          return;
        }

        running = true;
        cancelRequested = false;

        try {
          const payload = await keyController.prefetchDump(connection, {
            batchSize: message.batchSize
          });
          sendMessage(socket, { type: "dump-prefetch", ...payload });
        } catch (error) {
          logger.error("Erro ao preparar dump", error as Error);
          sendMessage(socket, {
            type: "dump-error",
            message: "Dump prefetch failed"
          });
        } finally {
          running = false;
        }
        return;
      }

      if (running) {
        return;
      }

      const connection = connectionManager().get(connectionId);
      if (!connection) {
        sendMessage(socket, {
          type: "dump-error",
          message: "Connection not found"
        });
        socket.close();
        return;
      }

      running = true;
      cancelRequested = false;

      try {
        await keyController.streamDump(connection, {
          batchSize: message.batchSize,
          shouldCancel: () =>
            cancelRequested || socket.readyState !== WebSocket.OPEN,
          onStart: (payload) => {
            sendMessage(socket, { type: "dump-start", ...payload });
          },
          onBatch: (payload) => {
            sendMessage(socket, { type: "dump-batch", ...payload });
          },
          onComplete: (summary) => {
            sendMessage(socket, { type: "dump-complete", ...summary });
          },
          onCancel: (summary) => {
            sendMessage(socket, { type: "dump-cancelled", ...summary });
          }
        });
      } catch (error) {
        logger.error("Erro ao exportar dump", error as Error);
        sendMessage(socket, {
          type: "dump-error",
          message: "Dump failed"
        });
      } finally {
        running = false;
      }
    });
  });

  return wss;
}
