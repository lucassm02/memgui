import { logger } from "./logger";
import { MemcachedConnection } from "@/api/types";
import { closeSshTunnel } from "./sshTunnel";

class ConnectionManager {
  private static instance: ConnectionManager;
  private connections = new Map<string, MemcachedConnection>();

  constructor() {}

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }

    return ConnectionManager.instance;
  }

  public get(key: string) {
    return this.connections.get(key);
  }
  public set(key: string, value: MemcachedConnection) {
    this.connections.set(key, value);
  }

  public delete(key: string) {
    this.connections.delete(key);
  }
}

export function connectionManager() {
  return ConnectionManager.getInstance();
}

const MIN_IDLE_TIMEOUT_MS = 1000;

function resolveIdleTimeoutMs(connection: MemcachedConnection): number {
  const timeoutSeconds = Number(connection.connectionTimeout);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    return MIN_IDLE_TIMEOUT_MS;
  }

  return Math.max(MIN_IDLE_TIMEOUT_MS, Math.round(timeoutSeconds * 1000));
}

function resetConnectionTimer(connection: MemcachedConnection) {
  clearTimeout(connection.timer);
  const idleTimeoutMs = resolveIdleTimeoutMs(connection);
  connection.timer = setTimeout(() => {
    logger.info(`Conexao ${connection.id} expirada por inatividade`);
    closeConnection(connection);
  }, idleTimeoutMs);
}

export function touchConnection(connection: MemcachedConnection) {
  connection.lastActive = new Date();
  resetConnectionTimer(connection);
}

export function closeConnection(connection: MemcachedConnection) {
  clearTimeout(connection.timer);
  closeSshTunnel(connection.tunnel);
  try {
    connection.client.close();
  } catch {
    // Ignore close errors.
  }
  connectionManager().delete(connection.id);
}
