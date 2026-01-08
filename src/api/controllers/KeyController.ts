import { EventEmitter } from "events";
import { Request, Response } from "express";
import pLimit from "p-limit";
import { Key, MemcachedConnection } from "@/api/types";
import {
  connectionManager,
  extractKeysInfoFromDump,
  extractUsedChunksFromSlabs,
  logger,
  MAX_CONCURRENT_REQUESTS,
  MEMCACHED_MAX_VALUE_BYTES,
  ONE_MINUTE_IN_SECONDS,
  ONE_DAY_IN_SECONDS,
  RESERVED_KEYS,
  isReservedKey
} from "@/api/utils";
import { executeMemcachedCommand } from "@/api/utils/executeMemcachedCommand";

type KeyPayload = {
  key: string;
  value: string;
  timeUntilExpiration: number;
  size: number;
};

const INDEX_REFRESH_EVENT = "index-refresh";
const AUTH_INDEX_EVENT_ADD = "auth-index-add";
const AUTH_INDEX_EVENT_REMOVE = "auth-index-remove";
const AUTH_INDEX_EVENT_UPDATE = "auth-index-update";

type AuthIndexEventPayload = {
  connection: MemcachedConnection;
  key?: string;
  keys?: string[];
  clearAll?: boolean;
};

type CachedumpResult = {
  keysInfo: Key[];
};

type IndexRefreshPayload = {
  connection: MemcachedConnection;
  cachedump?: CachedumpResult;
};

class KeyController {
  private static indexUpdateEmitter = new EventEmitter();
  private static indexUpdateLocks = new Set<string>();
  private static indexSnapshots = new Map<string, string[]>();
  private static cachedumpSnapshots = new Map<
    string,
    { keysInfo: Key[]; capturedAt: number }
  >();
  private static indexUpdateListenerRegistered = false;
  private static authIndexEmitter = new EventEmitter();
  private static authIndexListenerRegistered = false;
  private static authIndexQueues = new Map<string, Promise<void>>();

  constructor() {
    if (!KeyController.indexUpdateListenerRegistered) {
      KeyController.indexUpdateListenerRegistered = true;
      KeyController.indexUpdateEmitter.on(
        INDEX_REFRESH_EVENT,
        (payload: IndexRefreshPayload) => {
          const connectionKey = this.getConnectionKey(payload.connection);
          if (KeyController.indexUpdateLocks.has(connectionKey)) {
            return;
          }

          KeyController.indexUpdateLocks.add(connectionKey);

          const run = async () => {
            try {
              await this.refreshIndexFromCachedump(
                payload.connection,
                payload.cachedump
              );
            } catch (error) {
              logger.error(
                "Erro ao atualizar indice via cachedump",
                error as Error
              );
            } finally {
              KeyController.indexUpdateLocks.delete(connectionKey);
              KeyController.indexSnapshots.delete(connectionKey);
            }
          };

          void run();
        }
      );
    }

    if (!KeyController.authIndexListenerRegistered) {
      KeyController.authIndexListenerRegistered = true;

      KeyController.authIndexEmitter.on(
        AUTH_INDEX_EVENT_ADD,
        (payload: AuthIndexEventPayload) => {
          this.enqueueAuthIndexUpdate(payload.connection, async () => {
            if (payload.key) {
              await this.updateKeyIndex(
                [payload.key],
                payload.connection,
                false
              );
            }
          });
        }
      );

      KeyController.authIndexEmitter.on(
        AUTH_INDEX_EVENT_UPDATE,
        (payload: AuthIndexEventPayload) => {
          this.enqueueAuthIndexUpdate(payload.connection, async () => {
            if (payload.key) {
              await this.updateKeyIndex(
                [payload.key],
                payload.connection,
                false
              );
            }
          });
        }
      );

      KeyController.authIndexEmitter.on(
        AUTH_INDEX_EVENT_REMOVE,
        (payload: AuthIndexEventPayload) => {
          this.enqueueAuthIndexUpdate(payload.connection, async () => {
            if (payload.clearAll) {
              await this.writeIndexShards([], payload.connection);
              return;
            }

            const keys = payload.keys ?? (payload.key ? [payload.key] : []);
            if (keys.length > 0) {
              await this.removeKeysFromIndex(keys, payload.connection);
            }
          });
        }
      );
    }
  }

