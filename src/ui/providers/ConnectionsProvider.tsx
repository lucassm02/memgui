import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Connection, ConnectionsContext, KeyData } from "../contexts";
import { useStorage } from "../hooks";
import { useModal } from "../hooks/useModal";
import api, { clearConnectionId, setConnectionId } from "@/ui/services/api";
import {
  getConnectionIdentity,
  isSameConnection as isSameConnectionByIdentity
} from "@/ui/utils/connectionIdentity";

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
    password: "",
    ssh: undefined
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
  const {
    showAlert,
    showLoading,
    dismissLoading,
    showConfirm,
    openConnectionModal
  } = useModal();
  const { getKey, setKey, storageVersion, encryptionEnabled } = useStorage();
  const { t } = useTranslation();

  const getIdentity = (
    connection: Omit<Connection, "id"> | Connection
  ): string => getConnectionIdentity({ ...connection, id: "" } as Connection);

  const buildSshPayload = (ssh?: Connection["ssh"]) => {
    if (!ssh) return undefined;
    const passwordValue = ssh.password;
    const privateKeyValue = ssh.privateKey?.trim();
    const hasPassword = !!passwordValue && passwordValue.trim().length > 0;
    const hasPrivateKey = !!privateKeyValue;
    const fingerprintValue = ssh.hostKeyFingerprint?.trim();
    return {
      port: ssh.port,
      username: ssh.username,
      ...(hasPassword ? { password: passwordValue } : {}),
      ...(hasPrivateKey ? { privateKey: privateKeyValue } : {}),
      ...(fingerprintValue ? { hostKeyFingerprint: fingerprintValue } : {})
    };
  };

  const canPersistSshSecrets = encryptionEnabled;

  const hasSshSecrets = useCallback((ssh?: Connection["ssh"]) => {
    if (!ssh) return false;
    return !!(
      (ssh.password && ssh.password.trim()) ||
      (ssh.privateKey && ssh.privateKey.trim())
    );
  }, []);

  const sanitizeSshForStorage = useCallback(
    (ssh?: Connection["ssh"]) => {
      if (!ssh) return undefined;
      if (canPersistSshSecrets) return ssh;
      const { password, privateKey, ...rest } = ssh;
      return rest;
    },
    [canPersistSshSecrets]
  );

  const sanitizeConnectionForStorage = useCallback(
    (connection: Connection): Connection => ({
      ...connection,
      ssh: sanitizeSshForStorage(connection.ssh)
    }),
    [sanitizeSshForStorage]
  );
  const ensureSshEncryption = (ssh?: Connection["ssh"]) => {
    if (!ssh) return true;
    if (encryptionEnabled) return true;
    showAlert(t("connectionModal.sshStorageWarning"), "warning");
    return false;
  };

  type SshHostKeyErrorPayload = {
    code: "SSH_HOST_KEY_UNVERIFIED" | "SSH_HOST_KEY_MISMATCH";
    fingerprint: string;
    expectedFingerprint?: string;
  };

  const parseSshHostKeyError = (
    error: unknown
  ): SshHostKeyErrorPayload | null => {
    const response = (error as { response?: { data?: unknown } })?.response;
    const data = response?.data as
      | {
          code?: string;
          fingerprint?: string;
          expectedFingerprint?: string;
        }
      | undefined;
    if (!data) return null;
    const code = data.code;
    if (
      code !== "SSH_HOST_KEY_UNVERIFIED" &&
      code !== "SSH_HOST_KEY_MISMATCH"
    ) {
      return null;
    }
    if (!data.fingerprint || typeof data.fingerprint !== "string") {
      return null;
    }
    return {
      code,
      fingerprint: data.fingerprint,
      expectedFingerprint:
        typeof data.expectedFingerprint === "string"
          ? data.expectedFingerprint
          : undefined
    };
  };

  const confirmSshHostKey = (
    params: Omit<Connection, "id">,
    hostKey: SshHostKeyErrorPayload,
    retry: (nextParams: Omit<Connection, "id">) => Promise<boolean>
  ) =>
    new Promise<boolean>((resolve) => {
      const isMismatch = hostKey.code === "SSH_HOST_KEY_MISMATCH";
      const message = isMismatch
        ? t("connectionModal.sshHostKeyMismatchMessage", {
            fingerprint: hostKey.fingerprint,
            expected: hostKey.expectedFingerprint ?? "-"
          })
        : t("connectionModal.sshHostKeyMessage", {
            fingerprint: hostKey.fingerprint
          });
      showConfirm({
        title: t(
          isMismatch
            ? "connectionModal.sshHostKeyMismatchTitle"
            : "connectionModal.sshHostKeyTitle"
        ),
        message,
        confirmLabel: t("connectionModal.sshHostKeyConfirm"),
        cancelLabel: t("connectionModal.sshHostKeyCancel"),
        onConfirm: async () => {
          if (!params.ssh) {
            resolve(false);
            return;
          }
          const updatedParams = {
            ...params,
            ssh: {
              ...params.ssh,
              hostKeyFingerprint: hostKey.fingerprint
            }
          };
          const ok = await retry(updatedParams);
          resolve(ok);
        },
        onCancel: () => resolve(false)
      });
    });

  const loadConnections = useCallback(async () => {
    const data = await getKey("CONNECTIONS");

    if (!data) return;

    const { value } = data;
    const storedConnections = value as Connection[];
    const sanitizedConnections = storedConnections.map((connection) =>
      sanitizeConnectionForStorage(connection)
    );

    if (
      !canPersistSshSecrets &&
      storedConnections.some((connection) => hasSshSecrets(connection.ssh))
    ) {
      await setKey("CONNECTIONS", sanitizedConnections);
    }

    setSavedConnections(sanitizedConnections);
  }, [
    getKey,
    setKey,
    canPersistSshSecrets,
    hasSshSecrets,
    sanitizeConnectionForStorage
  ]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections, storageVersion]);

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
    async (
      showLoadingModal = true,
      search?: string,
      limit?: number,
      options?: { force?: boolean }
    ) => {
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
        !options?.force &&
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

  const connectWithParams = async (
    params: Omit<Connection, "id">,
    options?: { skipHostKeyPrompt?: boolean }
  ) => {
    try {
      if (!ensureSshEncryption(params.ssh)) {
        return false;
      }
      showLoading();

      const { host, port, timeout, password, username, ssh } = params;

      const authentication =
        username || password ? { password, username } : undefined;
      const sshPayload = buildSshPayload(ssh);

      const payload: Record<string, unknown> = {
        host,
        port,
        connectionTimeout: timeout,
        authentication
      };
      if (sshPayload) {
        payload.ssh = sshPayload;
      }

      const response = await api.post("/connections", payload);
      const { connectionId } = response.data;
      setConnectionId(connectionId);
      activeConnectionIdRef.current = connectionId;
      setIsConnected(true);
      initialKeyLoadPendingRef.current = true;
      initialKeyLoadConnectionRef.current = connectionId;

      const newConnection = { ...params, id: connectionId };
      const storedConnection = sanitizeConnectionForStorage(newConnection);
      setCurrentConnection(storedConnection);
      setSavedConnections((prev) => {
        const filtered = prev.filter(
          (c) => getIdentity(c) !== getIdentity(storedConnection)
        );
        const updated = [storedConnection, ...filtered];
        setKey("CONNECTIONS", updated);
        return updated;
      });

      return true;
    } catch (error) {
      const hostKeyError = parseSshHostKeyError(error);
      if (hostKeyError && !options?.skipHostKeyPrompt) {
        dismissLoading();
        return await confirmSshHostKey(params, hostKeyError, (nextParams) =>
          connectWithParams(nextParams, { skipHostKeyPrompt: true })
        );
      }
      dismissLoading();
      showAlert(t("errors.connectionFailed"), "error");
      return false;
    }
  };

  const handleConnect = async (params: Omit<Connection, "id">) =>
    connectWithParams(params);

  const handleChoseConnection = async (params: Omit<Connection, "id">) => {
    const { host, name, port, timeout, password, username, ssh } = params;
    try {
      const incomingIdentity = getIdentity(params);
      const isAlreadyActive =
        isConnected &&
        currentConnection.id !== "" &&
        getIdentity(currentConnection) === incomingIdentity;
      if (isAlreadyActive) {
        return true;
      }

      const connection = savedConnections.find(
        (c) => getIdentity(c) === incomingIdentity
      );

      if (!ensureSshEncryption(ssh)) {
        return false;
      }

      if (ssh && !hasSshSecrets(ssh)) {
        showAlert(t("connectionModal.sshAuthRequired"), "error");
        openConnectionModal(
          connection ?? ({ ...params, id: "" } as Connection)
        );
        return false;
      }

      showLoading();

      if (!connection || !connection.id) {
        return await handleConnect({
          host,
          name,
          port,
          timeout,
          password,
          username,
          ssh
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
          username,
          ssh
        });
      }

      showAlert(t("errors.chooseConnection"), "error");
      return false;
    }
  };

  const testConnectionWithParams = async (
    params: Omit<Connection, "id">,
    options?: { skipHostKeyPrompt?: boolean }
  ): Promise<boolean> => {
    const { host, port, timeout, password, username, ssh } = params;
    let tempConnectionId = "";
    try {
      if (!ensureSshEncryption(ssh)) {
        return false;
      }
      showLoading();
      const authentication =
        username || password ? { password, username } : undefined;
      const sshPayload = buildSshPayload(ssh);

      const payload: Record<string, unknown> = {
        host,
        port,
        connectionTimeout: timeout,
        authentication
      };
      if (sshPayload) {
        payload.ssh = sshPayload;
      }

      const response = await api.post("/connections", payload);
      tempConnectionId = response.data?.connectionId ?? "";
      if (tempConnectionId) {
        setConnectionId(tempConnectionId);
        await api.delete("/connections");
      }
      return true;
    } catch (error) {
      const hostKeyError = parseSshHostKeyError(error);
      if (hostKeyError && !options?.skipHostKeyPrompt) {
        dismissLoading();
        return await confirmSshHostKey(params, hostKeyError, (nextParams) =>
          testConnectionWithParams(nextParams, { skipHostKeyPrompt: true })
        );
      }
      showAlert(t("errors.connectionFailed"), "error");
      return false;
    } finally {
      clearConnectionId();
      dismissLoading();
    }
  };

  const handleTestConnection = async (
    params: Omit<Connection, "id">
  ): Promise<boolean> => testConnectionWithParams(params);

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
      timeout: 300,
      ssh: undefined
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
    const connectionWithoutId = sanitizeConnectionForStorage({
      ...updatedConnection,
      id: ""
    });

    const isSameConnectionEntry = (conn?: Connection) => {
      if (!conn) return false;
      if (previousConnection?.id) {
        return conn.id === previousConnection.id;
      }
      if (previousConnection) {
        return isSameConnectionByIdentity(conn, previousConnection);
      }
      return (
        conn.id === updatedConnection.id ||
        isSameConnectionByIdentity(conn, updatedConnection)
      );
    };

    setSavedConnections((prev) => {
      const updatedList = prev.map((conn) =>
        isSameConnectionEntry(conn) ? { ...connectionWithoutId } : conn
      );
      const hasMatch = prev.some((conn) => isSameConnectionEntry(conn));
      const nextList = hasMatch ? updatedList : [connectionWithoutId, ...prev];

      setKey("CONNECTIONS", nextList);

      if (isSameConnectionEntry(currentConnection)) {
        setCurrentConnection(connectionWithoutId);
      }

      return nextList;
    });
  };

  const handleDeleteConnection = (connection: Connection) => {
    setSavedConnections((prev) => {
      const updated = prev.filter(
        (c) => !isSameConnectionByIdentity(c, connection)
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
