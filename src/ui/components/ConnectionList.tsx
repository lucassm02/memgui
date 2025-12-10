import {
  LinkIcon,
  SignalSlashIcon,
  TrashIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useConnections, useDarkMode, useMenu, useElectron } from "@/ui/hooks";

type Connection = {
  name: string;
  host: string;
  port: number;
  timeout: number;
  id?: string;
};

const ConnectionList = () => {
  const { menuIsOpen, closeMenu } = useMenu();
  const { darkMode } = useDarkMode();
  const { savedConnections, handleChoseConnection, handleDeleteConnection } =
    useConnections();
  const { t } = useTranslation();

  const navigate = useNavigate();
  const { enabled } = useElectron();
  async function choseConnection(connection: Connection) {
    const redirect = await handleChoseConnection(connection);

    if (redirect) {
      navigate("/panel");
    }
  }

  return (
    <>
      {menuIsOpen && (
        <div className={`fixed inset-0 bg-black/50 z-40`} onClick={closeMenu} />
      )}

      <div
        className={`fixed left-0 ${enabled ? "top-10" : "top-0"} h-screen w-80 z-50 transition-transform duration-300 shadow-lg
        ${
          darkMode
            ? "bg-gray-800 border-r border-gray-700"
            : "bg-white border-r border-gray-200"
        }
        ${menuIsOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <h3
              className={`text-sm font-medium ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {t("connectionList.title")}
            </h3>
            <button
              onClick={closeMenu}
              className="cursor-pointer p-1 rounded-md hover:bg-gray-700/50"
            >
              <XMarkIcon
                className={`w-6 h-6 ${
                  darkMode ? "text-gray-300" : "text-gray-600"
                }`}
              />
            </button>
          </div>

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

          {savedConnections.map((conn) => (
            <div
              key={`${conn.host}-${conn.port}`}
              className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer
                ${
                  darkMode
                    ? "border-gray-600 hover:bg-gray-700/40"
                    : "border-gray-200 hover:bg-gray-50"
                }
                transition-all duration-200 shadow-sm
              `}
              onClick={() => choseConnection(conn)}
            >
              <div className="flex-1">
                <div
                  className={`flex items-center gap-2 ${
                    darkMode ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  <LinkIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium">{conn.name}</span>
                </div>
                <div
                  className={`text-xs mt-1 ${
                    darkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {conn.host}:{conn.port}
                  <span className="ml-2 opacity-75">
                    ID: {conn.id?.slice(0, 8)}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConnection(conn);
                }}
                className={`cursor-pointer p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity
                  ${
                    darkMode
                      ? "text-red-400 hover:bg-gray-600"
                      : "text-red-600 hover:bg-gray-200"
                  }
                `}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default ConnectionList;
