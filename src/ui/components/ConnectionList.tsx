import {
  LinkIcon,
  PencilSquareIcon,
  PlusIcon,
  SignalSlashIcon,
  TrashIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { PlusCircleIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import StorageSecurityPanel from "./StorageSecurityPanel";
import { Connection } from "@/ui/contexts";
import {
  useConnections,
  useDarkMode,
  useMenu,
  useElectron,
  useModal
} from "@/ui/hooks";
import { toneButton } from "@/ui/utils/buttonTone";
import { getConnectionIdentity } from "@/ui/utils/connectionIdentity";

const ConnectionList = () => {
  const { menuIsOpen, closeMenu } = useMenu();
  const { darkMode } = useDarkMode();
  const {
    savedConnections,
    handleChoseConnection,
    handleDeleteConnection,
    currentConnection,
    isConnected,
    handleDisconnect
  } = useConnections();
  const { openConnectionModal } = useModal();
  const { t } = useTranslation();

  const navigate = useNavigate();
  const { enabled } = useElectron();
  async function choseConnection(connection: Connection) {
    const redirect = await handleChoseConnection(connection);

    if (redirect) {
      navigate("/panel");
    }
  }

  const sortedConnections = useMemo(
    () =>
      [...savedConnections].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [savedConnections]
  );

  const isConnectionActive = (connection: Connection) => {
    if (!isConnected) return false;
    const matchById =
      currentConnection.id !== "" && connection.id === currentConnection.id;
    const matchByAddress =
      getConnectionIdentity(connection) ===
      getConnectionIdentity(currentConnection);

    return matchById || matchByAddress;
  };

  const handleCreateConnection = () => {
    closeMenu();
    if (isConnected) {
      handleDisconnect();
      navigate("/");
    }
    openConnectionModal();
  };

  return (
    <>
      {menuIsOpen && (
        <div className={`fixed inset-0 bg-black/50 z-40`} onClick={closeMenu} />
      )}

      <div
        className={`fixed left-0 ${enabled ? "top-10" : "top-0"} bottom-0 w-80 z-50 transition-transform duration-300 shadow-lg
        ${
          darkMode
            ? "bg-gray-800 border-r border-gray-700"
            : "bg-white border-r border-gray-200"
        }
        ${menuIsOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="flex h-full flex-col p-4">
          <div
            className={`-mx-4 -mt-4 px-4 pt-4 pb-3 mb-5 border-b ${
              darkMode
                ? "bg-gray-900/80 border-gray-700/80"
                : "bg-gray-100 border-gray-200"
            }`}
          >
            <div className="flex justify-between items-center">
              <h3
                className={`text-sm font-medium ${
                  darkMode ? "text-gray-200" : "text-gray-700"
                }`}
              >
                {t("connectionList.title")}
              </h3>
              <button
                onClick={closeMenu}
                className={`${toneButton("neutral", darkMode, "icon")} !p-1`}
              >
                <XMarkIcon
                  className={`w-6 h-6 ${
                    darkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateConnection}
            className={`${toneButton("success", darkMode)} w-full justify-center`}
          >
            <PlusCircleIcon className="w-5 h-5" />
            <span>{t("connectionHome.createButton")}</span>
          </button>

          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            <div className="space-y-2">
              {savedConnections.length === 0 && (
                <div
                  className={`p-4 text-center rounded-xl flex flex-col items-center gap-2 ${
                    darkMode
                      ? "bg-gray-700/30 text-gray-400"
                      : "bg-gray-50 text-gray-500"
                  }`}
                >
                  <SignalSlashIcon className="w-8 h-8 text-gray-400" />
                  <p>{t("connectionList.empty")}</p>
                </div>
              )}

              {sortedConnections.map((conn) => {
                const isActive = isConnectionActive(conn);
                return (
                  <div
                    key={getConnectionIdentity(conn)}
                    className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer
                      ${darkMode ? "border-gray-600 hover:bg-gray-700/40" : "border-gray-200 hover:bg-gray-50"}
                      ${
                        isActive
                          ? darkMode
                            ? "border-emerald-400/70 bg-emerald-500/10 hover:bg-emerald-500/15"
                            : "border-emerald-400/70 bg-emerald-500/10 hover:bg-emerald-500/20"
                          : ""
                      }
                      transition-all duration-200 shadow-sm`}
                    onClick={() => choseConnection(conn)}
                  >
                    <div className="flex-1">
                      <div
                        className={`flex items-center gap-2 ${
                          darkMode ? "text-gray-100" : "text-gray-900"
                        }`}
                      >
                        <LinkIcon
                          className={`w-4 h-4 ${
                            isActive ? "text-emerald-400" : "text-blue-400"
                          }`}
                        />
                        <span className="text-sm font-medium">{conn.name}</span>
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          darkMode ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        {conn.host}:{conn.port}
                      </div>
                    </div>

                    {!isConnected && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openConnectionModal(conn);
                          }}
                          className={`${toneButton("primary", darkMode, "icon")} !p-1`}
                          aria-label={t("connectionList.edit")}
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConnection(conn);
                          }}
                          className={`${toneButton("danger", darkMode, "icon")} !p-1`}
                          aria-label={t("common.delete")}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`mt-4 border-t pt-4 shrink-0 ${
              darkMode ? "border-gray-700/70" : "border-gray-200"
            }`}
          >
            <StorageSecurityPanel />
          </div>
        </div>
      </div>
    </>
  );
};

export default ConnectionList;
