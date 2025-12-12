import { createContext } from "react";

export interface Connection {
  name: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  timeout: number;
  id: string;
}

export interface KeyData {
  key: string;
  value: string;
  size: number;
  timeUntilExpiration?: number;
}

export interface ServerData {
  status: string;
  connectionId: string;
  host: string;
  port: number;
  lastActive: string;
  serverInfo: ServerInfo;
}

export interface ServerInfo {
  pid: string;
  uptime: string;
  version: string;
  max_connections: string;
  curr_connections: string;
  total_connections: string;
  threads: string;
  cmd_get: string;
  cmd_set: string;
  get_hits: string;
  get_misses: string;
  bytes_read: string;
  bytes_written: string;
  limit_maxbytes: string;
  bytes: string;
  expired_unfetched: string;
  evictions: string;
  reclaimed: string;
  cpu_usage: string;
  latency: string;
  requests_per_second: string;
  slabs: Slab[];
}

export interface Slab {
  id: number;
  chunk_size: number;
  total_chunks: number;
  used_chunks: number;
  free_chunks: number;
  get_hits: number;
}

export interface ConnectionsContextType {
  savedConnections: Connection[];
  currentConnection: Connection;
  isConnected: boolean;
  keys: KeyData[];
  totalKeyCount: number;
  serverData: ServerData | null;
  error: string;
  handleConnect: (connection: Omit<Connection, "id">) => Promise<boolean>;
  handleTestConnection: (
    connection: Omit<Connection, "id">
  ) => Promise<boolean>;
  handleChoseConnection: (
    connection: Omit<Connection, "id">
  ) => Promise<boolean>;
  handleDisconnect: () => void;
  handleLoadKeys: (
    showLoadingModal?: boolean,
    search?: string,
    limit?: number
  ) => Promise<boolean>;
  handleFlushAllKeys: () => Promise<boolean>;
  handleCreateKey: (newKey: KeyData) => Promise<boolean>;
  handleEditKey: (updatedKey: KeyData) => Promise<boolean>;
  handleDeleteKey: (key: string) => Promise<boolean>;
  handleEditConnection: (
    updatedConnection: Connection,
    previousConnection?: Connection
  ) => void;
  handleDeleteConnection: (connection: Connection) => void;
  handleLoadServerData: (showLoadingModal?: boolean) => Promise<boolean>;
  handleGetByKey: (
    key: string
  ) => Promise<{ key: string; value: string } | null>;
  refreshKeyCount: () => Promise<boolean>;
  totalKeyCount?: number;
}

export const ConnectionsContext = createContext<
  ConnectionsContextType | undefined
>(undefined);
