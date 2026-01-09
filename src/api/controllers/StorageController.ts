import fs from "fs";
import os from "os";
import path from "path";
import Datastore from "@seald-io/nedb";
import { Request, Response } from "express";

import { logger } from "@/api/utils";

const APP_NAME = "MemGUI";
const DB_FILENAME = "database.db";

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
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      APP_NAME
    );
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

  constructor() {
    this.db = new Datastore({
      filename: resolveDatabasePath(),
      autoload: true
    });
  }

  async putItem(request: Request, response: Response): Promise<void> {
    try {
      const { key, value } = request.body;

      const data = await this.db.findOneAsync({ key }, { _id: 0, value: 1 });
      const document = { key, value };

      if (data) {
        await this.db.updateAsync({ key }, { key, value });
      } else {
        await this.db.insertAsync(document);
      }

      response.status(201).json({ success: true });
    } catch (error) {
      logger.error(error);
      response.status(500).json({ success: false });
    }
  }
  async getItem(request: Request, response: Response): Promise<void> {
    try {
      const { key } = request.params;

      const data = await this.db.findOneAsync({ key }, { _id: 0, value: 1 });

      if (!data) {
        response.status(404).json({ status: false, item: null });
        return;
      }

      const { value } = data;

      response.status(200).json({ status: true, item: { key, value } });
    } catch (error) {
      logger.error(error);
      response.status(500).json({ status: false });
    }
  }
  async getItems(_: Request, response: Response): Promise<void> {
    try {
      const value = await this.db.findAsync({}, { _id: 0, key: 1, value: 1 });
      response.status(200).json({ status: true, items: value });
    } catch (error) {
      logger.error(error);
      response.status(500).json({ status: false });
    }
  }
  async deleteItem(request: Request, response: Response): Promise<void> {
    try {
      const { key } = request.params;

      await this.db.removeAsync({ key }, {});
      response.status(201).json({ success: true });
    } catch (error) {
      response.status(500).json({ success: false });
      logger.error(error);
    }
  }
}

export const makeStorageController = () => new StorageController();
