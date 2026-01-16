import { ReactNode, useCallback, useEffect, useState } from "react";
import { Key, StorageContext } from "../contexts/StorageContext";
import api, {
  clearStoragePassword,
  setStoragePassword as setStoragePasswordHeader
} from "@/ui/services/api";

export const StorageProvider = ({ children }: { children: ReactNode }) => {
  const [storage, setStorage] = useState<Record<string, unknown>>({});
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [storagePassword, setStoragePasswordState] = useState("");
  const [storageVersion, setStorageVersion] = useState(0);

  type GetKey = { status: boolean; item: { key: string; value: unknown } };
  type Default = { status: boolean };
  type GetAll = { status: boolean; items: { key: string; value: unknown }[] };
  type EncryptionStatus = { enabled: boolean };

  const refreshEncryptionStatus = useCallback(async () => {
    try {
      const { data } = await api.get<EncryptionStatus>("/storages/encryption");
      setEncryptionEnabled(!!data.enabled);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    refreshEncryptionStatus();
  }, [refreshEncryptionStatus]);

  useEffect(() => {
    setStorageVersion((prev) => prev + 1);
  }, [encryptionEnabled, storagePassword]);

  const setKey = async (key: string, value: unknown) => {
    try {
      await api.post<Default>("/storages", { key, value });
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };
  const getKey = async (key: string): Promise<Key | null> => {
    try {
      const {
        data: { item }
      } = await api.get<GetKey>(`/storages/${key}`);

      return { key: item.key, value: item.value };
    } catch (error) {
      console.error(error);
      return null;
    }
  };
  const deleteKey = async (key: string) => {
    try {
      await api.delete<Default>(`/storages/${key}`);

      return true;
    } catch (error) {
      return false;
    }
  };
  const getAllKeys = async () => {
    try {
      const { data } = await api.get<GetAll>("/storages");

      return data.items;
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  const setStoragePassword = async (password: string): Promise<boolean> => {
    if (!password) {
      return false;
    }

    setStoragePasswordHeader(password);

    try {
      if (encryptionEnabled) {
        await api.get("/storages");
      }
      setStoragePasswordState(password);
      return true;
    } catch (error) {
      clearStoragePassword();
      setStoragePasswordState("");
      return false;
    }
  };

  const resetStoragePassword = () => {
    clearStoragePassword();
    setStoragePasswordState("");
  };

  const enableEncryption = async (password: string): Promise<boolean> => {
    try {
      const { data } = await api.post<EncryptionStatus>(
        "/storages/encryption",
        {
          enabled: true,
          password
        }
      );
      if (!data.enabled) {
        return false;
      }
      setEncryptionEnabled(true);
      return await setStoragePassword(password);
    } catch (error) {
      return false;
    }
  };

  const disableEncryption = async (password: string): Promise<boolean> => {
    try {
      const { data } = await api.post<EncryptionStatus>(
        "/storages/encryption",
        {
          enabled: false,
          password
        }
      );
      if (data.enabled) {
        return false;
      }
      setEncryptionEnabled(false);
      resetStoragePassword();
      return true;
    } catch (error) {
      return false;
    }
  };

  const storageLocked = encryptionEnabled && !storagePassword;

  return (
    <StorageContext.Provider
      value={{
        deleteKey,
        getAllKeys,
        getKey,
        setKey,
        setStoragePassword,
        clearStoragePassword: resetStoragePassword,
        enableEncryption,
        disableEncryption,
        encryptionEnabled,
        storageLocked,
        storageVersion,
        storage
      }}
    >
      {children}
    </StorageContext.Provider>
  );
};