  async getAll(request: Request, response: Response) {
    const connections = connectionManager();
    const connectionId = <string>request.headers["x-connection-id"];
    const connection = connections.get(connectionId)!;
    const searchTerm =
      typeof request.query.search === "string" ? request.query.search : "";
    const limitParam = request.query.limit;
    if (typeof limitParam !== "string") {
      response.status(400).json({
        error: "Parâmetro limit obrigatório"
      });
      return;
    }

    const limit = Number(limitParam);
    if (!Number.isFinite(limit) || limit <= 0) {
      response.status(400).json({
        error: "Parâmetro limit invalido"
      });
      return;
    }

    try {
      this.logDebug("Listagem de chaves solicitada", {
        connectionId,
        limit,
        hasSearch: searchTerm.length > 0,
        searchLength: searchTerm.length
      });
      const serverUnixTime = await this.getServerUnixTime(connection);
      let storedKeys: string[] = [];
      try {
        storedKeys = await this.getStoredKeysFromIndex(connection);
      } catch (err) {
        logger.error("Erro ao obter indice de chaves", err as Error);
      }

      this.logDebug("Indice atual carregado", {
        storedKeys: storedKeys.length
      });

      const allowReservedKeys = this.shouldExposeReservedKeys();
      const reservedIndexKeys = allowReservedKeys
        ? await this.getIndexKeyList(connection)
        : [];

      const listKeys = allowReservedKeys
        ? Array.from(
            new Set([
              RESERVED_KEYS.INDEXES,
              ...reservedIndexKeys,
              ...storedKeys
            ])
          )
        : storedKeys;

      this.logDebug("Chaves base para listagem", {
        listKeys: listKeys.length,
        reservedIndexKeys: reservedIndexKeys.length,
        allowReservedKeys
      });

      if (connection.authentication) {
        const filteredKeys = this.applyKeyFilters(
          listKeys,
          searchTerm,
          undefined,
          allowReservedKeys
        );
        this.logDebug("Listagem autenticada filtrada", {
          filteredKeys: filteredKeys.length
        });
        const payload = await this.getKeysValue(
          filteredKeys,
          connection,
          undefined,
          serverUnixTime,
          limit
        );
        this.logDebug("Listagem autenticada concluida", {
          payload: payload.length
        });
        response.json(payload);

        return;
      }

      if (storedKeys.length > 0) {
        const filteredKeys = this.applyKeyFilters(
          listKeys,
          searchTerm,
          undefined,
          allowReservedKeys
        );
        this.logDebug("Listagem filtrada por indice", {
          filteredKeys: filteredKeys.length,
          storedKeys: storedKeys.length
        });

        if (filteredKeys.length === 0) {
          response.json([]);
          this.emitIndexRefresh(connection);
          return;
        }

        const payload = await this.getKeysValue(
          filteredKeys,
          connection,
          undefined,
          serverUnixTime,
          limit
        );
        const nonReservedCount = allowReservedKeys
          ? payload.filter((item) => !isReservedKey(item.key)).length
          : payload.length;

        if (!searchTerm && nonReservedCount === 0) {
          this.logDebug("Indice sem chaves validas, usando cachedump");
          const { payload: fallbackPayload, cachedump } =
            await this.fetchKeysFromCachedump(
              connection,
              searchTerm,
              limit,
              allowReservedKeys,
              serverUnixTime
            );
          response.json(fallbackPayload);
          this.emitIndexRefresh(connection, cachedump);
          return;
        }
        response.json(payload);
        this.emitIndexRefresh(connection);

        return;
      }

      this.logDebug("Indice vazio, usando cachedump");
      const { payload: cachedumpPayload, cachedump } =
        await this.fetchKeysFromCachedump(
          connection,
          searchTerm,
          limit,
          allowReservedKeys,
          serverUnixTime
        );
      response.json(cachedumpPayload);
      this.emitIndexRefresh(connection, cachedump);
    } catch (error) {
      const message = "Falha ao recuperar chaves";
      logger.error(message, error);
      response.status(500).json({
        error: message
      });
    }
  }

