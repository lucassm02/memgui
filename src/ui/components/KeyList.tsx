/* eslint-disable react-hooks/exhaustive-deps */
import {
  ArrowPathIcon,
  DocumentMagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { useConnections } from "../hooks/useConnections";
import { useDarkMode } from "../hooks/useDarkMode";
import { useModal } from "../hooks/useModal";
import CreateKeyModal from "./CreateKeyModal";
import Disclaimer from "./Disclaimer";
import EditKeyModal from "./EditKeyModal";
import ViewDataModal from "./ViewDataModal";

const KeyList = () => {
  const { darkMode } = useDarkMode();
  const {
    keys,
    handleLoadKeys,
    handleDeleteKey,
    handleCreateKey,
    handleEditKey,
    currentConnection
  } = useConnections();

  const { openCreateModal, openEditModal, openViewDataModal } = useModal();
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [maxItems, setMaxItems] = useState(10);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    const show = !!(currentConnection.username && currentConnection.password);
    setShowDisclaimer(show);
  }, [currentConnection.password, currentConnection.username]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoUpdate) {
      interval = setInterval(() => {
        handleLoadKeys(false, searchTerm, maxItems);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
    // handleLoadKeys identity is stable enough; omit from deps to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUpdate, searchTerm, maxItems]);

  const lastLoadParams = useRef<string>("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const currentKey = `${searchTerm}|${maxItems}`;
      if (lastLoadParams.current === currentKey) return;
      lastLoadParams.current = currentKey;

      const showLoading = searchTerm.trim() === "";
      handleLoadKeys(showLoading, searchTerm, maxItems);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, maxItems]);

  const filteredKeys = keys;

  return (
    <div
      className={`w-full px-6 max-w-7xl mx-auto mt-10 transition-all ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      <Disclaimer
        className="mt-10 mb-10"
        showDisclaimer={showDisclaimer}
        hideDisclaimer={() => setShowDisclaimer(false)}
      >
        <Trans
          i18nKey="keyList.authWarning"
          components={{ strong: <strong /> }}
        />
      </Disclaimer>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t("keyList.title")}</h2>

        <div className="flex gap-2">
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white transition-all shadow-sm cursor-pointer"
          >
            <PlusIcon className="w-5 h-5" />
            {t("keyList.create")}
          </button>

          <button
            onClick={() => handleLoadKeys(true, searchTerm, maxItems)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm ${
              darkMode
                ? "bg-gray-700 hover:bg-gray-600 text-white"
                : "bg-gray-200 hover:bg-gray-300 text-gray-800"
            } cursor-pointer`}
          >
            <ArrowPathIcon className="w-5 h-5" />
            {t("keyList.refresh")}
          </button>

          <button
            onClick={() => setAutoUpdate((prev) => !prev)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm cursor-pointer ${
              autoUpdate
                ? darkMode
                  ? "bg-blue-700 hover:bg-blue-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
                : darkMode
                  ? "bg-gray-700 hover:bg-gray-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
            }`}
          >
            <ArrowPathIcon
              className={`w-5 h-5 ${autoUpdate ? "animate-spin" : ""}`}
            />
            {t("keyList.autoRefresh")}
          </button>
        </div>
      </div>

      <div
        className={`p-3 rounded-lg mb-4 flex items-center justify-between ${
          darkMode ? "bg-gray-800" : "bg-gray-200"
        } shadow-md`}
      >
        <input
          type="text"
          placeholder={t("keyList.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm ${
            darkMode
              ? "bg-gray-900 text-gray-100 placeholder-gray-400"
              : "bg-white text-gray-700 placeholder-gray-500 border border-gray-300"
          }`}
        />

        <select
          value={maxItems}
          onChange={(e) => setMaxItems(Number(e.target.value))}
          className={`ml-4 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
            darkMode
              ? "bg-gray-900 text-gray-100 border-gray-700"
              : "bg-white text-gray-700 border border-gray-300"
          } cursor-pointer`}
        >
          {[5, 10, 15, 20, 50, 100].map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
      </div>

      <div
        className={`overflow-hidden mb-10 rounded-lg shadow ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <table className="w-full text-sm text-left">
          <thead
            className={`text-xs uppercase ${
              darkMode
                ? "bg-gray-700 text-gray-300"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            <tr>
              <th className="px-6 py-3">{t("keyList.columns.key")}</th>
              <th className="px-6 py-3">{t("keyList.columns.value")}</th>
              <th className="px-6 py-3">{t("keyList.columns.expiration")}</th>
              <th className="px-6 py-3">{t("keyList.columns.size")}</th>
              <th className="px-6 py-3 text-right">
                {t("keyList.columns.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredKeys.length > 0 ? (
              filteredKeys.slice(0, maxItems).map((item) => (
                <tr
                  key={item.key}
                  className={`border-b transition-all ${
                    darkMode
                      ? "border-gray-700 hover:bg-gray-700 "
                      : "border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  <td
                    className={`px-6 py-4 truncate max-w-[300px] ${
                      darkMode ? "text-gray-100" : "text-gray-800"
                    }`}
                  >
                    {item.key}
                  </td>
                  <td
                    className={`px-6 py-4 truncate max-w-[250px] ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {item.value}
                  </td>
                  <td
                    className={`px-6 py-4 truncate max-w-[300px] ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {item.timeUntilExpiration}
                  </td>
                  <td
                    className={`px-6 py-4 truncate max-w-[300px] ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {item.size}
                  </td>
                  <td className="px-6 py-4 truncate max-w-[300px] text-right flex justify-end gap-3">
                    <button
                      onClick={() => openViewDataModal(item)}
                      className="text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      <DocumentMagnifyingGlassIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className="text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      <PencilSquareIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteKey(item.key)}
                      className="text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  {t("keyList.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateKeyModal onSave={handleCreateKey} />
      <EditKeyModal onSave={handleEditKey} />
      <ViewDataModal />
    </div>
  );
};

export default KeyList;
