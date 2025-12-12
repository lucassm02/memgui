import {
  ArrowPathIcon,
  SparklesIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
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

  if (!updateState) return null;

  const { status } = updateState;
  const description =
    status === "downloaded"
      ? "Download concluído. Reinicie para aplicar a atualização."
      : status === "available"
        ? "Baixando em segundo plano, você pode continuar usando o app."
        : (updateState.payload.message ?? "Falha ao verificar atualização.");

  const cardSurface = darkMode
    ? "bg-gray-900 border-gray-700 text-white"
    : "bg-white border-gray-200 text-gray-900";

  const softText = darkMode ? "text-gray-300" : "text-gray-700";
  const mutedText = darkMode ? "text-gray-400" : "text-gray-600";

  const handleDismiss = () => {
    setUpdateState(null);
    setIsInstalling(false);
  };

  const handleInstall = () => {
    const electron = getInstance();
    if (!electron) return;
    setIsInstalling(true);
    electron.ipcRenderer.send("auto-update-install");
  };

  const iconColor =
    status === "downloaded"
      ? "text-green-400"
      : status === "available"
        ? "text-blue-400"
        : "text-amber-400";

  return (
    <div className="fixed top-14 right-4 z-[70] w-[28rem] max-w-[calc(100%-1.5rem)]">
      <div
        className={`border shadow-2xl rounded-xl p-4 backdrop-blur-sm ${cardSurface}`}
        style={{ WebkitAppRegion: "no-drag" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {status === "downloaded" ? (
              <ArrowPathIcon className={`w-6 h-6 ${iconColor}`} />
            ) : (
              <SparklesIcon className={`w-6 h-6 ${iconColor}`} />
            )}
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
                {description}
              </p>
              {releaseDateLabel && (
                <p className={`text-[11px] ${mutedText}`}>
                  Publicado em {releaseDateLabel}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className={`p-1 rounded-lg transition hover:bg-white/10 ${
              darkMode ? "text-gray-300" : "text-gray-500"
            }`}
            aria-label="Fechar aviso de atualização"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {releaseNotes && (
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
            <button
              onClick={handleDismiss}
              className={toneButton("warning", darkMode, "sm")}
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotice;