  async count(request: Request, response: Response) {
    try {
      const connections = connectionManager();
      const connectionId = <string>request.headers["x-connection-id"];
      const connection = connections.get(connectionId)!;

      const stats = await new Promise<Record<string, string>>(
        (resolve, reject) => {
          connection.client.stats((error, _server, serverStats) => {
            if (error) {
              return reject(error);
            }

            resolve(serverStats ?? {});
          });
        }
      );

      const count = Number.parseInt(stats.curr_items ?? "", 10);

      if (!Number.isFinite(count)) {
        throw new Error("Valor curr_items invalido");
      }

      response.json({ count });
    } catch (error) {
      const message = "Falha ao contar chaves";
      logger.error(message, error);
      response.status(500).json({
        error: message
      });
    }
  }

  async create(request: Request, response: Response) {
    try {
      const connections = connectionManager();
      const connectionId = <string>request.headers["x-connection-id"];
      const connection = connections.get(connectionId)!;

      const { key, value, expires } = request.body;
      const options = expires ? { expires: expires } : undefined;

      const success = await connection.client.set(key, value, options);

      if (!success) {
        throw new Error("Falha ao armazenar valor");
      }

      response.status(201).json({
        key,
        status: "created",
        ttl: options?.expires
      });
      if (connection.authentication) {
        const storedKeys = await this.getStoredKeysFromIndex(connection);
        const eventType = storedKeys.includes(key)
          ? AUTH_INDEX_EVENT_UPDATE
          : AUTH_INDEX_EVENT_ADD;
        this.emitAuthIndexEvent(eventType, { connection, key });
      } else {
        this.emitIndexRefresh(connection);
      }
    } catch (error) {
      const message = "Erro ao definir chave";
      logger.error(message, error);
      response.status(500).json({
        error: message
      });
    }
  }

  async deleteByName(request: Request, response: Response) {
    try {
      const connections = connectionManager();
      const connectionId = <string>request.headers["x-connection-id"];

      const connection = connections.get(connectionId)!;

      const key = <string>request.params.key;
      await connection.client.delete(key);
      response.status(204).send();
      if (connection.authentication) {
        this.emitAuthIndexEvent(AUTH_INDEX_EVENT_REMOVE, { connection, key });
      } else {
        this.emitIndexRefresh(connection);
      }
    } catch (error) {
      const message = `Erro ao deletar chave ${request.params.key}`;
      logger.error(message, error);
      response.status(500).json({
        error: message
      });
    }
  }

  async flushAll(request: Request, response: Response) {
    try {
      const connections = connectionManager();
      const connectionId = <string>request.headers["x-connection-id"];
      const connection = connections.get(connectionId)!;

      await connection.client.flush();
      response.status(200).json({ status: "flushed" });
      if (connection.authentication) {
        this.emitAuthIndexEvent(AUTH_INDEX_EVENT_REMOVE, {
          connection,
          clearAll: true
        });
      } else {
        this.emitIndexRefresh(connection);
      }
    } catch (error) {
      const message = "Erro ao limpar todas as chaves";
      logger.error(message, error);
      response.status(500).json({
        error: message
      });
    }
  }

  async getByName(request: Request, response: Response) {
    try {
      const connections = connectionManager();
      const connectionId = <string>request.headers["x-connection-id"];
      const connection = connections.get(connectionId)!;

      const key = <string>request.params.key;

      const { value } = await connection!.client.get(key);

      if (!value) {
        throw new Error();
      }

      response.json({ key, value: value.toString() });
      if (connection.authentication) {
        this.emitAuthIndexEvent(AUTH_INDEX_EVENT_UPDATE, { connection, key });
      } else {
        this.emitIndexRefresh(connection);
      }
    } catch (error) {
      const message = `Erro ao obter chave ${request.params.key}`;
      logger.error(message, error);
      response.status(500).json({
        error: message
      });
    }
  }

  private emitIndexRefresh(
    connection: MemcachedConnection,
    cachedump?: CachedumpResult
  ) {
    if (connection.authentication) {
      return;
    }

    setImmediate(() => {
      KeyController.indexUpdateEmitter.emit(INDEX_REFRESH_EVENT, {
        connection,
        cachedump
      });
    });
  }

