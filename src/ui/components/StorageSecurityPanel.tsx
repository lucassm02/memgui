import {
  LockClosedIcon,
  LockOpenIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDarkMode, useModal, useStorage } from "@/ui/hooks";
import { toneButton } from "@/ui/utils/buttonTone";

const StorageSecurityPanel = () => {
  const { darkMode } = useDarkMode();
  const { showAlert, showConfirm, showLoading, dismissLoading } = useModal();
  const {
    encryptionEnabled,
    storageLocked,
    enableEncryption,
    disableEncryption,
    setStoragePassword
  } = useStorage();
  const { t } = useTranslation();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const resetFields = () => {
    setPassword("");
    setConfirm("");
  };

  const handleEnable = async () => {
    if (!password) {
      showAlert(t("storageSecurity.errors.passwordRequired"), "warning");
      return;
    }

    if (password !== confirm) {
      showAlert(t("storageSecurity.errors.passwordMismatch"), "warning");
      return;
    }

    showLoading();
    const ok = await enableEncryption(password);
    dismissLoading();

    if (!ok) {
      showAlert(t("storageSecurity.errors.enableFailed"), "error");
      return;
    }

    resetFields();
    showAlert(t("storageSecurity.success.enabled"), "success");
  };

  const handleUnlock = async () => {
    if (!password) {
      showAlert(t("storageSecurity.errors.passwordRequired"), "warning");
      return;
    }

    showLoading();
    const ok = await setStoragePassword(password);
    dismissLoading();

    if (!ok) {
      showAlert(t("storageSecurity.errors.invalidPassword"), "error");
      return;
    }

    resetFields();
    showAlert(t("storageSecurity.success.unlocked"), "success");
  };

  const handleDisable = async () => {
    if (!password) {
      showAlert(t("storageSecurity.errors.passwordRequired"), "warning");
      return;
    }

    showConfirm({
      message: t("storageSecurity.disableConfirm"),
      type: "warning",
      confirmLabel: t("storageSecurity.disableButton"),
      onConfirm: async () => {
        showLoading();
        const ok = await disableEncryption(password);
        dismissLoading();
        if (!ok) {
          showAlert(t("storageSecurity.errors.disableFailed"), "error");
          return;
        }
        resetFields();
        showAlert(t("storageSecurity.success.disabled"), "success");
      }
    });
  };

  const statusLabel = storageLocked
    ? t("storageSecurity.statusLocked")
    : t("storageSecurity.statusEnabled");
  const statusIcon = storageLocked ? LockClosedIcon : LockOpenIcon;
  const StatusIcon = statusIcon;

  return (
    <div
      className={`mt-6 p-4 rounded-xl border ${
        darkMode ? "bg-gray-900/40 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4
            className={`text-sm font-semibold ${
              darkMode ? "text-gray-100" : "text-gray-800"
            }`}
          >
            {t("storageSecurity.title")}
          </h4>
          <p
            className={`text-xs mt-1 ${
              darkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {t("storageSecurity.description")}
          </p>
        </div>
        <div
          className={`p-2 rounded-lg ${
            darkMode ? "bg-emerald-400/10" : "bg-emerald-50"
          }`}
        >
          <ShieldCheckIcon
            className={`w-5 h-5 ${
              darkMode ? "text-emerald-300" : "text-emerald-600"
            }`}
          />
        </div>
      </div>

      {encryptionEnabled && (
        <div className="flex items-center gap-2 mt-3">
          <StatusIcon
            className={`w-4 h-4 ${
              storageLocked
                ? darkMode
                  ? "text-amber-300"
                  : "text-amber-600"
                : darkMode
                  ? "text-emerald-300"
                  : "text-emerald-600"
            }`}
          />
          <span
            className={`text-xs font-medium ${
              darkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {statusLabel}
          </span>
        </div>
      )}

      {!encryptionEnabled && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span
              className={`text-xs font-medium ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {t("storageSecurity.passwordLabel")}
            </span>
            <input
              type="password"
              className={`mt-1 w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                darkMode
                  ? "bg-gray-800 border-gray-700 text-gray-100"
                  : "bg-white border-gray-200 text-gray-900"
              }`}
              placeholder={t("storageSecurity.passwordPlaceholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="block">
            <span
              className={`text-xs font-medium ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {t("storageSecurity.confirmLabel")}
            </span>
            <input
              type="password"
              className={`mt-1 w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                darkMode
                  ? "bg-gray-800 border-gray-700 text-gray-100"
                  : "bg-white border-gray-200 text-gray-900"
              }`}
              placeholder={t("storageSecurity.confirmPlaceholder")}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>
          <button
            className={`${toneButton("primary", darkMode)} w-full justify-center`}
            onClick={handleEnable}
          >
            {t("storageSecurity.enableButton")}
          </button>
        </div>
      )}

      {encryptionEnabled && storageLocked && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span
              className={`text-xs font-medium ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {t("storageSecurity.passwordLabel")}
            </span>
            <input
              type="password"
              className={`mt-1 w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                darkMode
                  ? "bg-gray-800 border-gray-700 text-gray-100"
                  : "bg-white border-gray-200 text-gray-900"
              }`}
              placeholder={t("storageSecurity.passwordPlaceholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            className={`${toneButton("primary", darkMode)} w-full justify-center`}
            onClick={handleUnlock}
          >
            {t("storageSecurity.unlockButton")}
          </button>
        </div>
      )}

      {encryptionEnabled && !storageLocked && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span
              className={`text-xs font-medium ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {t("storageSecurity.passwordLabel")}
            </span>
            <input
              type="password"
              className={`mt-1 w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                darkMode
                  ? "bg-gray-800 border-gray-700 text-gray-100"
                  : "bg-white border-gray-200 text-gray-900"
              }`}
              placeholder={t("storageSecurity.passwordPlaceholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            className={`${toneButton("danger", darkMode)} w-full justify-center`}
            onClick={handleDisable}
          >
            {t("storageSecurity.disableButton")}
          </button>
        </div>
      )}
    </div>
  );
};

export default StorageSecurityPanel;
