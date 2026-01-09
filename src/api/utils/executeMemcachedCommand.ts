/* eslint-disable @typescript-eslint/no-explicit-any */
import net from "net";
import { MEMCACHED_CONNECT_TIMEOUT_SECONDS } from "./constants";
import { MemcachedConnection } from "@/api/types";

// ===================================
// BINARY COMMUNICATION
// ===================================

/**
 * Builds a generic binary request packet for the Memcached protocol.
 */
function buildBinaryRequest(
  opcode: number,
  key: Buffer,
  extras: Buffer = Buffer.alloc(0),
  value: Buffer = Buffer.alloc(0)
): Buffer {
  const header = Buffer.alloc(24);
  header.writeUInt8(0x80, 0); // Magic: request
  header.writeUInt8(opcode, 1); // Opcode
  header.writeUInt16BE(key.length, 2); // Key length
  header.writeUInt8(extras.length, 4); // Extras length
  header.writeUInt8(0, 5); // Data type (always 0)
  header.writeUInt16BE(0, 6); // Reserved/vbucket id
  const totalBodyLength = key.length + extras.length + value.length;
  header.writeUInt32BE(totalBodyLength, 8); // Total body length
  header.writeUInt32BE(0, 12); // Opaque (can be 0)
  header.writeBigUInt64BE(BigInt(0), 16); // CAS
  return Buffer.concat([header, extras, key, value]);
}

/**
 * Builds a SASL authentication request using the PLAIN mechanism.
 */
function buildSaslAuthRequest(username: string, password: string): Buffer {
  const mechanism = Buffer.from("PLAIN");
  const credentials = Buffer.from(`\0${username}\0${password}`);
  // Opcode 0x21 is for SASL authentication in the binary protocol.
  return buildBinaryRequest(0x21, mechanism, Buffer.alloc(0), credentials);
}

/**
 * Builds a binary request for the "stats slabs" command.
 */
function buildBinaryStatsSlabsRequest(): Buffer {
  const key = Buffer.from("slabs");
  return buildBinaryRequest(0x10, key, Buffer.alloc(0), Buffer.alloc(0));
}

const DEFAULT_REQUEST_TIMEOUT_SECONDS = 5;

function resolveTimeouts(timeoutSeconds: number): {
  requestTimeoutMs: number;
  connectTimeoutMs: number;
} {
  const safeTimeoutSeconds =
    Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
      ? timeoutSeconds
      : DEFAULT_REQUEST_TIMEOUT_SECONDS;
  const requestTimeoutMs = Math.round(safeTimeoutSeconds * 1000);
  const connectTimeoutMs = Math.min(
    requestTimeoutMs,
    MEMCACHED_CONNECT_TIMEOUT_SECONDS * 1000
  );

  return { requestTimeoutMs, connectTimeoutMs };
}

function startRequestTimeout(
  timeoutMs: number,
  onTimeout: (err: Error) => void
): NodeJS.Timeout {
  return setTimeout(() => {
    onTimeout(new Error(`Timeout: No response within ${timeoutMs}ms`));
  }, timeoutMs);
}

function refreshTimeout(timeout: NodeJS.Timeout | null): void {
  if (timeout && typeof timeout.refresh === "function") {
    timeout.refresh();
  }
}

/**
 * Handles the authentication response.
 */
function extractBinaryErrorMessage(responsePacket: Buffer): string | null {
  const totalBodyLength = responsePacket.readUInt32BE(8);
  if (totalBodyLength === 0) {
    return null;
  }

  const extrasLength = responsePacket.readUInt8(4);
  const keyLength = responsePacket.readUInt16BE(2);
  const valueLength = totalBodyLength - extrasLength - keyLength;
  if (valueLength <= 0) {
    return null;
  }

  const valueStart = 24 + extrasLength + keyLength;
  return responsePacket.slice(valueStart, valueStart + valueLength).toString();
}

function handleAuthResponse(
  client: net.Socket,
  responsePacket: Buffer,
  state: { stage: string },
  reject: (err: Error) => void
): void {
  const status = responsePacket.readUInt16BE(6);
  if (status !== 0) {
    const detail = extractBinaryErrorMessage(responsePacket);
    reject(
      new Error(
        `Authentication failed with status ${status}${detail ? `: ${detail}` : ""}`
      )
    );
    return;
  }
  state.stage = "command";
  const request = buildBinaryStatsSlabsRequest();
  client.write(request);
}

/**
 * Handles the binary response for the "stats slabs" command.
 */
