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
    response.status(400).json({ error: "ID de conexao nao fornecido" });
    return;
  }

  const connections = connectionManager();
  const connection = connections.get(connectionId);

  if (!connection) {
    response
      .status(401)
      .json({ error: "Nao autorizado, conexao nao encontrada" });
    return;
  }

  try {
    touchConnection(connection);

    next();
  } catch (error) {
    logger.error(`Conexao ${connectionId} inativa`, error as Error);
    closeConnection(connection);
    response.status(503).json({ error: "Conexao com Memcached perdida" });
  }
}
