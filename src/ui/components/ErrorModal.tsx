import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

import { useDarkMode } from "../hooks/useDarkMode";
import { useModal } from "../hooks/useModal";

const ErrorModal = () => {
  const { dismissError, errorModalIsOpen, errorModalMessage } = useModal();
  const { darkMode } = useDarkMode();
  const { t } = useTranslation();

  if (!errorModalIsOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-lg z-90">
      <div
        className={`p-6 rounded-lg shadow-xl w-96 border animate-fadeIn transition-all 
        ${darkMode ? "bg-gray-800 text-white border-gray-700" : "bg-white text-gray-900 border-gray-300"}`}
      >
        <div className="flex items-center gap-3">
          <ExclamationCircleIcon className="w-8 h-8 text-red-500" />
          <h2 className="text-lg font-semibold">{t("errorModal.title")}</h2>
        </div>

        <p
          className={`mt-2 text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}
        >
          {errorModalMessage}
        </p>

        <div className="mt-4 flex justify-end">
          <button
            onClick={dismissError}
            className={`px-4 py-2 rounded-md font-medium transition-all 
            ${darkMode ? "bg-red-600 hover:bg-red-700 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
          >
            {t("errorModal.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
