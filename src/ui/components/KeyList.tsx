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
import { toneButton } from "../utils/buttonTone";
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
    currentConnection,
    handleFlushAllKeys,
    totalKeyCount
  } = useConnections();

  const { openCreateModal, openEditModal, openViewDataModal, showConfirm } =
    useModal();
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [maxItems, setMaxItems] = useState(5);
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
  }, [searchTerm, maxItems]);

  const filteredKeys = keys;

  const handleConfirmFlushAll = () => {
    showConfirm({
      title: t("keyList.flushConfirmation.title"),
      message: t("keyList.flushConfirmation.message"),
      confirmLabel: t("keyList.flushConfirmation.confirm"),
      cancelLabel: t("keyList.flushConfirmation.cancel"),
      type: "error",
      onConfirm: handleFlushAllKeys
    });
  };

  return (
    <div
      className={`w-full px-2 sm:px-3 max-w-none mx-auto mt-10 transition-all ${
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
      <div className="flex flex-col gap-3 mb-6">
        <h2 className="text-xl font-semibold">
          {t("keyList.title")}
          {totalKeyCount !== undefined ? `\u2068 (${totalKeyCount})\u2069` : ""}
        </h2>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleLoadKeys(true, searchTerm, maxItems)}
              className={toneButton("primary", darkMode)}
            >
              <ArrowPathIcon className="w-5 h-5" />
              {t("keyList.refresh")}
            </button>

            <button
              onClick={() => setAutoUpdate((prev) => !prev)}
              className={`${toneButton(
                autoUpdate ? "primary" : "neutral",
                darkMode
              )} pl-3 pr-4`}
            >
              <span
                className={`w-10 h-5 flex items-center rounded-full transition-all ${
                  autoUpdate
                    ? "bg-blue-400"
                    : darkMode
                      ? "bg-gray-600"
                      : "bg-gray-300"
                }`}
              >
                <span
                  className={`w-4 h-4 bg-white rounded-full shadow transform transition-all ${
                    autoUpdate ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </span>
              <span className="whitespace-nowrap">
                {t("keyList.autoRefresh")}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className={toneButton("success", darkMode)}
            >
              <PlusIcon className="w-5 h-5" />
              {t("keyList.create")}
            </button>

            <button
              onClick={handleConfirmFlushAll}
              className={toneButton("danger", darkMode)}
            >
              <TrashIcon className="w-5 h-5" />
              {t("keyList.clearAll")}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`p-3 rounded-lg mb-6 flex items-center justify-between ${
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
        className={`overflow-hidden mb-8 rounded-lg shadow ${
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
                      className={`${toneButton("primary", darkMode, "icon")} !px-2 !py-2`}
                    >
                      <DocumentMagnifyingGlassIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className={`${toneButton("primary", darkMode, "icon")} !px-2 !py-2`}
                    >
                      <PencilSquareIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteKey(item.key)}
                      className={`${toneButton("danger", darkMode, "icon")} !px-2 !py-2`}
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