function handleBinaryStatsSlabsResponse(
  responsePacket: Buffer,
  stats: Record<string, string>,
  resolve: (value: Record<string, string>) => void,
  reject: (err: Error) => void
): void {
  const status = responsePacket.readUInt16BE(6);
  const totalBodyLength = responsePacket.readUInt32BE(8);
  if (status !== 0) {
    const detail = extractBinaryErrorMessage(responsePacket);
    reject(
      new Error(
        `Stats request failed with status ${status}${detail ? `: ${detail}` : ""}`
      )
    );
    return;
  }

  if (totalBodyLength === 0) {
    resolve(stats);
    return;
  }

  const extrasLength = responsePacket.readUInt8(4);
  const keyLength = responsePacket.readUInt16BE(2);
  const valueLength = totalBodyLength - extrasLength - keyLength;
  if (valueLength < 0) {
    reject(new Error("Invalid response body length"));
    return;
  }

  const keyStart = 24 + extrasLength;
  const valueStart = keyStart + keyLength;
  const statName = responsePacket.slice(keyStart, valueStart).toString();
  const statValue = responsePacket
    .slice(valueStart, valueStart + valueLength)
    .toString();
  if (statName) {
    stats[statName] = statValue;
  }
}

/**
 * Processes binary response data received from the socket.
 */
function handleBinaryResponseData(
  client: net.Socket,
  bufferState: { buffer: Buffer },
  stats: Record<string, string>,
  state: { stage: string; settled: boolean },
  resolve: (value: Record<string, string>) => void,
  reject: (err: Error) => void
): void {
  let buffer = bufferState.buffer;
  while (buffer.length >= 24) {
    const magic = buffer.readUInt8(0);
    if (magic !== 0x81) {
      reject(new Error(`Invalid response (magic ${magic})`));
      return;
    }
    const totalBodyLength = buffer.readUInt32BE(8);
    const responseLength = 24 + totalBodyLength;
    if (buffer.length < responseLength) break; // Incomplete packet
    const responsePacket = buffer.slice(0, responseLength);
    buffer = buffer.slice(responseLength);
    if (state.stage === "auth") {
      handleAuthResponse(client, responsePacket, state, reject);
      if (state.settled) {
        bufferState.buffer = buffer;
        return;
      }
    } else if (state.stage === "command") {
      handleBinaryStatsSlabsResponse(responsePacket, stats, resolve, reject);
      if (state.settled) {
        bufferState.buffer = buffer;
        return;
      }
    }
  }
  bufferState.buffer = buffer;
}

/**
 * Executes the Memcached command using the binary protocol (authenticated).
 * Only supports the "stats slabs" command.
 */
export async function executeMemcachedBinaryCommand(
  connection: MemcachedConnection,
  command: string
): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    // Enforce that only the "stats slabs" command is allowed for authenticated connections
    if (command.toLowerCase().trim() !== "stats slabs") {
      return reject(
        new Error(
          "Only 'stats slabs' command is allowed for authenticated connections."
        )
      );
    }
    const stats: Record<string, string> = {};
    const client = new net.Socket();
    client.setNoDelay(true);
    const state = {
      stage: connection.authentication ? "auth" : "command",
      settled: false
    };
    const bufferState = { buffer: Buffer.alloc(0) };
    const { requestTimeoutMs, connectTimeoutMs } = resolveTimeouts(
      connection.connectionTimeout
    );
    let requestTimeout: NodeJS.Timeout | null = null;
    let connectTimeout: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      if (requestTimeout) {
        clearTimeout(requestTimeout);
        requestTimeout = null;
      }
    };

    const resolveWith = (result: Record<string, string>) => {
      if (state.settled) {
        return;
      }
      state.settled = true;
      cleanup();
      client.destroy();
      resolve(result);
    };

    const rejectWith = (error: Error) => {
      if (state.settled) {
        return;
      }
      state.settled = true;
      cleanup();
      client.destroy();
      reject(error);
    };
    connectTimeout = setTimeout(() => {
      rejectWith(
        new Error(`Timeout: Could not connect within ${connectTimeoutMs}ms`)
      );
    }, connectTimeoutMs);

    client.connect(connection.port, connection.host, () => {
      if (state.settled) {
        return;
      }
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      requestTimeout = startRequestTimeout(requestTimeoutMs, rejectWith);
      if (state.stage === "auth" && connection.authentication) {
        const authRequest = buildSaslAuthRequest(
          connection.authentication.username,
          connection.authentication.password
        );
        client.write(authRequest);
      } else {
        const request = buildBinaryStatsSlabsRequest();
        client.write(request);
      }
    });
    client.on("data", (chunk: Buffer) => {
      refreshTimeout(requestTimeout);
      bufferState.buffer = Buffer.concat([bufferState.buffer, chunk]);
      try {
        handleBinaryResponseData(
          client,
          bufferState,
          stats,
          state,
          resolveWith,
          rejectWith
        );
      } catch (err) {
        rejectWith(err as Error);
      }
    });
    client.on("close", () => {
      if (!state.settled) {
        rejectWith(new Error("Connection closed before response"));
      }
    });
    client.on("error", (error: Error) => {
      rejectWith(error);
    });
  });
}

// ===================================
// ASCII COMMUNICATION
// ===================================

