import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useTranslation } from "react-i18next";

import { KeyData } from "@/ui/contexts";
import { useDarkMode } from "@/ui/hooks/useDarkMode";
import { useElectron } from "@/ui/hooks/useElectron";
import { toneButton } from "@/ui/utils/buttonTone";

type ImportStatus =
  | "idle"
  | "ready"
  | "connecting"
  | "running"
  | "done"
  | "cancelled"
  | "error";

type DumpImportModalProps = {
  isOpen: boolean;
  connectionId: string;
  onClose: () => void;
  onImportComplete?: () => void;
};

type ImportMessage =
  | {
      type: "import-start";
      total: number;
      batchSize: number;
      batchCount: number;
    }
  | {
      type: "import-batch";
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
      type: "import-complete";
      total: number;
      processed: number;
      successCount: number;
      failureCount: number;
      durationMs: number;
    }
  | {
      type: "import-cancelled";
      total: number;
      processed: number;
      successCount: number;
      failureCount: number;
      durationMs: number;
    }
  | {
      type: "import-error";
      message: string;
    };

const DEFAULT_BATCH_SIZE = 50;

const resolveDumpItems = (payload: unknown): KeyData[] | null => {
  const items = Array.isArray(payload)
    ? payload
    : (payload as { items?: unknown })?.items;

  if (!Array.isArray(items)) {
    return null;
  }

  const results: KeyData[] = [];

  for (const entry of items) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as {
      key?: unknown;
      value?: unknown;
      size?: unknown;
      timeUntilExpiration?: unknown;
    };

    const key = typeof record.key === "string" ? record.key : "";
    if (!key) {
      continue;
    }

    if (record.value === undefined) {
      continue;
    }

    const value =
      typeof record.value === "string" ? record.value : String(record.value);
    const size = typeof record.size === "number" ? record.size : 0;
    const timeUntilExpiration =
      typeof record.timeUntilExpiration === "number"
        ? record.timeUntilExpiration
        : undefined;

    results.push({ key, value, size, timeUntilExpiration });
  }

  return results;
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