  private emitAuthIndexEvent(
    eventType:
      | typeof AUTH_INDEX_EVENT_ADD
      | typeof AUTH_INDEX_EVENT_REMOVE
      | typeof AUTH_INDEX_EVENT_UPDATE,
    payload: AuthIndexEventPayload
  ) {
    if (!payload.connection.authentication) {
      return;
    }

    setImmediate(() => {
      KeyController.authIndexEmitter.emit(eventType, payload);
    });
  }

  private getConnectionKey(connection: MemcachedConnection) {
    return connection.id || `${connection.host}:${connection.port}`;
  }

  private isDebugEnabled() {
    return process.env.MEMGUI_DEBUG === "true";
  }

  private logDebug(message: string, meta?: Record<string, unknown>) {
    if (!this.isDebugEnabled()) {
      return;
    }

    if (meta) {
      logger.info({ debug: meta }, `[DEBUG] ${message}`);
      return;
    }

    logger.info(`[DEBUG] ${message}`);
  }

  private enqueueAuthIndexUpdate(
    connection: MemcachedConnection,
    task: () => Promise<void>
  ) {
    const queueKey = this.getConnectionKey(connection);
    const previous =
      KeyController.authIndexQueues.get(queueKey) ?? Promise.resolve();

    const next = previous
      .catch(() => undefined)
      .then(task)
      .catch((error) => {
        logger.error("Erro ao processar evento de indice autenticado", error);
      })
      .finally(() => {
        if (KeyController.authIndexQueues.get(queueKey) === next) {
          KeyController.authIndexQueues.delete(queueKey);
        }
      });

    KeyController.authIndexQueues.set(queueKey, next);
  }

  private async refreshIndexFromCachedump(
    connection: MemcachedConnection,
    cachedump?: CachedumpResult
  ) {
    if (connection.authentication) {
      return;
    }

    const cachedumpResult =
      cachedump ?? (await this.getCachedumpKeysInfo(connection));
    const connectionKey = this.getConnectionKey(connection);
    const cachedumpKeys = cachedumpResult.keysInfo
      .map((info) => info.key)
      .filter((key) => !isReservedKey(key));
    const storedKeys = await this.getStoredKeysFromIndex(connection, {
      useSnapshot: false
    });
    KeyController.indexSnapshots.set(connectionKey, storedKeys);
    const allKeys = Array.from(
      new Set([...storedKeys, ...cachedumpKeys])
    ).sort();
    this.logDebug("Refresh do indice iniciado", {
      storedKeys: storedKeys.length,
      cachedumpKeys: cachedumpKeys.length,
      mergedKeys: allKeys.length
    });
    const existingKeys = await this.filterExistingKeys(allKeys, connection);
    this.logDebug("Refresh do indice validado", {
      existingKeys: existingKeys.length
    });

    await this.writeIndexShards(existingKeys, connection);
  }

  private async getCachedumpKeysInfo(
    connection: MemcachedConnection
  ): Promise<CachedumpResult> {
    const slabsOutput = await executeMemcachedCommand(
      "stats slabs",
      connection
    );
    const slabUsedMap = extractUsedChunksFromSlabs(slabsOutput);
    const slabEntries = Array.from(slabUsedMap.entries()).filter(
      ([, usedChunks]) => usedChunks > 0
    );
    this.logDebug("Slabs carregados para cachedump", {
      slabs: slabEntries.length
    });

    const keysInfoArrays = await Promise.all(
      slabEntries.map(async ([slabId, usedChunks]) => {
        try {
          const cachedumpLimit = Math.max(1, Math.ceil(usedChunks * 1.5));
          const dumpOutput = await executeMemcachedCommand(
            `stats cachedump ${slabId} ${cachedumpLimit}`,
            connection
          );

          return extractKeysInfoFromDump(dumpOutput, slabId);
        } catch (error) {
          logger.error(`Erro ao processar slab ${slabId}`, error as Error);
          return [];
        }
      })
    );

    const keysInfo = keysInfoArrays.flat();
    const connectionKey = this.getConnectionKey(connection);
    KeyController.cachedumpSnapshots.set(connectionKey, {
      keysInfo,
      capturedAt: Date.now()
    });
    this.logDebug("Cachedump finalizado", {
      keysInfo: keysInfo.length
    });

    return { keysInfo };
  }

