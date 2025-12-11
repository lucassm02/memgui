import {
  ArrowUturnLeftIcon,
  Bars3Icon,
  ChartBarIcon,
  LinkIcon,
  LinkSlashIcon,
  MoonIcon,
  ServerIcon,
  SunIcon
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import LanguageSelector from "./LanguageSelector";
import { useConnections, useDarkMode, useMenu } from "@/ui/hooks";
import { toneButton } from "@/ui/utils/buttonTone";

const ConnectedHeader = () => {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { currentConnection, handleDisconnect, handleLoadServerData } =
    useConnections();
  const { t } = useTranslation();

  const navigate = useNavigate();
  const location = useLocation();

  function disconnect() {
    handleDisconnect();
    navigate("/");
  }

  async function goToStatistics() {
    const redirect = await handleLoadServerData();

    if (redirect) {
      navigate("/statistics");
    }
  }

  async function goBack() {
    navigate("/panel");
  }

  const { openMenu } = useMenu();

  return (
    <>
      <header
        className={`relative p-4 border-b flex items-center justify-between ${
          darkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-gray-100 border-gray-200"
        }`}
      >
        <button
          onClick={openMenu}
          className={toneButton("neutral", darkMode, "icon")}
        >
          <Bars3Icon className="w-6 h-6" />
        </button>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            <div className="p-2 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
              <ServerIcon
                className={`w-6 h-6 ${
                  darkMode ? "text-blue-400" : "text-blue-600"
                }`}
              />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1
                  className={`text-xl font-bold leading-tight ${
                    darkMode ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  {currentConnection.name || t("app.name")}
                </h1>
                <span className="text-xs font-normal opacity-75">
                  {currentConnection.id?.slice(0, 8)}
                </span>
              </div>
              <div
                className={`flex items-center gap-2 text-sm leading-none ${
                  darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                <span>
                  {currentConnection.host}:{currentConnection.port}
                </span>
                <div className="relative flex items-center">
                  <span className="sr-only">connected</span>
                  <span className="w-2 h-2 rounded-full bg-green-400 opacity-75 animate-ping" />
                  <span className="absolute w-2 h-2 rounded-full bg-green-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {location.pathname === "/statistics" ? (
            <button
              onClick={goBack}
              className={toneButton("warning", darkMode, "sm")}
            >
              <ArrowUturnLeftIcon className="w-5 h-5" />
              <span className="text-sm">{t("header.back")}</span>
            </button>
          ) : (
            <button
              onClick={goToStatistics}
              className={toneButton("warning", darkMode, "sm")}
            >
              <ChartBarIcon className="w-5 h-5" />
              <span className="text-sm">{t("header.stats")}</span>
            </button>
          )}

          <button
            onClick={disconnect}
            className={toneButton("danger", darkMode, "sm")}
          >
            <LinkSlashIcon className="w-5 h-5" />
            <span className="text-sm">{t("header.disconnect")}</span>
          </button>

          <LanguageSelector />

          <button
            onClick={toggleDarkMode}
            className={toneButton("neutral", darkMode, "icon")}
          >
            {darkMode ? (
              <SunIcon className="w-6 h-6" />
            ) : (
              <MoonIcon className="w-6 h-6" />
            )}
          </button>
        </div>
      </header>
    </>
  );
};

export default ConnectedHeader;
