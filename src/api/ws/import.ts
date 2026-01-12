import http from "http";
import { WebSocketServer, WebSocket, type RawData } from "ws";

import { makeKeyController } from "@/api/controllers";
import {
  connectionManager,
  logger,
  MAX_CONCURRENT_REQUESTS
} from "@/api/utils";

type ImportItem = {
  key?: string;
  value?: unknown;
  timeUntilExpiration?: number;
};

type ClientMessage =
  | { type: "start"; total?: number; batchSize?: number }
  | { type: "batch"; items?: ImportItem[] }
  | { type: "cancel" };

const keyController = makeKeyController();

const MAX_BATCH_SIZE = Math.max(1, Math.min(MAX_CONCURRENT_REQUESTS, 100));
const DEFAULT_BATCH_SIZE = Math.min(50, MAX_BATCH_SIZE);

function resolveBatchSize(batchSize?: number) {
  if (!Number.isFinite(batchSize) || batchSize === undefined) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.max(1, Math.min(Math.floor(batchSize), MAX_BATCH_SIZE));
}

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
    if (type === "start" || type === "batch" || type === "cancel") {
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

export function registerImportWebsocket() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (socket, request) => {
    const connectionId = resolveConnectionId(request);
    if (!connectionId) {
      sendMessage(socket, {
        type: "import-error",
        message: "Missing connection id"
      });
      socket.close();
      return;
    }

    let running = false;
    let cancelRequested = false;
    let total = 0;
    let batchSize = DEFAULT_BATCH_SIZE;
    let batchCount = 0;
    let batchIndex = 0;
    let processed = 0;
    let successCount = 0;
    let failureCount = 0;
    let startedAt = 0;
    const importedKeys: string[] = [];
    let queue = Promise.resolve();

    const finalize = async (type: "import-complete" | "import-cancelled") => {
      if (!running) {
        return;
      }

      running = false;
      const connection = connectionManager().get(connectionId);
      if (connection && importedKeys.length > 0) {
        try {
          await keyController.registerImportedKeys(connection, importedKeys);
        } catch (error) {
          logger.error(
            "Erro ao atualizar indice apos importacao",
            error as Error
          );
        }
      }

      sendMessage(socket, {
        type,
        total,
        processed,
        successCount,
        failureCount,
        durationMs: Date.now() - startedAt
      });
    };

    socket.on("close", () => {
      cancelRequested = true;
    });

    socket.on("message", (data) => {
      const message = parseClientMessage(data);
      if (!message) {
        sendMessage(socket, {
          type: "import-error",
          message: "Invalid message payload"
        });
        return;
      }

      if (message.type === "cancel") {
        cancelRequested = true;
        queue = queue
          .then(async () => {
            await finalize("import-cancelled");
          })
          .catch(() => undefined);
        return;
      }

      if (message.type === "start") {
        if (running) {
          return;
        }

        if (
          typeof message.total !== "number" ||
          !Number.isFinite(message.total) ||
          message.total < 0
        ) {
          sendMessage(socket, {
            type: "import-error",
            message: "Invalid total"
          });
          socket.close();
          return;
        }

        const connection = connectionManager().get(connectionId);
        if (!connection) {
          sendMessage(socket, {
            type: "import-error",
            message: "Connection not found"
          });
          socket.close();
          return;
        }

        running = true;
        cancelRequested = false;
        total = Math.floor(message.total);
        batchSize = resolveBatchSize(message.batchSize);
        batchCount = total > 0 ? Math.ceil(total / batchSize) : 0;
        batchIndex = 0;
        processed = 0;
        successCount = 0;
        failureCount = 0;
        startedAt = Date.now();

        sendMessage(socket, {
          type: "import-start",
          total,
          batchSize,
          batchCount
        });

        if (total === 0) {
          queue = queue
            .then(async () => {
              await finalize("import-complete");
            })
            .catch(() => undefined);
        }
        return;
      }

      if (!running) {
        sendMessage(socket, {
          type: "import-error",
          message: "Import not started"
        });
        return;
      }

      if (message.type === "batch") {
        const items = Array.isArray(message.items) ? message.items : [];
        queue = queue
          .then(async () => {
            if (cancelRequested || !running) {
              return;
            }

            const connection = connectionManager().get(connectionId);
            if (!connection) {
              sendMessage(socket, {
                type: "import-error",
                message: "Connection not found"
              });
              await finalize("import-cancelled");
              socket.close();
              return;
            }

            batchIndex += 1;
            const result = await keyController.importBatch(connection, items);
            processed += result.processed;
            successCount += result.successCount;
            failureCount += result.failureCount;
            importedKeys.push(...result.importedKeys);

            const progress =
              total > 0
                ? Math.min(100, Math.round((processed / total) * 100))
                : 100;
            const successRate =
              total > 0
                ? Math.min(100, Math.round((successCount / total) * 100))
                : 100;

            sendMessage(socket, {
              type: "import-batch",
              batchIndex,
              batchCount,
              processed,
              total,
              successCount,
              failureCount,
              progress,
              successRate
            });

            if (processed >= total && running) {
              await finalize("import-complete");
            }
          })
          .catch((error) => {
            logger.error("Erro ao importar lote", error as Error);
            sendMessage(socket, {
              type: "import-error",
              message: "Import failed"
            });
          });
      }
    });
  });

  return wss;
}
