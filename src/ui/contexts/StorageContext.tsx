import { createContext } from "react";

export type Key = { key: string; value: unknown };

export interface StorageContextType {
  setKey: (key: string, value: unknown) => Promise<boolean>;
  getKey: (key: string) => Promise<Key | null>;
  deleteKey: (key: string) => Promise<boolean>;
  getAllKeys: () => Promise<Key[]>;
  setStoragePassword: (password: string) => Promise<boolean>;
  clearStoragePassword: () => void;
  enableEncryption: (password: string) => Promise<boolean>;
  disableEncryption: (password: string) => Promise<boolean>;
  encryptionEnabled: boolean;
  storageLocked: boolean;
  storageVersion: number;
  storage: Record<string, unknown>;
}

export const StorageContext = createContext<StorageContextType | undefined>(
  undefined
);