  private async fetchKeysFromCachedump(
    connection: MemcachedConnection,
    searchTerm: string,
    limit: number,
    allowReservedKeys: boolean,
    serverUnixTime: number
  ): Promise<{ payload: KeyPayload[]; cachedump: CachedumpResult }> {
    const cachedump = await this.getCachedumpKeysInfo(connection);
    const keysInfo = cachedump.keysInfo;
    const slabKeys = keysInfo.map((info) => info.key);
    const allKeys = Array.from(new Set(slabKeys)).sort();
    const filteredKeys = this.applyKeyFilters(
      allKeys,
      searchTerm,
      undefined,
      allowReservedKeys
    );
    this.logDebug("Cachedump filtrado", {
      totalKeys: allKeys.length,
      filteredKeys: filteredKeys.length
    });

    if (filteredKeys.length === 0) {
      return { payload: [], cachedump };
    }

    const payload = await this.getKeysValue(
      filteredKeys,
      connection,
      keysInfo,
      serverUnixTime,
      limit
    );

    return { payload, cachedump };
  }

  private async getServerUnixTime(
    connection: MemcachedConnection
  ): Promise<number> {
    try {
      const stats = await new Promise<Record<string, string>>(
        (resolve, reject) => {
          connection.client.stats((error, _server, stats) => {
            if (error) {
              return reject(error);
            }
            resolve(stats ?? {});
          });
        }
      );

      const serverTime = Number(stats.time);

      if (Number.isFinite(serverTime)) {
        return serverTime;
      }
    } catch (error) {
      logger.warn(
        "Falha ao obter o tempo do servidor Memcached, usando horario local",
        error as Error
      );
    }

    return Math.floor(Date.now() / 1000);
  }

  private shouldExposeReservedKeys(): boolean {
    return (
      process.env.MEMGUI_DEV === "true" && process.env.MEMGUI_DEBUG === "true"
    );
  }

  private async getKeysValue(
    keys: string[],
    connection: MemcachedConnection,
    keysInfo?: Key[],
    serverUnixTime?: number,
    limit?: number
  ): Promise<KeyPayload[]> {
    const limiter = pLimit(MAX_CONCURRENT_REQUESTS);
    const targetLimit =
      limit !== undefined && Number.isFinite(limit) && limit > 0
        ? limit
        : undefined;
    const currentUnixTime =
      serverUnixTime ?? (await this.getServerUnixTime(connection));
    const allowReservedKeys = this.shouldExposeReservedKeys();
    const filteredKeys = allowReservedKeys
      ? keys
      : keys.filter((key) => !isReservedKey(key));
    const fallbackKeysInfo =
      keysInfo ??
      (!connection.authentication
        ? this.getCachedumpSnapshot(connection)
        : null);
    const keysInfoMap = fallbackKeysInfo
      ? new Map(fallbackKeysInfo.map((info) => [info.key, info]))
      : null;

    const validKeys: KeyPayload[] = [];
    const batchSize =
      targetLimit !== undefined
        ? Math.min(MAX_CONCURRENT_REQUESTS, targetLimit)
        : MAX_CONCURRENT_REQUESTS;
    for (let index = 0; index < filteredKeys.length; index += batchSize) {
      if (targetLimit !== undefined && validKeys.length >= targetLimit) {
        break;
      }

      const batch = filteredKeys.slice(index, index + batchSize);
      const results = await Promise.all(
        batch.map((key) =>
          limiter(async () => {
            try {
              const { value } = await connection.client.get(key);

              if (!value) {
                return null;
              }

              const info = keysInfoMap?.get(key);
              const expiration = info ? info.expiration : 0;
              const timeUntilExpiration =
                expiration > 0 ? Math.max(expiration - currentUnixTime, 0) : 0;
              const valueToString = value.toString();
              const size = info
                ? info.size
                : Buffer.from(valueToString, "utf8").length;

              return {
                key,
                value: valueToString,
                timeUntilExpiration,
                size
              };
            } catch (error) {
              logger.error(`Erro ao obter a chave ${key}`, error as Error);
              return null;
            }
          })
        )
      );

      for (const item of results) {
        if (item !== null && (allowReservedKeys || !isReservedKey(item.key))) {
          validKeys.push(item);
          if (targetLimit !== undefined && validKeys.length >= targetLimit) {
            break;
          }
        }
      }
    }

    return validKeys;
  }

