import { ShieldCheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

import { useDarkMode, useElectron } from "@/ui/hooks";
import { toneButton } from "@/ui/utils/buttonTone";
import StorageSecurityPanel from "./StorageSecurityPanel";

type StorageSecurityModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const StorageSecurityModal = ({
  isOpen,
  onClose
}: StorageSecurityModalProps) => {
  const { darkMode } = useDarkMode();
  const { enabled: electronEnabled } = useElectron();
  const { t } = useTranslation();

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`fixed ${
        electronEnabled ? "top-10 left-0 right-0 bottom-0" : "inset-0"
      } flex items-center justify-center bg-black/50 backdrop-blur-sm z-50`}
    >
      <div
        className={`p-5 rounded-lg shadow-lg w-[90%] max-w-md border transition-all max-h-[90vh] overflow-y-auto
          ${darkMode ? "bg-gray-800 text-white border-gray-700" : "bg-white text-gray-900 border-gray-300"}`}
      >
        <div
          className={`flex justify-between items-center border-b pb-3 ${darkMode ? "border-gray-700" : "border-gray-300"}`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-medium">
              {t("storageSecurity.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${toneButton("neutral", darkMode, "icon")} !p-1`}
            aria-label={t("common.close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <p
          className={`mt-4 text-sm ${
            darkMode ? "text-gray-300" : "text-gray-600"
          }`}
        >
          {t("storageSecurity.sshInfo")}
        </p>
        <div className="mt-4">
          <StorageSecurityPanel showHeader={false} variant="plain" />
        </div>
        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className={`${toneButton("neutral", darkMode)} w-full justify-center`}
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorageSecurityModal;