/**
 * Extracts the argument from the command (everything after the first space).
 */
function extractCommandArgument(command: string): string {
  return command.split(" ").slice(1).join(" ").trim();
}

/**
 * Determines the ASCII command type: returns "STATS_SLABS" or "STATS_CACHEDUMP".
 */
function getAsciiCommandType(
  command: string
): "STATS_SLABS" | "STATS_CACHEDUMP" {
  const arg = extractCommandArgument(command).toLowerCase();
  if (arg.startsWith("slabs")) return "STATS_SLABS";
  if (arg.startsWith("cachedump")) return "STATS_CACHEDUMP";
  throw new Error("Unsupported ASCII command.");
}

function getAsciiErrorLine(data: string): string | null {
  const lines = data.split("\r\n");
  for (const line of lines) {
    if (line.startsWith("ERROR")) return line;
    if (line.startsWith("CLIENT_ERROR")) return line;
    if (line.startsWith("SERVER_ERROR")) return line;
  }
  return null;
}

/**
 * Handles the ASCII response for the "stats slabs" command.
 */
function handleAsciiStatsSlabsResponse(data: string): Record<string, any> {
  const stats: Record<string, any> = {};
  const lines = data.split("\r\n");
  for (const line of lines) {
    if (line === "END") break;
    if (line.startsWith("STAT ")) {
      const parts = line.split(" ");
      if (parts.length >= 3) {
        stats[parts[1]] = parts.slice(2).join(" ");
      }
    }
  }
  return stats;
}

/**
 * Handles the ASCII response for the "stats cachedump" command.
 */
function handleAsciiStatsCachedumpResponse(data: string): Record<string, any> {
  const dump: Record<string, any> = {};
  const lines = data.split("\r\n");
  for (const line of lines) {
    if (line === "END") break;
    if (line.startsWith("ITEM ")) {
      const parts = line.split(" ");
      if (parts.length >= 2) {
        const key = parts[1];
        dump[key] = parts.slice(2).join(" ");
      }
    }
  }
  return dump;
}

/**
 * Executes the Memcached command using the ASCII protocol (non-authenticated).
 * Supports "stats slabs" and "stats cachedump".
 */
export async function executeMemcachedAsciiCommand(
  connection: MemcachedConnection,
  command: string
): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let commandType: "STATS_SLABS" | "STATS_CACHEDUMP";
    try {
      commandType = getAsciiCommandType(command);
    } catch (err) {
      reject(err as Error);
      return;
    }

    const client = new net.Socket();
    client.setNoDelay(true);
    let dataBuffer = "";
    const { requestTimeoutMs, connectTimeoutMs } = resolveTimeouts(
      connection.connectionTimeout
    );
    let requestTimeout: NodeJS.Timeout | null = null;
    let connectTimeout: NodeJS.Timeout | null = null;
    let settled = false;

    const cleanup = () => {
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      if (requestTimeout) {
        clearTimeout(requestTimeout);
        requestTimeout = null;
      }
    };

    const resolveWith = (result: Record<string, string>) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      client.destroy();
      resolve(result);
    };

    const rejectWith = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      client.destroy();
      reject(error);
    };

    connectTimeout = setTimeout(() => {
      rejectWith(
        new Error(`Timeout: Could not connect within ${connectTimeoutMs}ms`)
      );
    }, connectTimeoutMs);

    client.connect(connection.port, connection.host, () => {
      if (settled) {
        return;
      }
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      requestTimeout = startRequestTimeout(requestTimeoutMs, rejectWith);
      let commandStr = command.trim();
      if (!commandStr.endsWith("\r\n")) {
        commandStr += "\r\n";
      }
      client.write(commandStr);
    });

    client.on("data", (chunk: Buffer) => {
      refreshTimeout(requestTimeout);
      dataBuffer += chunk.toString();
      const errorLine = getAsciiErrorLine(dataBuffer);
      if (errorLine) {
        rejectWith(new Error(errorLine));
        return;
      }
      if (dataBuffer.includes("END\r\n")) {
        const result =
          commandType === "STATS_SLABS"
            ? handleAsciiStatsSlabsResponse(dataBuffer)
            : handleAsciiStatsCachedumpResponse(dataBuffer);
        resolveWith(result);
      }
    });

    client.on("close", () => {
      if (!settled) {
        rejectWith(new Error("Connection closed before response"));
      }
    });

    client.on("error", (err: Error) => {
      rejectWith(err);
    });
  });
}

// ===================================
// HIGH-LEVEL COMMAND EXECUTION
// ===================================

/**
 * Executes the Memcached stats command based on the connection type.
 */
export async function executeMemcachedCommand(
  command: string,
  connection: MemcachedConnection
): Promise<Record<string, string>> {
  if (connection.authentication) {
    return executeMemcachedBinaryCommand(connection, command);
  } else {
    return executeMemcachedAsciiCommand(connection, command);
  }
}
