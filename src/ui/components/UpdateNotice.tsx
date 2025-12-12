import { useEffect, useMemo, useState } from "react";

import { useDarkMode } from "../hooks/useDarkMode";
import { useElectron } from "../hooks/useElectron";
import { toneButton } from "../utils/buttonTone";

type UpdatePayload = {
  version?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string;
  message?: string;
};

type UpdateStatus = "available" | "downloaded" | "error";

type UpdateState = {
  status: UpdateStatus;
  payload: UpdatePayload;
};

const UpdateNotice = () => {
  const { darkMode } = useDarkMode();
  const { enabled, getInstance } = useElectron();
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const electron = getInstance();
    if (!electron) return;

    const handleAvailable = (
      _event: Electron.IpcRendererEvent,
      payload: UpdatePayload
    ) => {
      setUpdateState({ status: "available", payload });
    };

    const handleDownloaded = (
      _event: Electron.IpcRendererEvent,
      payload: UpdatePayload
    ) => {
      setUpdateState({ status: "downloaded", payload });
    };

    const handleError = (
      _event: Electron.IpcRendererEvent,
      payload: UpdatePayload
    ) => {
      setUpdateState({
        status: "error",
        payload: {
          message: payload?.message ?? "Falha ao buscar atualização"
        }
      });
    };

    electron.ipcRenderer.on("auto-update-available", handleAvailable);
    electron.ipcRenderer.on("auto-update-downloaded", handleDownloaded);
    electron.ipcRenderer.on("auto-update-error", handleError);

    return () => {
      electron.ipcRenderer.removeListener(
        "auto-update-available",
        handleAvailable
      );
      electron.ipcRenderer.removeListener(
        "auto-update-downloaded",
        handleDownloaded
      );
      electron.ipcRenderer.removeListener("auto-update-error", handleError);
    };
  }, [enabled, getInstance]);

  const status = updateState?.status ?? null;
  const description =
    status === "downloaded"
      ? "Download concluído. Reinicie para aplicar a atualização."
      : status === "available"
        ? "Baixando em segundo plano, você pode continuar usando o app."
        : (updateState?.payload?.message ?? "Falha ao verificar atualização.");

  const releaseNotes = useMemo(() => {
    if (!updateState?.payload?.releaseNotes) return "";
    return updateState.payload.releaseNotes.trim();
  }, [updateState?.payload?.releaseNotes]);

  const versionLabel = useMemo(() => {
    const { payload } = updateState || {};
    if (!payload) return "";
    return payload.releaseName || payload.version || "";
  }, [updateState]);

  const releaseDateLabel = useMemo(() => {
    const rawDate = updateState?.payload?.releaseDate;
    if (!rawDate) return "";
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString();
  }, [updateState?.payload?.releaseDate]);

  const summaryMessage = useMemo(() => {
    if (status !== "error") return description;
    if (!description) return "";
    const firstLine = description.split(/\r?\n/)[0] ?? "";
    if (firstLine.length <= 220) return firstLine;
    return `${firstLine.slice(0, 220)}…`;
  }, [status, description]);

  if (!updateState) return null;

  const cardSurface = darkMode
    ? "bg-gray-900 border-gray-700 text-white"
    : "bg-white border-gray-200 text-gray-900";

  const softText = darkMode ? "text-gray-300" : "text-gray-700";
  const mutedText = darkMode ? "text-gray-400" : "text-gray-600";

  const handleDismiss = () => {
    setUpdateState(null);
    setIsInstalling(false);
    setShowErrorDetails(false);
  };

  const handleInstall = () => {
    const electron = getInstance();
    if (!electron) return;
    setIsInstalling(true);
    electron.ipcRenderer.send("auto-update-install");
  };

  return (
    <div className="fixed top-14 right-4 z-[70] w-[28rem] max-w-[calc(100%-1.5rem)]">
      <div
        className={`border shadow-2xl rounded-xl p-4 backdrop-blur-sm ${cardSurface}`}
        style={{ WebkitAppRegion: "no-drag" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold">
              {status === "downloaded"
                ? "Atualização pronta para instalar"
                : status === "available"
                  ? "Nova versão disponível"
                  : "Atualização falhou"}
              {versionLabel && ` • ${versionLabel}`}
            </div>
            <p className={`text-xs leading-relaxed ${softText}`}>
              {status === "error" ? summaryMessage : description}
            </p>
            {releaseDateLabel && (
              <p className={`text-[11px] ${mutedText}`}>
                Publicado em {releaseDateLabel}
              </p>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className={`p-1 rounded-lg transition hover:bg-white/10 ${
              darkMode ? "text-gray-300" : "text-gray-500"
            }`}
            aria-label="Fechar aviso de atualização"
          >
            ×
          </button>
        </div>

        {status !== "error" && releaseNotes && (
          <div
            className={`mt-3 border rounded-lg max-h-48 overflow-auto text-sm whitespace-pre-wrap leading-relaxed ${
              darkMode
                ? "bg-gray-800/70 border-gray-700 text-gray-200"
                : "bg-gray-50 border-gray-200 text-gray-800"
            }`}
          >
            <div className="p-3">{releaseNotes}</div>
          </div>
        )}

        {status === "error" && showErrorDetails && description && (
          <div
            className={`mt-3 border rounded-lg max-h-48 overflow-auto text-sm whitespace-pre-wrap leading-relaxed ${
              darkMode
                ? "bg-gray-800/70 border-gray-700 text-gray-200"
                : "bg-gray-50 border-gray-200 text-gray-800"
            }`}
          >
            <div className="p-3">{description}</div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {status === "downloaded" ? (
            <>
              <button
                onClick={handleDismiss}
                className={toneButton("neutral", darkMode, "sm")}
              >
                Depois
              </button>
              <button
                onClick={handleInstall}
                className={`${toneButton(
                  "primary",
                  darkMode,
                  "sm"
                )} disabled:opacity-60 disabled:cursor-not-allowed`}
                disabled={isInstalling}
              >
                {isInstalling ? "Reiniciando..." : "Instalar agora"}
              </button>
            </>
          ) : status === "available" ? (
            <div
              className={`px-3 py-1.5 text-xs rounded-lg ${
                darkMode
                  ? "bg-white/5 text-gray-200"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Baixando atualização...
            </div>
          ) : (
            <div className="flex gap-2">
              {description && description.length > summaryMessage.length && (
                <button
                  onClick={() => setShowErrorDetails((prev) => !prev)}
                  className={toneButton("neutral", darkMode, "sm")}
                >
                  {showErrorDetails ? "Ocultar detalhes" : "Ver detalhes"}
                </button>
              )}
              <button
                onClick={handleDismiss}
                className={toneButton("warning", darkMode, "sm")}
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotice;
