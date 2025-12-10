import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

import { useDarkMode } from "../hooks/useDarkMode";
import { useModal } from "../hooks/useModal";

const LoadingModal = () => {
  const { loadingModalIsOpen } = useModal();
  const { darkMode } = useDarkMode();
  const { t } = useTranslation();

  if (!loadingModalIsOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-md z-50">
      <div
        className={`p-8 rounded-lg shadow-xl w-40 flex flex-col items-center animate-fadeIn transition-all
        ${darkMode ? "bg-gray-800/80 text-white border-gray-700" : "bg-white/80 text-gray-900 border-gray-300"}`}
      >
        <div className="relative flex justify-center">
          <ArrowPathIcon
            className={`w-14 h-14 animate-spin
            ${darkMode ? "text-blue-400" : "text-blue-600"}`}
          />
          <div
            className={`absolute w-14 h-14 opacity-20 rounded-full blur-xl transition
            ${darkMode ? "bg-blue-400" : "bg-blue-600"}`}
          ></div>
        </div>

        <p
          className={`mt-5 text-sm font-medium transition
          ${darkMode ? "text-gray-300" : "text-gray-700"}`}
        >
          {t("loadingModal.loading")}
        </p>
      </div>
    </div>
  );
};

export default LoadingModal;
