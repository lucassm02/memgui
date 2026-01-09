import { NextFunction, Request, Response } from "express";
import {
  closeConnection,
  connectionManager,
  logger,
  touchConnection
} from "@/api/utils";

export function checkConnectionMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const connectionId = <string>request.headers["x-connection-id"];

  if (!connectionId) {
    response.status(400).json({ error: "ID de conex?o n?o fornecido" });
    return;
  }

  const connections = connectionManager();
  const connection = connections.get(connectionId);

  if (!connection) {
    response
      .status(401)
      .json({ error: "N?o autorizado, conex?o n?o encontrada" });
    return;
  }

  try {
    touchConnection(connection);

    next();
  } catch (error) {
    logger.error(`Conex?o ${connectionId} inativa`, error as Error);
    closeConnection(connection);
    response.status(503).json({ error: "Conex?o com Memcached perdida" });
  }
}
