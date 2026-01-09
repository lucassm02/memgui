import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import Datastore from "@seald-io/nedb";
import { Request, Response } from "express";

import { logger } from "@/api/utils";

const APP_NAME = "MemGUI";
const DB_FILENAME = "database.db";
const ENCRYPTION_META_KEY = "__memgui_encryption__";
const ENCRYPTION_VERSION = 1;
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_LENGTH = 32;
const ENCRYPTION_DERIVED_LENGTH = 64;
const ENCRYPTION_IV_LENGTH = 12;
const ENCRYPTION_SALT_LENGTH = 16;

type EncryptionConfig = {
  enabled: boolean;
  salt: string;
  verifier: string;
  version: number;
};

type EncryptionPayload = {
  value: string;
  iv: string;
  tag: string;
  encrypted: true;
};

type StorageRecord = {
  key: string;
  value: unknown;
  iv?: string;
  tag?: string;
  encrypted?: boolean;
};

class StorageAuthError extends Error {
  statusCode = 401;

  constructor(message = "Storage password required") {
    super(message);
    this.name = "StorageAuthError";
  }
}

const scryptAsync = promisify(crypto.scrypt);

function resolveDataDir(): string {
  const envDir = process.env.MEMGUI_DATA_DIR;
  if (envDir) {
    return envDir;
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    return appData
      ? path.join(appData, APP_NAME)
      : path.join(os.homedir(), "AppData", "Roaming", APP_NAME);
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, APP_NAME);
  }

  return path.join(os.homedir(), ".config", APP_NAME);
}

function resolveDatabasePath(): string {
  const dataDir = resolveDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, DB_FILENAME);
}

class StorageController {
  db!: Datastore;
  private encryptionConfig: EncryptionConfig | null = null;
  private encryptionConfigLoaded = false;
  private encryptionHydrated = false;

  constructor() {
    this.db = new Datastore({
      filename: resolveDatabasePath(),
      autoload: true
    });
  }

  async getEncryptionStatus(_: Request, response: Response): Promise<void> {
    try {
      const config = await this.getEncryptionConfig();
      response.status(200).json({ enabled: !!config?.enabled });
    } catch (error) {
      logger.error(error);
      response.status(500).json({ enabled: false });
    }
  }

  async updateEncryption(request: Request, response: Response): Promise<void> {
    try {
      const enabled = request.body?.enabled;
      const password = request.body?.password;

      if (typeof enabled !== "boolean") {
        response.status(400).json({ error: "Missing encryption flag" });
        return;
      }

      if (typeof password !== "string" || password.length === 0) {
        response.status(400).json({ error: "Missing storage password" });
        return;
      }

      const currentConfig = await this.getEncryptionConfig();

      if (enabled) {
        if (currentConfig?.enabled) {
          await this.verifyPassword(password, currentConfig);
          response.status(200).json({ enabled: true });
          return;
        }

        const salt = crypto.randomBytes(ENCRYPTION_SALT_LENGTH);
        const derived = await this.deriveKey(password, salt);
        const newConfig: EncryptionConfig = {
          enabled: true,
          salt: salt.toString("base64"),
          verifier: derived.verifier.toString("base64"),
          version: ENCRYPTION_VERSION
        };
        await this.saveEncryptionConfig(newConfig);
        this.encryptionHydrated = false;
        await this.encryptAllItems(derived.key);
        response.status(200).json({ enabled: true });
        return;
      }

      if (!currentConfig?.enabled) {
        response.status(200).json({ enabled: false });
        return;
      }

      const derived = await this.verifyPassword(password, currentConfig);
      await this.decryptAllItems(derived.key);
      await this.saveEncryptionConfig(null);
      this.encryptionHydrated = false;
      response.status(200).json({ enabled: false });
    } catch (error) {
      if (error instanceof StorageAuthError) {
        response.status(401).json({ error: error.message });
        return;
      }

      logger.error(error);
      response.status(500).json({ enabled: false });
    }
  }

