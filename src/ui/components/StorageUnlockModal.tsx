import { useState } from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

import { useDarkMode, useElectron, useStorage } from "@/ui/hooks";
import { toneButton } from "@/ui/utils/buttonTone";

const StorageUnlockModal = () => {
  const { darkMode } = useDarkMode();
  const { enabled: electronEnabled } = useElectron();
  const { encryptionEnabled, storageLocked, setStoragePassword } = useStorage();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!encryptionEnabled || !storageLocked) {
    return null;
  }

  const handleUnlock = async () => {
    setError("");
    if (!password) {
      setError(t("storageSecurity.errors.passwordRequired"));
      return;
    }

    setIsSubmitting(true);
    const ok = await setStoragePassword(password);
    setIsSubmitting(false);

    if (!ok) {
      setError(t("storageSecurity.errors.invalidPassword"));
      return;
    }

    setPassword("");
  };

  return (
    <div
      className={`fixed ${
        electronEnabled ? "top-10 left-0 right-0 bottom-0" : "inset-0"
      } flex items-center justify-center bg-black/60 backdrop-blur-lg z-[70]`}
    >
      <div
        className={`w-full max-w-md rounded-xl border p-6 shadow-2xl ${
          darkMode ? "bg-gray-900 text-white border-gray-700" : "bg-white text-gray-900 border-gray-200"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg ${
              darkMode ? "bg-amber-500/10" : "bg-amber-50"
            }`}
          >
            <LockClosedIcon
              className={`w-6 h-6 ${
                darkMode ? "text-amber-300" : "text-amber-600"
              }`}
            />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {t("storageSecurity.title")}
            </h2>
            <p
              className={`mt-1 text-sm ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {t("storageSecurity.statusLocked")}
            </p>
          </div>
        </div>

        <p
          className={`mt-4 text-sm ${
            darkMode ? "text-gray-300" : "text-gray-600"
          }`}
        >
          {t("storageSecurity.description")}
        </p>

        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleUnlock();
          }}
        >
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
              className={`mt-1 w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                darkMode
                  ? "bg-gray-800 border-gray-700 text-gray-100"
                  : "bg-white border-gray-200 text-gray-900"
              }`}
              placeholder={t("storageSecurity.passwordPlaceholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            className={`${toneButton("primary", darkMode)} w-full justify-center ${
              isSubmitting ? "opacity-70 cursor-not-allowed" : ""
            }`}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("common.loading") : t("storageSecurity.unlockButton")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StorageUnlockModal;
