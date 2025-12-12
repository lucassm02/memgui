import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

import { useDarkMode } from "../hooks/useDarkMode";
import { useElectron } from "../hooks/useElectron";
import { useModal } from "../hooks/useModal";
import { toneButton } from "../utils/buttonTone";

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

const confirmButtonVariants = {
  success: "success",
  error: "danger",
  warning: "warning"
} as const;

const AlertModal = () => {
  const {
    dismissAlert,
    alertModalIsOpen,
    alertModalMessage,
    alertModalType,
    alertModalMode,
    alertModalConfirmLabel,
    alertModalCancelLabel,
    alertModalOnConfirm,
    alertModalTitle
  } = useModal();
  const { darkMode } = useDarkMode();
  const { enabled: electronEnabled } = useElectron();
  const { t } = useTranslation();

  if (!alertModalIsOpen) return null;

  const config = typeConfig[alertModalType] ?? typeConfig.error;
  const Icon = config.icon;
  const confirmVariant =
    confirmButtonVariants[alertModalType] ?? confirmButtonVariants.error;
  const title =
    alertModalTitle && alertModalTitle.trim().length > 0
      ? alertModalTitle
      : t(`alertModal.titles.${alertModalType}`);

  const handleConfirm = async () => {
    const onConfirm = alertModalOnConfirm;
    dismissAlert();

    if (!onConfirm) return;

    try {
      await onConfirm();
    } catch (error) {
      console.error("Confirm modal action failed", error);
    }
  };

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
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>

        <p
          className={`mt-3 text-sm ${
            darkMode ? "text-gray-200" : "text-gray-800"
          }`}
        >
          {alertModalMessage}
        </p>

        {alertModalMode === "confirm" ? (
          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={dismissAlert}
              className={toneButton("neutral", darkMode, "sm")}
            >
              {alertModalCancelLabel || t("alertModal.cancel")}
            </button>
            <button
              onClick={handleConfirm}
              className={toneButton(confirmVariant, darkMode, "sm")}
            >
              {alertModalConfirmLabel || t("alertModal.confirm")}
            </button>
          </div>
        ) : (
          <div className="mt-5 flex justify-end">
            <button
              onClick={dismissAlert}
              className={toneButton("primary", darkMode, "sm")}
            >
              {t("alertModal.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertModal;