  private async filterExistingKeys(
    keys: string[],
    connection: MemcachedConnection
  ): Promise<string[]> {
    const candidateKeys = keys.filter((key) => !isReservedKey(key));
    if (candidateKeys.length === 0) {
      return [];
    }

    const limit = pLimit(MAX_CONCURRENT_REQUESTS);
    const results = await Promise.all(
      candidateKeys.map((key) =>
        limit(async () => {
          try {
            const { value } = await connection.client.get(key);
            return value ? key : null;
          } catch (error) {
            logger.error(`Erro ao validar a chave ${key}`, error as Error);
            return null;
          }
        })
      )
    );

    return results.filter((item): item is string => item !== null).sort();
  }

  private getCachedumpSnapshot(connection: MemcachedConnection) {
    const connectionKey = this.getConnectionKey(connection);
    const snapshot = KeyController.cachedumpSnapshots.get(connectionKey);
    if (!snapshot) {
      return null;
    }

    const maxAgeMs = ONE_MINUTE_IN_SECONDS * 1000;
    if (Date.now() - snapshot.capturedAt > maxAgeMs) {
      KeyController.cachedumpSnapshots.delete(connectionKey);
      return null;
    }

    return snapshot.keysInfo;
  }

  private formatShardKey(index: number) {
    const padded = index.toString().padStart(2, "0");
    return `${RESERVED_KEYS.SHARD_PREFIX}${padded}${RESERVED_KEYS.SHARD_SUFFIX}`;
  }

  private buildIndexShards(keys: string[]): {
    indexKeys: string[];
    payloads: Record<string, string[]>;
  } {
    const payloads: Record<string, string[]> = {};
    const indexKeys: string[] = [];
    if (keys.length === 0) {
      return { indexKeys, payloads };
    }

    const payloadBytes = Buffer.byteLength(JSON.stringify(keys), "utf8");

    if (payloadBytes <= MEMCACHED_MAX_VALUE_BYTES) {
      const shardKey = this.formatShardKey(1);
      payloads[shardKey] = keys;
      return { indexKeys: [shardKey], payloads };
    }

    let shard: string[] = [];
    let shardIndex = 1;

    for (const key of keys) {
      shard.push(key);
      const shardBytes = Buffer.byteLength(JSON.stringify(shard), "utf8");

      if (shardBytes > MEMCACHED_MAX_VALUE_BYTES && shard.length > 1) {
        shard.pop();
        const shardKey = this.formatShardKey(shardIndex++);
        payloads[shardKey] = shard;
        indexKeys.push(shardKey);
        shard = [key];
      } else if (shardBytes > MEMCACHED_MAX_VALUE_BYTES) {
        const shardKey = this.formatShardKey(shardIndex++);
        payloads[shardKey] = shard;
        indexKeys.push(shardKey);
        shard = [];
      }
    }

    if (shard.length > 0) {
      const shardKey = this.formatShardKey(shardIndex);
      payloads[shardKey] = shard;
      indexKeys.push(shardKey);
    }

    return { indexKeys, payloads };
  }

  private async writeIndexShards(
    keys: string[],
    connection: MemcachedConnection
  ): Promise<void> {
    const uniqueKeys = Array.from(new Set(keys))
      .filter((key) => !isReservedKey(key))
      .sort();
    const previousIndexKeys = await this.getIndexKeyList(connection);
    const { indexKeys, payloads } = this.buildIndexShards(uniqueKeys);

    await Promise.all(
      indexKeys.map((indexKey) =>
        connection.client.set(
          indexKey,
          JSON.stringify(payloads[indexKey] ?? []),
          {
            expires: ONE_DAY_IN_SECONDS
          }
        )
      )
    );

    await connection.client.set(
      RESERVED_KEYS.INDEXES,
      JSON.stringify(indexKeys),
      {
        expires: ONE_DAY_IN_SECONDS
      }
    );

    const staleKeys = previousIndexKeys.filter(
      (key) => !indexKeys.includes(key)
    );

    await Promise.all(
      Array.from(new Set(staleKeys)).map((key) =>
        connection.client.delete(key).catch(() => false)
      )
    );
  }

