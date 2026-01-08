import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
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
  const [totalKeyCount, setTotalKeyCount] = useState<number | undefined>(
    undefined
  );
  const [serverData, setServerData] = useState<ServerData | null>(null);
  const [error] = useState("");
  const activeConnectionIdRef = useRef(currentConnection.id);
  const isLoadingKeysRef = useRef(false);
  const loadingKeysConnectionRef = useRef<string>("");
  const isRefreshingKeyCountRef = useRef(false);
  const refreshingKeyCountConnectionRef = useRef<string>("");
  const initialKeyLoadPendingRef = useRef(false);
  const initialKeyLoadConnectionRef = useRef<string>("");

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

  const hasLoadedConnections = useRef(false);
  useEffect(() => {
    if (hasLoadedConnections.current) return;
    hasLoadedConnections.current = true;
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    activeConnectionIdRef.current = currentConnection.id;
  }, [currentConnection.id]);

  api.interceptors.response.use(
    (response) => response,
    (err) => {
      if (err.response && err.response.status === 401) {
        navigate("/");
      }
      return Promise.reject(err);
    }
  );

  const refreshKeyCount = useCallback(async () => {
    const connectionId = activeConnectionIdRef.current;
    if (!connectionId) return false;

    // Skip if a count refresh is already in-flight for this connection
    if (
      isRefreshingKeyCountRef.current &&
      refreshingKeyCountConnectionRef.current === connectionId
    ) {
      return false;
    }

    isRefreshingKeyCountRef.current = true;
    refreshingKeyCountConnectionRef.current = connectionId;

    try {
      const response = await api.get("/keys/count");
      const count = Number(response.data?.count);
      if (!Number.isFinite(count)) {
        throw new Error("Invalid key count response");
      }
      if (connectionId === activeConnectionIdRef.current) {
        setTotalKeyCount(count);
      }
      return true;
    } catch (_error) {
      return false;
    } finally {
      if (refreshingKeyCountConnectionRef.current === connectionId) {
        isRefreshingKeyCountRef.current = false;
        refreshingKeyCountConnectionRef.current = "";
      }
    }
  }, []);

  useEffect(() => {
    if (!isConnected || !currentConnection.id) return;

    const refresh = () => {
      refreshKeyCount();
    };

    refresh();
    const interval = setInterval(refresh, 10000);

    return () => clearInterval(interval);
  }, [isConnected, currentConnection.id, refreshKeyCount]);

  const handleLoadKeys = useCallback(
    async (showLoadingModal = true, search?: string, limit?: number) => {
      const connectionId = activeConnectionIdRef.current;
      // Avoid stacking identical key fetches for the same connection context
      if (
        connectionId &&
        isLoadingKeysRef.current &&
        loadingKeysConnectionRef.current === connectionId
      ) {
        return true;
      }

      // Skip if a key-count refresh is already in-flight for this connection
      if (
        connectionId &&
        isRefreshingKeyCountRef.current &&
        refreshingKeyCountConnectionRef.current === connectionId &&
        !(
          initialKeyLoadPendingRef.current &&
          initialKeyLoadConnectionRef.current === connectionId
        )
      ) {
        return true;
      }

      const fetchKeys = async (attempt: number): Promise<KeyData[]> => {
        const response = await api.get("/keys", {
          params: {
            search: search || undefined,
            limit: limit || undefined
          }
        });

        const payload = Array.isArray(response.data) ? response.data : [];

        if (payload.length === 0 && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return fetchKeys(1);
        }

        return [...payload].sort((a, b) => a.key.localeCompare(b.key));
      };

      try {
        isLoadingKeysRef.current = true;
        loadingKeysConnectionRef.current = connectionId;
        if (showLoadingModal) showLoading();
        const sortedKeys = await fetchKeys(0);
        if (connectionId === activeConnectionIdRef.current) {
          setKeys(sortedKeys);
        }
        if (showLoadingModal) dismissLoading();
        return true;
      } catch (_error) {
        if (showLoadingModal) dismissLoading();
        showAlert(t("errors.loadKeys"), "error");
        return false;
      } finally {
        if (
          initialKeyLoadPendingRef.current &&
          initialKeyLoadConnectionRef.current === connectionId
        ) {
          initialKeyLoadPendingRef.current = false;
          initialKeyLoadConnectionRef.current = "";
          dismissLoading();
        }
        if (loadingKeysConnectionRef.current === connectionId) {
          isLoadingKeysRef.current = false;
          loadingKeysConnectionRef.current = "";
        }
      }
    },
    // Only depends on alert/loading handlers; avoid re-creating each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAlert, showLoading, dismissLoading]
  );

  const handleFlushAllKeys = async () => {
    try {
      showLoading();
      await api.delete("/keys");
      setKeys([]);
      setTotalKeyCount(0);
      void refreshKeyCount();
      dismissLoading();
      showAlert(t("keyList.flushSuccess"), "success");
      return true;
    } catch (_error) {
      dismissLoading();
      showAlert(t("errors.flushKeys"), "error");
      return false;
    }
  };

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
      activeConnectionIdRef.current = connectionId;
      setIsConnected(true);
      initialKeyLoadPendingRef.current = true;
      initialKeyLoadConnectionRef.current = connectionId;

      const newConnection = { ...params, id: connectionId };
      setCurrentConnection(newConnection);
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
      activeConnectionIdRef.current = connection.id;
      await api.get("/connections");

      setIsConnected(true);
      setCurrentConnection(connection);
      initialKeyLoadPendingRef.current = true;
      initialKeyLoadConnectionRef.current = connection.id;
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
    activeConnectionIdRef.current = "";
    setIsConnected(false);
    setKeys([]);
    setTotalKeyCount(undefined);
    setCurrentConnection({
      host: "",
      port: 11211,
      name: "",
      id: "",
      timeout: 300
    });
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
      void refreshKeyCount();
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
      void refreshKeyCount();
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
      void refreshKeyCount();
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
      const nextList = hasMatch ? updatedList : [connectionWithoutId, ...prev];

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
        handleFlushAllKeys,
        handleCreateKey,
        handleEditKey,
        handleDeleteKey,
        handleTestConnection,
        handleEditConnection,
        handleDeleteConnection,
        handleLoadServerData,
        serverData,
        handleGetByKey,
        totalKeyCount,
        refreshKeyCount
      }}
    >
      {children}
    </ConnectionsContext.Provider>
  );
};
