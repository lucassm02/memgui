import { ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Connection, ConnectionsContext, KeyData } from "../contexts";
import { useStorage } from "../hooks";
import { useModal } from "../hooks/useModal";
import api, { clearConnectionId, setConnectionId } from "@/ui/services/api";

export interface ServerData {
  status: string;
  connectionId: string;
  host: string;
  port: number;
  lastActive: string;
  serverInfo: ServerInfo;
}

export interface ServerInfo {
  pid: string;
  uptime: string;
  version: string;
  max_connections: string;
  curr_connections: string;
  total_connections: string;
  threads: string;
  cmd_get: string;
  cmd_set: string;
  get_hits: string;
  get_misses: string;
  bytes_read: string;
  bytes_written: string;
  limit_maxbytes: string;
  bytes: string;
  expired_unfetched: string;
  evictions: string;
  reclaimed: string;
  cpu_usage: string;
  latency: string;
  requests_per_second: string;
  slabs: Slab[];
}

export interface Slab {
  id: number;
  chunk_size: number;
  total_chunks: number;
  used_chunks: number;
  free_chunks: number;
  get_hits: number;
}

export const ConnectionsProvider = ({ children }: { children: ReactNode }) => {
  const [savedConnections, setSavedConnections] = useState<Connection[]>([]);
  const [currentConnection, setCurrentConnection] = useState<Connection>({
    host: "",
    port: 11211,
    name: "",
    id: "",
    timeout: 300,
    username: "",
    password: ""
  });

  const [isConnected, setIsConnected] = useState(false);
  const [keys, setKeys] = useState<KeyData[]>([]);
  const [serverData, setServerData] = useState<ServerData | null>(null);
  const [error] = useState("");

  const navigate = useNavigate();
  const { showAlert, showLoading, dismissLoading } = useModal();
  const { getKey, setKey } = useStorage();
  const { t } = useTranslation();

  const loadConnections = useCallback(async () => {
    const data = await getKey("CONNECTIONS");

    if (!data) return;

    const { value } = data;

    setSavedConnections(value as Connection[]);
  }, [getKey]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  api.interceptors.response.use(
    (response) => response,
    (err) => {
      if (err.response && err.response.status === 401) {
        navigate("/");
      }
      return Promise.reject(err);
    }
  );

  const handleConnect = async (params: Omit<Connection, "id">) => {
    try {
      showLoading();

      const { host, port, timeout, password, username } = params;

      const authentication =
        username || password ? { password, username } : undefined;

      const response = await api.post("/connections", {
        host,
        port,
        connectionTimeout: timeout,
        authentication
      });
      const { connectionId } = response.data;
      setConnectionId(connectionId);
      setIsConnected(true);

      const newConnection = { ...params, id: connectionId };
      setSavedConnections((prev) => {
        const filtered = prev.filter((c) => c.host !== host || c.port !== port);
        const updated = [newConnection, ...filtered];
        setKey("CONNECTIONS", updated);
        return updated;
      });

      return true;
    } catch (_error) {
      dismissLoading();
      showAlert(t("errors.connectionFailed"), "error");
      return false;
    }
  };

  const handleChoseConnection = async (params: Omit<Connection, "id">) => {
    const { host, name, port, timeout, password, username } = params;
    try {
      showLoading();

      const connection = savedConnections.find(
        (c) => c.host === host && c.port === port
      );

      if (!connection || !connection.id) {
        return await handleConnect({
          host,
          name,
          port,
          timeout,
          password,
          username
        });
      }

      setConnectionId(connection.id);
      await api.get("/connections");

      setIsConnected(true);
      setCurrentConnection(connection);
      dismissLoading();
      return true;
    } catch (err) {
      dismissLoading();
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 400 || status === 404) {
        return await handleConnect({
          host,
          name,
          port,
          timeout,
          password,
          username
        });
      }

      showAlert(t("errors.chooseConnection"), "error");
      return false;
    }
  };

  const handleTestConnection = async (
    params: Omit<Connection, "id">
  ): Promise<boolean> => {
    const { host, port, timeout, password, username } = params;
    let tempConnectionId = "";
    try {
      showLoading();
      const authentication =
        username || password ? { password, username } : undefined;

      const response = await api.post("/connections", {
        host,
        port,
        connectionTimeout: timeout,
        authentication
      });
      tempConnectionId = response.data?.connectionId ?? "";
      if (tempConnectionId) {
        setConnectionId(tempConnectionId);
        await api.delete("/connections");
      }
      return true;
    } catch (_error) {
      showAlert(t("errors.connectionFailed"), "error");
      return false;
    } finally {
      clearConnectionId();
      dismissLoading();
    }
  };

  const handleLoadServerData = async (showLoadingModal = true) => {
    try {
      if (showLoadingModal) showLoading();
      const response = await api.get("/connections");

      setServerData({ ...response.data });
      if (showLoadingModal) dismissLoading();
      return true;
    } catch (_error) {
      if (showLoadingModal) dismissLoading();
      showAlert(t("errors.loadServerData"), "error");
      return false;
    }
  };

  const handleDisconnect = () => {
    clearConnectionId();
    setIsConnected(false);
    setKeys([]);
    setCurrentConnection({
      host: "",
      port: 11211,
      name: "",
      id: "",
      timeout: 300
    });
  };

  const handleLoadKeys = async (showLoadingModal = true) => {
    try {
      if (showLoadingModal) showLoading();
      const response = await api.get("/keys");
      const sortedKeys = [...response.data].sort((a, b) =>
        a.key.localeCompare(b.key)
      );
      setKeys(sortedKeys);
      if (showLoadingModal) dismissLoading();
      return true;
    } catch (_error) {
      if (showLoadingModal) dismissLoading();
      showAlert(t("errors.loadKeys"), "error");
      return false;
    }
  };

  const handleCreateKey = async (newKey: KeyData) => {
    try {
      const newList = [
        ...keys,
        {
          ...newKey,
          size: new Blob([newKey.value]).size,
          timeUntilExpiration: newKey.timeUntilExpiration ?? 0
        }
      ].sort((a, b) => a.key.localeCompare(b.key));
      setKeys(newList);
      await api.post("/keys", {
        key: newKey.key,
        value: newKey.value,
        expires: newKey.timeUntilExpiration
      });
      dismissLoading();
      return true;
    } catch (_error) {
      dismissLoading();
      showAlert(t("errors.createKey"), "error");
      return false;
    }
  };

  const handleEditKey = async (updatedKey: KeyData) => {
    try {
      showLoading();
      setKeys((prevKeys) =>
        prevKeys.map((k) =>
          k.key === updatedKey.key
            ? {
                ...updatedKey,
                size: new Blob([updatedKey.value]).size,
                timeUntilExpiration: updatedKey.timeUntilExpiration ?? 0
              }
            : k
        )
      );
      await api.post("/keys", {
        key: updatedKey.key,
        value: updatedKey.value,
        expires: updatedKey.timeUntilExpiration
      });
      dismissLoading();
      return true;
    } catch (_error) {
      dismissLoading();
      showAlert(t("errors.editKey"), "error");
      return false;
    }
  };

  const handleDeleteKey = async (key: string) => {
    try {
      await api.delete(`/keys/${key}`);
      setKeys((prevKeys) => prevKeys.filter((k) => k.key !== key));
      return true;
    } catch (_error) {
      showAlert(t("errors.deleteKey"), "error");
      return false;
    }
  };

  const handleGetByKey = async (
    key: string
  ): Promise<{ key: string; value: string } | null> => {
    try {
      const { data } = await api.get(`/keys/${key}`);

      return data;
    } catch (_error) {
      return null;
    }
  };

  const handleEditConnection = (
    updatedConnection: Connection,
    previousConnection?: Connection
  ) => {
    const connectionWithoutId = { ...updatedConnection, id: "" };

    const isSameConnection = (conn?: Connection) => {
      if (!conn) return false;
      if (previousConnection?.id) {
        return conn.id === previousConnection.id;
      }
      if (previousConnection) {
        return (
          conn.host === previousConnection.host &&
          conn.port === previousConnection.port
        );
      }
      return conn.id === updatedConnection.id;
    };

    setSavedConnections((prev) => {
      const updatedList = prev.map((conn) =>
        isSameConnection(conn) ? { ...connectionWithoutId } : conn
      );
      const hasMatch = prev.some((conn) => isSameConnection(conn));
      const nextList = hasMatch
        ? updatedList
        : [connectionWithoutId, ...prev];

      setKey("CONNECTIONS", nextList);

      if (isSameConnection(currentConnection)) {
        setCurrentConnection(connectionWithoutId);
      }

      return nextList;
    });
  };

  const handleDeleteConnection = (connection: Connection) => {
    setSavedConnections((prev) => {
      const updated = prev.filter(
        (c) => c.host !== connection.host || c.port !== connection.port
      );
      setKey("CONNECTIONS", updated);
      return updated;
    });
  };

  return (
    <ConnectionsContext.Provider
      value={{
        savedConnections,
        currentConnection,
        isConnected,
        keys,
        error,
        handleConnect,
        handleChoseConnection,
        handleDisconnect,
        handleLoadKeys,
        handleCreateKey,
        handleEditKey,
        handleDeleteKey,
        handleTestConnection,
        handleEditConnection,
        handleDeleteConnection,
        handleLoadServerData,
        serverData,
        handleGetByKey
      }}
    >
      {children}
    </ConnectionsContext.Provider>
  );
};