const DumpImportModal = ({
  isOpen,
  connectionId,
  onClose,
  onImportComplete
}: DumpImportModalProps) => {
  const { darkMode } = useDarkMode();
  const { enabled: electronEnabled } = useElectron();
  const { t } = useTranslation();

  const [status, setStatus] = useState<ImportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchCount, setBatchCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const itemsRef = useRef<KeyData[]>([]);
  const cursorRef = useRef(0);
  const batchSizeRef = useRef(DEFAULT_BATCH_SIZE);
  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const statusRef = useRef<ImportStatus>(status);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "ready":
        return t("dumpImport.ready");
      case "connecting":
        return t("dumpImport.preparing");
      case "running":
        return t("dumpImport.running");
      case "done":
        return t("dumpImport.done");
      case "cancelled":
        return t("dumpImport.cancelled");
      case "error":
        return t("dumpImport.error");
      default:
        return "";
    }
  }, [status, t]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const canPickFile = status !== "running" && status !== "connecting";
  const canStart = status === "ready" && !!connectionId;

  const cleanupSocket = () => {
    socketRef.current?.close();
    socketRef.current = null;
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupSocket();
      return;
    }

    setStatus("idle");
    statusRef.current = "idle";
    setProgress(0);
    setSuccessRate(0);
    setProcessed(0);
    setTotal(0);
    setBatchIndex(0);
    setBatchCount(0);
    setErrorMessage("");
    setFileError("");
    setFileName("");
    itemsRef.current = [];
    cursorRef.current = 0;
    batchSizeRef.current = DEFAULT_BATCH_SIZE;
    cancelRef.current = false;

    return () => {
      cleanupSocket();
    };
  }, [isOpen]);

  const loadDumpFile = async (file: File) => {
    setFileError("");
    setErrorMessage("");
    setStatus("idle");
    statusRef.current = "idle";
    setFileName(file.name);
    setProgress(0);
    setSuccessRate(0);
    setProcessed(0);
    setBatchIndex(0);
    setBatchCount(0);
    setTotal(0);

    try {
      const text = await file.text();
      const sanitized = text.replace(/^\uFEFF/, "");
      const parsed = JSON.parse(sanitized) as unknown;
      const resolved = resolveDumpItems(parsed);
      if (!resolved) {
        setFileError(t("dumpImport.invalidFile"));
        itemsRef.current = [];
        setTotal(0);
        setStatus("error");
        statusRef.current = "error";
        return;
      }

      if (resolved.length === 0) {
        setFileError(t("dumpImport.empty"));
        itemsRef.current = [];
        setTotal(0);
        setStatus("error");
        statusRef.current = "error";
        return;
      }

      itemsRef.current = resolved;
      setTotal(resolved.length);
      setStatus("ready");
      statusRef.current = "ready";
    } catch (_error) {
      setFileError(t("dumpImport.invalidFile"));
      itemsRef.current = [];
      setTotal(0);
      setStatus("error");
      statusRef.current = "error";
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await loadDumpFile(file);
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    await loadDumpFile(file);
  };

  const sendNextBatch = () => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (cancelRef.current) {
      return;
    }

    const items = itemsRef.current;
    if (cursorRef.current >= items.length) {
      return;
    }

    const batch = items
      .slice(cursorRef.current, cursorRef.current + batchSizeRef.current)
      .map(({ key, value, timeUntilExpiration }) => ({
        key,
        value,
        timeUntilExpiration
      }));

    cursorRef.current += batch.length;
    socket.send(JSON.stringify({ type: "batch", items: batch }));
  };

  const startImport = () => {
    if (!connectionId) {
      setStatus("error");
      statusRef.current = "error";
      setErrorMessage(t("dumpImport.error"));
      return;
    }

    if (itemsRef.current.length === 0) {
      setFileError(t("dumpImport.empty"));
      setStatus("error");
      statusRef.current = "error";
      return;
    }

    cancelRef.current = false;
    cursorRef.current = 0;
    setErrorMessage("");
    setFileError("");
    setStatus("connecting");
    statusRef.current = "connecting";
    setProgress(0);
    setSuccessRate(0);
    setProcessed(0);
    setBatchIndex(0);
    setBatchCount(0);

    const wsUrl = resolveWsUrl("/ws/import", connectionId);
    if (!wsUrl) {
      setStatus("error");
      statusRef.current = "error";
      setErrorMessage(t("dumpImport.error"));
      return;
    }
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "start",
          total: itemsRef.current.length,
          batchSize: DEFAULT_BATCH_SIZE
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ImportMessage;
        if (!payload || typeof payload !== "object") {
          return;
        }

        switch (payload.type) {
          case "import-start": {
            setStatus("running");
            statusRef.current = "running";
            setTotal(payload.total);
            setBatchCount(payload.batchCount);
            batchSizeRef.current = payload.batchSize || DEFAULT_BATCH_SIZE;
            if (payload.total === 0) {
              setProgress(100);
            }
            sendNextBatch();
            break;
          }
          case "import-batch": {
            setProcessed(payload.processed);
            setTotal(payload.total);
            setBatchIndex(payload.batchIndex);
            setBatchCount(payload.batchCount);
            setProgress(payload.progress);
            setSuccessRate(payload.successRate);
            sendNextBatch();
            break;
          }
          case "import-complete": {
            setStatus("done");
            statusRef.current = "done";
            setProcessed(payload.processed);
            setTotal(payload.total);
            setProgress(100);
            const rate =
              payload.total > 0
                ? Math.round((payload.successCount / payload.total) * 100)
                : 100;
            setSuccessRate(rate);
            cleanupSocket();
            if (onImportComplete) {
              onImportComplete();
            }
            break;
          }
          case "import-cancelled": {
            setStatus("cancelled");
            statusRef.current = "cancelled";
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
            cleanupSocket();
            break;
          }
          case "import-error": {
            setStatus("error");
            statusRef.current = "error";
            setErrorMessage(payload.message || t("dumpImport.error"));
            cleanupSocket();
            break;
          }
          default:
            break;
        }
      } catch (_error) {
        setStatus("error");
        statusRef.current = "error";
        setErrorMessage(t("dumpImport.error"));
        cleanupSocket();
      }
    };

    socket.onerror = () => {
      setStatus("error");
      statusRef.current = "error";
      setErrorMessage(t("dumpImport.error"));
    };

    socket.onclose = (event) => {
      socketRef.current = null;
      if (
        statusRef.current === "connecting" ||
        statusRef.current === "running"
      ) {
        setStatus("error");
        setErrorMessage(`${t("dumpImport.error")} (${event.code})`);
      }
    };
  };

  const handleCancel = () => {
    cancelRef.current = true;
    statusRef.current = "cancelled";
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
            <h3 className="text-lg font-semibold">{t("dumpImport.title")}</h3>
            <p
              className={`text-sm mt-1 ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {t("dumpImport.description")}
            </p>
          </div>
          {status === "running" || status === "connecting" ? (
            <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500" />
          ) : status === "done" ? (
            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
          ) : status === "error" ? (
            <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <label
            className={`text-sm font-medium ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            {t("dumpImport.fileLabel")}
          </label>
          <div
            role="button"
            tabIndex={canPickFile ? 0 : -1}
            aria-label={t("dumpImport.chooseFile")}
            onClick={() => {
              if (canPickFile) {
                handlePickFile();
              }
            }}
            onKeyDown={(event) => {
              if (!canPickFile) {
                return;
              }
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handlePickFile();
              }
            }}
            className={`rounded-xl border-2 border-dashed p-5 transition-all ${
              dragActive
                ? "border-blue-500 bg-blue-500/10"
                : darkMode
                  ? "border-gray-700 bg-gray-900/40"
                  : "border-gray-200 bg-gray-50"
            } ${
              canPickFile
                ? "cursor-pointer hover:border-blue-500/60 hover:bg-blue-500/5"
                : "cursor-not-allowed opacity-60"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              disabled={!canPickFile}
              className="sr-only"
            />
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-lg border ${
                  darkMode
                    ? "border-gray-700 bg-gray-800 text-gray-100"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                <ArrowUpTrayIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {t("dumpImport.chooseFile")}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    darkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {t("dumpImport.fileHint")}
                </p>
                {fileName ? (
                  <p
                    className={`mt-2 text-xs ${
                      darkMode ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {t("dumpImport.fileSelected")}: {fileName}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {fileError ? (
            <p className="text-sm text-red-500">{fileError}</p>
          ) : null}
        </div>

        {statusLabel ? (
          <p
            className={`mt-4 text-sm ${
              darkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {statusLabel}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-2 text-sm text-red-500">{errorMessage}</p>
        ) : null}

        {total > 0 ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{t("dumpImport.progress")}</span>
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
                <span className="font-medium">{t("dumpImport.items")}:</span>{" "}
                {processed}/{total}
              </div>
              <div>
                <span className="font-medium">
                  {t("dumpImport.successRate")}:
                </span>{" "}
                {successRate}%
              </div>
              {batchCount > 0 ? (
                <div>
                  <span className="font-medium">{t("dumpImport.batch")}:</span>{" "}
                  {Math.min(batchIndex, batchCount)}/{batchCount}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          {status === "running" || status === "connecting" ? (
            <button
              onClick={handleCancel}
              className={toneButton("danger", darkMode)}
            >
              {t("dumpImport.cancel")}
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className={toneButton("neutral", darkMode)}
              >
                {t("dumpImport.close")}
              </button>
              <button
                onClick={startImport}
                className={`${toneButton("success", darkMode)} ${
                  canStart ? "" : "opacity-50 cursor-not-allowed"
                }`}
                disabled={!canStart}
              >
                <ArrowUpTrayIcon className="w-5 h-5" />
                {t("dumpImport.start")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DumpImportModal;