  async putItem(request: Request, response: Response): Promise<void> {
    try {
      const { key, value } = request.body;

      if (key === ENCRYPTION_META_KEY) {
        response.status(400).json({ success: false });
        return;
      }

      const encryption = await this.getEncryptionContext(request);
      const document = encryption
        ? this.buildEncryptedRecord(key, value, encryption.key)
        : { key, value };

      await this.db.removeAsync({ key }, { multi: true });
      await this.db.insertAsync(document);
      await this.compactDatabase();

      response.status(201).json({ success: true });
    } catch (error) {
      if (error instanceof StorageAuthError) {
        response.status(401).json({ success: false });
        return;
      }

      logger.error(error);
      response.status(500).json({ success: false });
    }
  }
  async getItem(request: Request, response: Response): Promise<void> {
    try {
      const { key } = request.params;

      if (key === ENCRYPTION_META_KEY) {
        response.status(404).json({ status: false, item: null });
        return;
      }

      const encryption = await this.getEncryptionContext(request);
      const data = await this.db.findOneAsync({ key }, { _id: 0 });

      if (!data) {
        response.status(404).json({ status: false, item: null });
        return;
      }

      const value = encryption
        ? this.decryptRecordValue(data as StorageRecord, encryption.key)
        : data.value;

      response.status(200).json({ status: true, item: { key, value } });
    } catch (error) {
      if (error instanceof StorageAuthError) {
        response.status(401).json({ status: false });
        return;
      }

      logger.error(error);
      response.status(500).json({ status: false });
    }
  }
  async getItems(request: Request, response: Response): Promise<void> {
    try {
      const encryption = await this.getEncryptionContext(request);
      const items = await this.db.findAsync(
        { key: { $ne: ENCRYPTION_META_KEY } },
        { _id: 0 }
      );
      const payload = items.map((item: StorageRecord) => ({
        key: item.key,
        value: encryption
          ? this.decryptRecordValue(item, encryption.key)
          : item.value
      }));
      response.status(200).json({ status: true, items: payload });
    } catch (error) {
      if (error instanceof StorageAuthError) {
        response.status(401).json({ status: false });
        return;
      }

      logger.error(error);
      response.status(500).json({ status: false });
    }
  }
  async deleteItem(request: Request, response: Response): Promise<void> {
    try {
      const { key } = request.params;

      if (key === ENCRYPTION_META_KEY) {
        response.status(400).json({ success: false });
        return;
      }

      await this.getEncryptionContext(request);
      await this.db.removeAsync({ key }, { multi: true });
      await this.compactDatabase();
      response.status(201).json({ success: true });
    } catch (error) {
      if (error instanceof StorageAuthError) {
        response.status(401).json({ success: false });
        return;
      }

      response.status(500).json({ success: false });
      logger.error(error);
    }
  }

  private async getEncryptionConfig(): Promise<EncryptionConfig | null> {
    if (this.encryptionConfigLoaded) {
      return this.encryptionConfig;
    }

    const data = await this.db.findOneAsync(
      { key: ENCRYPTION_META_KEY },
      { _id: 0, value: 1 }
    );
    const config = data?.value;
    if (this.isEncryptionConfig(config)) {
      this.encryptionConfig = config;
    } else {
      this.encryptionConfig = null;
    }
    this.encryptionConfigLoaded = true;
    return this.encryptionConfig;
  }

  private async saveEncryptionConfig(
    config: EncryptionConfig | null
  ): Promise<void> {
    if (config) {
      await this.db.updateAsync(
        { key: ENCRYPTION_META_KEY },
        { key: ENCRYPTION_META_KEY, value: config },
        { upsert: true }
      );
    } else {
      await this.db.removeAsync({ key: ENCRYPTION_META_KEY }, {});
    }
    this.encryptionConfig = config;
    this.encryptionConfigLoaded = true;
  }

  private isEncryptionConfig(value: unknown): value is EncryptionConfig {
    if (!value || typeof value !== "object") {
      return false;
    }

    const config = value as EncryptionConfig;
    return (
      typeof config.enabled === "boolean" &&
      typeof config.salt === "string" &&
      typeof config.verifier === "string" &&
      typeof config.version === "number"
    );
  }

  private getPasswordFromRequest(request: Request): string | null {
    const headerPassword = request.headers["x-storage-password"];
    if (typeof headerPassword === "string" && headerPassword.length > 0) {
      return headerPassword;
    }

    const bodyPassword = request.body?.password;
    if (typeof bodyPassword === "string" && bodyPassword.length > 0) {
      return bodyPassword;
    }

    return null;
  }

