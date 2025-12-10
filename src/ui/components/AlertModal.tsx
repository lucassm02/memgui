import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

import { useDarkMode } from "../hooks/useDarkMode";
import { useElectron } from "../hooks/useElectron";
import { useModal } from "../hooks/useModal";

const typeConfig = {
  success: {
    icon: CheckCircleIcon,
    color: "text-green-500",
    bg: "bg-green-50/80",
    border: "border-green-200"
  },
  error: {
    icon: ExclamationCircleIcon,
    color: "text-red-500",
    bg: "bg-red-50/80",
    border: "border-red-200"
  },
  warning: {
    icon: ExclamationTriangleIcon,
    color: "text-yellow-500",
    bg: "bg-yellow-50/80",
    border: "border-yellow-200"
  }
} as const;

const AlertModal = () => {
  const { dismissAlert, alertModalIsOpen, alertModalMessage, alertModalType } =
    useModal();
  const { darkMode } = useDarkMode();
  const { enabled: electronEnabled } = useElectron();
  const { t } = useTranslation();

  if (!alertModalIsOpen) return null;

  const config = typeConfig[alertModalType] ?? typeConfig.error;
  const Icon = config.icon;

  return (
    <div
      className={`fixed ${
        electronEnabled ? "top-10 left-0 right-0 bottom-0" : "inset-0"
      } flex items-center justify-center bg-black/40 backdrop-blur-lg z-[60]`}
    >
      <div
        className={`p-6 rounded-lg shadow-xl w-96 border animate-fadeIn transition-all
        ${darkMode ? "bg-gray-800 text-white border-gray-700" : `${config.bg} text-gray-900 ${config.border}`}`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-8 h-8 ${config.color}`} />
          <h2 className="text-lg font-semibold">
            {t(`alertModal.titles.${alertModalType}`)}
          </h2>
        </div>

        <p
          className={`mt-3 text-sm ${
            darkMode ? "text-gray-200" : "text-gray-800"
          }`}
        >
          {alertModalMessage}
        </p>

        <div className="mt-5 flex justify-end">
          <button
            onClick={dismissAlert}
            className={`px-4 py-2 rounded-md font-medium transition-all
            ${darkMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
          >
            {t("alertModal.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
