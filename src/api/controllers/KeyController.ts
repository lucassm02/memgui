import { Request, Response } from "express";
import pLimit from "p-limit";
import { Key, MemcachedConnection } from "@/api/types";
import {
  connectionManager,
  extractKeysInfoFromDump,
  extractUsedChunksFromSlabs,
  logger,
  MAX_CONCURRENT_REQUESTS,
  ONE_DAY_IN_SECONDS,
  RESERVED_KEY
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
        const reservedData = await connection.client.get(RESERVED_KEY);

        if (reservedData.value) {
          storedKeys = JSON.parse(reservedData.value.toString());
        }
      } catch (err) {
        logger.error("Erro ao obter chave reservada", err as Error);
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

      if (key !== RESERVED_KEY) {
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

      if (key !== RESERVED_KEY) {
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

    const results = await Promise.all(
      keys.map((key) =>
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
      results.filter((item) => item !== null && item!.key !== RESERVED_KEY)
    );

    if (updateIndex) {
      this.updateKeyIndex(validKeys, connection);
    }

    return validKeys;
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
        const response = await connection.client.get(RESERVED_KEY);

        const storedKeys = response?.value
          ? JSON.parse(response?.value.toString())
          : [];

        const allKeys: string[] = Array.from(
          new Set([...storedKeys, ...keys])
        ).sort();

        keysToStore = allKeys;
      }

      await connection.client.set(RESERVED_KEY, JSON.stringify(keysToStore), {
        expires: ONE_DAY_IN_SECONDS
      });
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
