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
    const limitParam = Number(request.query.limit);
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

    try {
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
          limit
        );
        const payload = await this.getKeysValue(
          filteredKeys,
          connection,
          undefined,
          shouldUpdateIndex
        );
        response.json(payload);
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
        limit
      );

      if (filteredKeys.length === 0) {
        response.json([]);
        return;
      }

      const payload = await this.getKeysValue(
        filteredKeys,
        connection,
        keysInfo,
        shouldUpdateIndex
      );

      response.json(payload);
    } catch (error) {
      const message = "Falha ao recuperar chaves";
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

  private async getKeysValue(
    keys: string[],
    connection: MemcachedConnection,
    keysInfo?: Key[],
    updateIndex = true
  ): Promise<KeyPayload[]> {
    const limit = pLimit(MAX_CONCURRENT_REQUESTS);

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
            const currentUnixTime = Math.floor(Date.now() / 1000);

            const timeUntilExpiration =
              expiration > 0 ? expiration - currentUnixTime : 0;

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