  private async getEncryptionContext(request: Request): Promise<{
    key: Buffer;
  } | null> {
    const config = await this.getEncryptionConfig();
    if (!config?.enabled) {
      return null;
    }

    const password = this.getPasswordFromRequest(request);
    if (!password) {
      throw new StorageAuthError();
    }

    const derived = await this.deriveKey(
      password,
      Buffer.from(config.salt, "base64")
    );
    const storedVerifier = Buffer.from(config.verifier, "base64");
    if (
      storedVerifier.length !== derived.verifier.length ||
      !crypto.timingSafeEqual(storedVerifier, derived.verifier)
    ) {
      throw new StorageAuthError("Invalid storage password");
    }

    await this.ensureEncryptedData(derived.key);

    return { key: derived.key };
  }

  private async verifyPassword(
    password: string,
    config: EncryptionConfig
  ): Promise<{ key: Buffer; verifier: Buffer }> {
    const derived = await this.deriveKey(
      password,
      Buffer.from(config.salt, "base64")
    );
    const storedVerifier = Buffer.from(config.verifier, "base64");
    if (
      storedVerifier.length !== derived.verifier.length ||
      !crypto.timingSafeEqual(storedVerifier, derived.verifier)
    ) {
      throw new StorageAuthError("Invalid storage password");
    }

    return derived;
  }

  private async deriveKey(
    password: string,
    salt: Buffer
  ): Promise<{
    key: Buffer;
    verifier: Buffer;
  }> {
    const derived = (await scryptAsync(
      password,
      salt,
      ENCRYPTION_DERIVED_LENGTH
    )) as Buffer;
    return {
      key: derived.subarray(0, ENCRYPTION_KEY_LENGTH),
      verifier: derived.subarray(ENCRYPTION_KEY_LENGTH)
    };
  }

  private serializeValue(value: unknown): string {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? "null" : serialized;
  }

  private deserializeValue(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private buildEncryptedRecord(
    key: string,
    value: unknown,
    encryptionKey: Buffer
  ): StorageRecord & EncryptionPayload {
    const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      encryptionKey,
      iv
    );
    const payload = this.serializeValue(value);
    const encrypted = Buffer.concat([
      cipher.update(payload, "utf8"),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    return {
      key,
      value: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      encrypted: true
    };
  }

  private decryptRecordValue(record: StorageRecord, key: Buffer): unknown {
    if (!record.encrypted || !record.iv || !record.tag) {
      return record.value;
    }

    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(record.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(record.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(String(record.value), "base64"),
      decipher.final()
    ]).toString("utf8");

    return this.deserializeValue(decrypted);
  }

  private async encryptAllItems(encryptionKey: Buffer): Promise<void> {
    const items = await this.db.findAsync(
      { key: { $ne: ENCRYPTION_META_KEY } },
      { _id: 0 }
    );

    for (const item of items as StorageRecord[]) {
      if (item.encrypted) {
        continue;
      }
      const encrypted = this.buildEncryptedRecord(
        item.key,
        item.value,
        encryptionKey
      );
      await this.db.updateAsync({ key: item.key }, encrypted, { multi: true });
    }

    await this.compactDatabase();
  }

  private async decryptAllItems(encryptionKey: Buffer): Promise<void> {
    const items = await this.db.findAsync(
      { key: { $ne: ENCRYPTION_META_KEY } },
      { _id: 0 }
    );

    for (const item of items as StorageRecord[]) {
      if (!item.encrypted) {
        continue;
      }
      const value = this.decryptRecordValue(item, encryptionKey);
      await this.db.updateAsync(
        { key: item.key },
        { key: item.key, value },
        { multi: true }
      );
    }

    await this.compactDatabase();
  }

  private async ensureEncryptedData(encryptionKey: Buffer): Promise<void> {
    if (this.encryptionHydrated) {
      return;
    }

    const needsEncryption = await this.db.findOneAsync(
      { key: { $ne: ENCRYPTION_META_KEY }, encrypted: { $ne: true } },
      { _id: 0, key: 1 }
    );
    if (needsEncryption) {
      await this.encryptAllItems(encryptionKey);
    }
    this.encryptionHydrated = true;
  }

  private async compactDatabase(): Promise<void> {
    try {
      await this.db.compactDatafileAsync();
    } catch (error) {
      logger.warn("Falha ao compactar storage", error as Error);
    }
  }
}

export const makeStorageController = () => new StorageController();