  private async getIndexKeyList(
    connection: MemcachedConnection
  ): Promise<string[]> {
    const response = await connection.client.get(RESERVED_KEYS.INDEXES);
    if (!response?.value) {
      return [];
    }

    try {
      const parsed = JSON.parse(response.value.toString());
      if (!Array.isArray(parsed)) {
        return [];
      }

      return Array.from(
        new Set(
          parsed.filter(
            (key): key is string =>
              typeof key === "string" &&
              key.startsWith(RESERVED_KEYS.SHARD_PREFIX)
          )
        )
      );
    } catch (error) {
      logger.error("Erro ao ler indice de chaves", error as Error);
      return [];
    }
  }

  private async getKeysFromIndexKey(
    connection: MemcachedConnection,
    indexKey: string
  ): Promise<string[]> {
    const response = await connection.client.get(indexKey);
    if (!response?.value) {
      return [];
    }

    try {
      const parsed = JSON.parse(response.value.toString());
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (key): key is string => typeof key === "string" && !isReservedKey(key)
      );
    } catch (error) {
      logger.error("Erro ao ler indice de chaves", error as Error);
      return [];
    }
  }

  private async getStoredKeysFromIndex(
    connection: MemcachedConnection,
    options?: { useSnapshot?: boolean }
  ): Promise<string[]> {
    const useSnapshot = options?.useSnapshot ?? true;
    const connectionKey = this.getConnectionKey(connection);
    if (useSnapshot && KeyController.indexUpdateLocks.has(connectionKey)) {
      const snapshot = KeyController.indexSnapshots.get(connectionKey);
      if (snapshot !== undefined) {
        return [...snapshot];
      }
    }

    const indexKeys = await this.getIndexKeyList(connection);
    if (indexKeys.length === 0) {
      return [];
    }

    const keyLists = await Promise.all(
      indexKeys.map((indexKey) =>
        this.getKeysFromIndexKey(connection, indexKey)
      )
    );

    return Array.from(new Set(keyLists.flat())).sort();
  }

  private async updateKeyIndex(
    keyList: Pick<KeyPayload, "key">[] | string[],
    connection: MemcachedConnection,
    replace: boolean = true
  ): Promise<void> {
    const keys =
      typeof keyList[0] === "string"
        ? keyList
        : keyList.map((item) => (item as KeyPayload).key);

    try {
      let keysToStore: string[] = <string[]>keys;

      if (!replace) {
        const storedKeys = await this.getStoredKeysFromIndex(connection);
        const allKeys = Array.from(new Set([...storedKeys, ...keys])).sort();

        keysToStore = <string[]>allKeys;
      }

      await this.writeIndexShards(keysToStore, connection);
    } catch (error) {
      logger.error(error);
    }
  }

  private async removeKeysFromIndex(
    keysToRemove: string[],
    connection: MemcachedConnection
  ): Promise<void> {
    if (keysToRemove.length === 0) {
      return;
    }

    try {
      const storedKeys = await this.getStoredKeysFromIndex(connection);

      if (storedKeys.length === 0) {
        return;
      }

      const removalSet = new Set(
        keysToRemove.filter((key) => !isReservedKey(key))
      );
      const nextKeys = storedKeys.filter((key) => !removalSet.has(key));

      if (nextKeys.length === storedKeys.length) {
        return;
      }

      await this.writeIndexShards(nextKeys, connection);
    } catch (error) {
      logger.error(error);
    }
  }

  private applyKeyFilters(
    keys: string[],
    search: string,
    limit: number | undefined,
    allowReservedKeys: boolean
  ): string[] {
    let filtered = allowReservedKeys
      ? [...keys]
      : keys.filter((key) => !isReservedKey(key));

    if (search) {
      try {
        const regex = new RegExp(search, "i");
        filtered = filtered.filter((key) => regex.test(key));
      } catch {
        filtered = filtered.filter((key) =>
          key.toLowerCase().includes(search.toLowerCase())
        );
      }
    }

    if (limit && limit > 0) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }
}

export const makeKeyController = () => new KeyController();
