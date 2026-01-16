import net from "net";
import memjs from "memjs";
import { Client as SshClient } from "ssh2";

export interface SshConfig {
  host?: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  hostKeyFingerprint?: string;
}

export interface SshTunnel {
  client: SshClient;
  server: net.Server;
  localHost: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
}

export interface MemcachedConnection {
  id: string;
  host: string;
  port: number;
  authentication?: { username: string; password: string };
  client: memjs.Client;
  connectionTimeout: number;
  lastActive: Date;
  timer: NodeJS.Timeout;
  ssh?: SshConfig;
  tunnel?: SshTunnel;
}

export interface CacheResponse {
  key: string;
  value: string | null;
  timeUntilExpiration: number;
  size: number;
}

export interface Key {
  key: string;
  expiration: number;
  size: number;
  slabId?: string;
}

export interface Slab {
  id: number;
  chunk_size?: number;
  chunks_per_page?: number;
  total_pages?: number;
  total_chunks?: number;
  used_chunks?: number;
  free_chunks?: number;
  free_chunks_end?: number;
  get_hits?: number;
  cmd_set?: number;
  delete_hits?: number;
  incr_hits?: number;
  decr_hits?: number;
  cas_hits?: number;
  cas_badval?: number;
  touch_hits?: number;
  [key: string]: number | undefined;
}
