import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { KeyData } from "@/ui/contexts";
import { useDarkMode } from "@/ui/hooks/useDarkMode";
import { useElectron } from "@/ui/hooks/useElectron";
import { toneButton } from "@/ui/utils/buttonTone";

type DumpStatus =
  | "idle"
  | "prefetching"
  | "connecting"
  | "running"
  | "done"
  | "cancelled"
  | "error";

type DumpExportModalProps = {
  isOpen: boolean;
  connectionId: string;
  connectionName?: string;
  connectionHost?: string;
  connectionPort?: number;
  onClose: () => void;
};

type DumpMessage =
  | {
      type: "dump-start";
      total: number;
      batchSize: number;
      batchCount: number;
    }
  | {
      type: "dump-prefetch";
      total: number;
      batchSize: number;
      batchCount: number;
      indexCount?: number;
      cachedumpCount?: number;
    }
  | {
      type: "dump-batch";
      items: KeyData[];
      batchIndex: number;
      batchCount: number;
      processed: number;
      total: number;
      successCount: number;
      failureCount: number;
      progress: number;
      successRate: number;
    }
  | {
      type: "dump-complete";
      total: number;
      processed: number;
      successCount: number;
      failureCount: number;
      durationMs: number;
    }
  | {
      type: "dump-cancelled";
      total: number;
      processed: number;
      successCount: number;
      failureCount: number;
      durationMs: number;
    }
  | {
      type: "dump-error";
      message: string;
    };

const DEFAULT_BATCH_SIZE = 50;

const buildDumpFilename = (
  name?: string,
  host?: string,
  port?: number,
  timestamp?: string
) => {
  const base = name || (host ? `${host}-${port ?? ""}` : "memcached");
  const safeBase = base.replace(/[^a-zA-Z0-9-_]+/g, "_");
  const stamp = (timestamp || new Date().toISOString()).replace(/[:.]/g, "-");
  return `memgui-dump-${safeBase}-${stamp}.json`;
};

const resolveWsUrl = (path: string, connectionId: string) => {
  const origin = window.location.origin;
  const hasOrigin = origin && origin !== "null";
  const host = window.location.host;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  if (!hasOrigin && !host) {
    return null;
  }
  const base = hasOrigin ? origin : `${protocol}://${host}`;
  const wsBase = base.startsWith("http") ? base.replace(/^http/, "ws") : base;
  return `${wsBase}${path}?connectionId=${encodeURIComponent(connectionId)}`;
};

