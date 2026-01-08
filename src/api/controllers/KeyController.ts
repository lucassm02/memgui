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

class KeyController {
  constructor() {}

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

    const inflatedLimit = Math.ceil(limit * 1.25);

    try {
      const serverUnixTime = await this.getServerUnixTime(connection);
      let storedKeys: string[] = [];
      try {
        storedKeys = await this.getStoredKeysFromIndex(connection);
      } catch (err) {
        logger.error("Erro ao obter indice de chaves", err as Error);
      }

      const shouldUpdateIndex = !searchTerm && !limit;

      if (connection.authentication) {
        const filteredKeys = this.applyKeyFilters(
          storedKeys,
          searchTerm,
          inflatedLimit
        );
        const payload = await this.getKeysValue(
          filteredKeys,
          connection,
          undefined,
          shouldUpdateIndex,
          serverUnixTime
        );
        const finalPayload = limit ? payload.slice(0, limit) : payload;
        response.json(finalPayload);

        return;
      }

      const slabsOutput = await executeMemcachedCommand(
        "stats slabs",
        connection
      );

      const slabUsedMap = extractUsedChunksFromSlabs(slabsOutput);

      const slabIds = Array.from(slabUsedMap.keys());

      const keysInfoArrays = await Promise.all(
        slabIds.map(async (slabId) => {
          try {
            const dumpOutput = await executeMemcachedCommand(
              `stats cachedump ${slabId} 1000`,
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
      const slabKeys = keysInfo.map((info) => info.key);
      const allKeys = Array.from(new Set([...slabKeys, ...storedKeys])).sort();
      const filteredKeys = this.applyKeyFilters(
        allKeys,
        searchTerm,
        inflatedLimit
      );

      if (filteredKeys.length === 0) {
        response.json([]);
        return;
      }

      const payload = await this.getKeysValue(
        filteredKeys,
        connection,
        keysInfo,
        shouldUpdateIndex,
        serverUnixTime
      );

      const finalPayload = limit ? payload.slice(0, limit) : payload;
      response.json(finalPayload);

      this.getKeysValue(
        storedKeys,
        connection,
        keysInfo,
        true,
        serverUnixTime
      ).catch((error) => {
        logger.error(
          "Erro ao atualizar índice de chaves em segundo plano",
          error
        );
      });
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

      if (!isReservedKey(key)) {
        this.updateKeyIndex([key], connection, false);
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

      await connection.client.delete(<string>request.params.key);
      response.status(204).send();
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

      if (!isReservedKey(key)) {
        this.updateKeyIndex([key], connection, false);
      }
    } catch (error) {
      const message = `Erro ao obter chave ${request.params.key}`;
      logger.error(message, error);
      response.status(500).json({
        error: message
      });
    }
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

  private async getKeysValue(
    keys: string[],
    connection: MemcachedConnection,
    keysInfo?: Key[],
    updateIndex = true,
    serverUnixTime?: number
  ): Promise<KeyPayload[]> {
    const limit = pLimit(MAX_CONCURRENT_REQUESTS);
    const currentUnixTime =
      serverUnixTime ?? (await this.getServerUnixTime(connection));
    const filteredKeys = keys.filter((key) => !isReservedKey(key));

    const results = await Promise.all(
      filteredKeys.map((key) =>
        limit(async () => {
          try {
            const { value } = await connection.client.get(key);

            if (!value) {
              return null;
            }

            const info = keysInfo?.find((info) => info.key === key);

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

    const validKeys = <KeyPayload[]>(
      results.filter((item) => item !== null && !isReservedKey(item!.key))
    );

    if (updateIndex) {
      this.updateKeyIndex(validKeys, connection);
    }

    return validKeys;
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
    connection: MemcachedConnection
  ): Promise<string[]> {
    const indexKeys = await this.getIndexKeyList(connection);
    if (indexKeys.length === 0) {
      return [];
    }

    const keyLists = await Promise.all(
      indexKeys.map((indexKey) => this.getKeysFromIndexKey(connection, indexKey))
    );

    return Array.from(new Set(keyLists.flat())).sort();
  }

  private updateKeyIndex(
    keyList: Pick<KeyPayload, "key">[] | string[],
    connection: MemcachedConnection,
    replace: boolean = true
  ) {
    const keys =
      typeof keyList[0] === "string"
        ? keyList
        : keyList.map((item) => (item as KeyPayload).key);

    const handler = async (): Promise<void> => {
      let keysToStore: string[] = <string[]>keys;

      if (!replace) {
        const storedKeys = await this.getStoredKeysFromIndex(connection);
        const allKeys: string[] = Array.from(
          new Set([...storedKeys, ...keys])
        ).sort();

        keysToStore = allKeys;
      }

      await this.writeIndexShards(keysToStore, connection);
    };

    handler().catch((error) => logger.error(error));
  }

  private applyKeyFilters(
    keys: string[],
    search: string,
    limit?: number
  ): string[] {
    let filtered = [...keys];

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