const DumpExportModal = ({
  isOpen,
  connectionId,
  connectionName,
  connectionHost,
  connectionPort,
  onClose
}: DumpExportModalProps) => {
  const { darkMode } = useDarkMode();
  const { enabled: electronEnabled } = useElectron();
  const { t } = useTranslation();

  const [status, setStatus] = useState<DumpStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchCount, setBatchCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadName, setDownloadName] = useState<string>("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveHandleName, setSaveHandleName] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const dataRef = useRef<KeyData[]>([]);
  const startedAtRef = useRef<string>("");
  const payloadRef = useRef<string | null>(null);
  const statusRef = useRef<DumpStatus>(status);
  const saveHandleRef = useRef<FileSystemFileHandle | null>(null);

  const supportsSavePicker =
    typeof (
      window as unknown as { showSaveFilePicker?: () => Promise<unknown> }
    ).showSaveFilePicker === "function";

  const statusLabel = useMemo(() => {
    switch (status) {
      case "connecting":
        return t("dump.preparing");
      case "prefetching":
        return t("dump.prefetching");
      case "running":
        return t("dump.running");
      case "done":
        return t("dump.done");
      case "cancelled":
        return t("dump.cancelled");
      case "error":
        return t("dump.error");
      default:
        return "";
    }
  }, [status, t]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!isOpen) {
      socketRef.current?.close();
      socketRef.current = null;
      payloadRef.current = null;
      saveHandleRef.current = null;
      return;
    }

    setStatus("idle");
    setProgress(0);
    setSuccessRate(0);
    setProcessed(0);
    setTotal(0);
    setBatchIndex(0);
    setBatchCount(0);
    setErrorMessage("");
    setSaveMessage("");
    setDownloadName("");
    setSaveHandleName("");
    dataRef.current = [];
    payloadRef.current = null;
    saveHandleRef.current = null;
    startedAtRef.current = "";

    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [isOpen, connectionId]);

  const handleCancel = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "cancel" }));
      socketRef.current.close();
    }
    setStatus("cancelled");
  };

  const handleClose = () => {
    if (status === "running" || status === "connecting") {
      handleCancel();
    }
    onClose();
  };

  const handleStartDump = () => {
    if (!connectionId) {
      setStatus("error");
      setErrorMessage(t("dump.error"));
      return;
    }

    if (
      status === "connecting" ||
      status === "running" ||
      status === "prefetching"
    ) {
      return;
    }

    socketRef.current?.close();
    socketRef.current = null;
    payloadRef.current = null;
    dataRef.current = [];

    setStatus("connecting");
    statusRef.current = "connecting";
    setProgress(0);
    setSuccessRate(0);
    setProcessed(0);
    setBatchIndex(0);
    if (total === 0) {
      setBatchCount(0);
    }
    setErrorMessage("");
    setSaveMessage("");
    setDownloadName("");
    startedAtRef.current = new Date().toISOString();

    const wsUrl = resolveWsUrl("/ws/dump", connectionId);
    if (!wsUrl) {
      setStatus("error");
      setErrorMessage(t("dump.error"));
      return;
    }

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({ type: "start", batchSize: DEFAULT_BATCH_SIZE })
      );
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as DumpMessage;
        if (!payload || typeof payload !== "object") {
          return;
        }

        switch (payload.type) {
          case "dump-start": {
            setStatus("running");
            setTotal(payload.total);
            setBatchCount(payload.batchCount);
            if (payload.total === 0) {
              setProgress(100);
            }
            break;
          }
          case "dump-batch": {
            dataRef.current.push(...payload.items);
            setProcessed(payload.processed);
            setTotal(payload.total);
            setBatchIndex(payload.batchIndex);
            setBatchCount(payload.batchCount);
            setProgress(payload.progress);
            setSuccessRate(payload.successRate);
            break;
          }
          case "dump-complete": {
            setStatus("done");
            setProcessed(payload.processed);
            setTotal(payload.total);
            setProgress(100);
            const rate =
              payload.total > 0
                ? Math.round((payload.successCount / payload.total) * 100)
                : 100;
            setSuccessRate(rate);
            const fileName = buildDumpFilename(
              connectionName,
              connectionHost,
              connectionPort,
              startedAtRef.current
            );
            const payloadContent = JSON.stringify(
              {
                exportedAt: startedAtRef.current,
                connection: {
                  name: connectionName || null,
                  host: connectionHost || null,
                  port: connectionPort || null
                },
                total: payload.total,
                successCount: payload.successCount,
                failureCount: payload.failureCount,
                items: dataRef.current
              },
              null,
              2
            );
            payloadRef.current = payloadContent;
            setDownloadName(fileName);
            break;
          }
          case "dump-cancelled": {
            setStatus("cancelled");
            setProcessed(payload.processed);
            setTotal(payload.total);
            const rate =
              payload.total > 0
                ? Math.round((payload.successCount / payload.total) * 100)
                : 0;
            setSuccessRate(rate);
            setProgress(
              payload.total > 0
                ? Math.round((payload.processed / payload.total) * 100)
                : 0
            );
            break;
          }
          case "dump-error": {
            setStatus("error");
            setErrorMessage(payload.message);
            break;
          }
          default:
            break;
        }
      } catch (_error) {
        setStatus("error");
        setErrorMessage(t("dump.error"));
      }
    };

    socket.onerror = () => {
      setStatus("error");
      setErrorMessage(t("dump.error"));
    };

    socket.onclose = (event) => {
      socketRef.current = null;
      if (
        statusRef.current === "connecting" ||
        statusRef.current === "prefetching" ||
        statusRef.current === "running"
      ) {
        setStatus("error");
        setErrorMessage(`${t("dump.error")} (${event.code})`);
      }
    };
  };

  const handlePrefetchDump = () => {
    if (!connectionId) {
      setStatus("error");
      setErrorMessage(t("dump.error"));
      return;
    }

    if (
      status === "connecting" ||
      status === "running" ||
      status === "prefetching"
    ) {
      return;
    }

    socketRef.current?.close();
    socketRef.current = null;
    payloadRef.current = null;

    setStatus("prefetching");
    statusRef.current = "prefetching";
    setProgress(0);
    setSuccessRate(0);
    setProcessed(0);
    setBatchIndex(0);
    setBatchCount(0);
    setErrorMessage("");
    setSaveMessage("");
    setDownloadName("");
    startedAtRef.current = "";

    const wsUrl = resolveWsUrl("/ws/dump", connectionId);
    if (!wsUrl) {
      setStatus("error");
      setErrorMessage(t("dump.error"));
      return;
    }

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({ type: "prefetch", batchSize: DEFAULT_BATCH_SIZE })
      );
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as DumpMessage;
        if (!payload || typeof payload !== "object") {
          return;
        }

        if (payload.type === "dump-prefetch") {
          setTotal(payload.total);
          setBatchCount(payload.batchCount);
          setProgress(0);
          setSuccessRate(0);
          setProcessed(0);
          setBatchIndex(0);
          statusRef.current = "idle";
          setStatus("idle");
          socket.close();
          return;
        }

        if (payload.type === "dump-error") {
          setStatus("error");
          setErrorMessage(payload.message);
          socket.close();
        }
      } catch (_error) {
        setStatus("error");
        setErrorMessage(t("dump.error"));
      }
    };

    socket.onerror = () => {
      setStatus("error");
      setErrorMessage(t("dump.error"));
    };

    socket.onclose = (event) => {
      socketRef.current = null;
      if (statusRef.current === "prefetching") {
        setStatus("error");
        setErrorMessage(`${t("dump.error")} (${event.code})`);
      }
    };
  };

  const handleSaveDump = async () => {
    const payload = payloadRef.current;
    if (!payload) {
      return;
    }

    setSaveMessage("");
    setErrorMessage("");

    if (saveHandleRef.current) {
      try {
        setIsSaving(true);
        const writable = await saveHandleRef.current.createWritable();
        await writable.write(payload);
        await writable.close();
        setSaveMessage(t("dump.saved"));
        return;
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setErrorMessage(t("dump.saveError"));
        }
      } finally {
        setIsSaving(false);
      }
    }

    const savePicker = (
      window as unknown as {
        showSaveFilePicker?: (options: {
          suggestedName?: string;
          types?: { description: string; accept: Record<string, string[]> }[];
        }) => Promise<{
          createWritable: () => Promise<{
            write: (data: string | Blob) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>;
      }
    ).showSaveFilePicker;

    if (savePicker) {
      try {
        setIsSaving(true);
        const handle = await savePicker({
          suggestedName:
            downloadName ||
            buildDumpFilename(connectionName, connectionHost, connectionPort),
          types: [
            {
              description: "JSON",
              accept: { "application/json": [".json"] }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(payload);
        await writable.close();
        setSaveMessage(t("dump.saved"));
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setErrorMessage(t("dump.saveError"));
        }
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      downloadName ||
      buildDumpFilename(connectionName, connectionHost, connectionPort);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`fixed ${
        electronEnabled ? "top-10 left-0 right-0 bottom-0" : "inset-0"
      } flex items-center justify-center bg-black/50 backdrop-blur-md z-50`}
    >
      <div
        className={`w-full max-w-xl p-6 rounded-xl shadow-xl border transition-all ${
          darkMode
            ? "bg-gray-900 text-gray-100 border-gray-700"
            : "bg-white text-gray-900 border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{t("dump.title")}</h3>
            <p
              className={`text-sm mt-1 ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {t("dump.description")}
            </p>
          </div>
          {status === "running" ||
          status === "connecting" ||
          status === "prefetching" ? (
            <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500" />
          ) : status === "done" ? (
            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
          ) : status === "error" ? (
          <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
        ) : null}
      </div>

      {supportsSavePicker ? (
        <div className="mt-5 space-y-2">
          <label
            className={`text-sm font-medium ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            {t("dump.saveLocation")}
          </label>
          <div
            className={`rounded-xl border-2 border-dashed p-4 transition-all ${
              darkMode
                ? "border-gray-700 bg-gray-900/40"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <button
              type="button"
              onClick={async () => {
                const picker = (
                  window as unknown as {
                    showSaveFilePicker?: (options: {
                      suggestedName?: string;
                      types?: {
                        description: string;
                        accept: Record<string, string[]>;
                      }[];
                    }) => Promise<FileSystemFileHandle>;
                  }
                ).showSaveFilePicker;

                if (!picker) {
                  return;
                }

                try {
                  const handle = await picker({
                    suggestedName:
                      downloadName ||
                      buildDumpFilename(
                        connectionName,
                        connectionHost,
                        connectionPort
                      ),
                    types: [
                      {
                        description: "JSON",
                        accept: { "application/json": [".json"] }
                      }
                    ]
                  });
                  saveHandleRef.current = handle;
                  setSaveHandleName(handle.name);
                } catch (error) {
                  if ((error as { name?: string }).name !== "AbortError") {
                    setErrorMessage(t("dump.saveError"));
                  }
                }
              }}
              className={toneButton("neutral", darkMode)}
            >
              {t("dump.chooseLocation")}
            </button>
            <p
              className={`mt-2 text-xs ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {t("dump.saveHint")}
            </p>
            {saveHandleName ? (
              <p
                className={`mt-2 text-xs ${
                  darkMode ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {t("dump.locationSelected")}: {saveHandleName}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {statusLabel ? (
        <p
          className={`mt-4 text-sm ${
            darkMode ? "text-gray-300" : "text-gray-600"
          }`}
          >
            {statusLabel}
          </p>
        ) : null}

        {status === "error" && errorMessage ? (
          <p className="mt-2 text-sm text-red-500">{errorMessage}</p>
        ) : null}
        {saveMessage ? (
          <p className="mt-2 text-sm text-emerald-500">{saveMessage}</p>
        ) : null}

        {total === 0 && status === "done" ? (
          <p
            className={`mt-4 text-sm ${
              darkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {t("dump.empty")}
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{t("dump.progress")}</span>
              <span>{progress}%</span>
            </div>
            <div
              className={`h-2 rounded-full overflow-hidden ${
                darkMode ? "bg-gray-800" : "bg-gray-200"
              }`}
            >
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="font-medium">{t("dump.items")}:</span>{" "}
                {processed}/{total}
              </div>
              <div>
                <span className="font-medium">{t("dump.successRate")}:</span>{" "}
                {successRate}%
              </div>
              {batchCount > 0 ? (
                <div>
                  <span className="font-medium">{t("dump.batch")}:</span>{" "}
                  {Math.min(batchIndex, batchCount)}/{batchCount}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          {status === "done" ? (
            <button
              onClick={handleSaveDump}
              className={`${toneButton("success", darkMode)} ${
                isSaving ? "opacity-70 cursor-wait" : ""
              }`}
              disabled={isSaving}
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              {t("dump.save")}
            </button>
          ) : null}
          {status === "running" ||
          status === "connecting" ||
          status === "prefetching" ? (
            <button
              onClick={handleCancel}
              className={toneButton("danger", darkMode)}
            >
              {t("dump.cancel")}
            </button>
          ) : status === "done" ? (
            <button
              onClick={handleClose}
              className={toneButton("neutral", darkMode)}
            >
              {t("dump.close")}
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className={toneButton("neutral", darkMode)}
              >
                {t("dump.close")}
              </button>
              <button
                onClick={handlePrefetchDump}
                className={`${toneButton("neutral", darkMode)} ${
                  connectionId ? "" : "opacity-50 cursor-not-allowed"
                }`}
                disabled={!connectionId}
              >
                <ArrowPathIcon className="w-5 h-5" />
                {t("dump.prefetch")}
              </button>
              <button
                onClick={handleStartDump}
                className={`${toneButton("success", darkMode)} ${
                  connectionId ? "" : "opacity-50 cursor-not-allowed"
                }`}
                disabled={!connectionId}
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                {t("dump.start")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DumpExportModal;
