import { ServerIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Trans, useTranslation } from "react-i18next";

import { useDarkMode } from "../hooks/useDarkMode";
import { useModal } from "../hooks/useModal";
import Disclaimer from "./Disclaimer";

const SetupGuideModal = () => {
  const { darkMode } = useDarkMode();
  const { setupGuideModalIsOpen, closeSetupGuideModal } = useModal();
  const { t } = useTranslation();

  if (!setupGuideModalIsOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div
        className={`p-6 rounded-lg shadow-lg w-[90%] max-w-lg border transition-all
          ${darkMode ? "bg-gray-800 text-white border-gray-700" : "bg-white text-gray-900 border-gray-300"}`}
      >
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center gap-2">
            <ServerIcon className="w-6 h-6 text-blue-400" />
            <h2 className="text-lg font-medium">{t("setupGuide.title")}</h2>
          </div>
          <button
            onClick={closeSetupGuideModal}
            className={`transition ${darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-900"}`}
            aria-label={t("common.close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <Disclaimer className="mt-5 mb-5" showDisclaimer={true}>
          <Trans
            i18nKey="setupGuide.disclaimer"
            components={{ strong: <strong /> }}
          />
        </Disclaimer>

        <div className="mt-4 space-y-4 text-sm">
          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.name.title")}
            </h3>
            <p className="mt-1 ml-5 text-gray-400">
              {t("setupGuide.fields.name.description")}
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.address.title")}
            </h3>
            <p className="mt-1 ml-5 text-gray-400">
              <Trans
                i18nKey="setupGuide.fields.address.description"
                components={{ code: <code /> }}
              />
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.port.title")}
            </h3>
            <p className="mt-1 ml-5 text-gray-400">
              <Trans
                i18nKey="setupGuide.fields.port.description"
                components={{ strong: <strong /> }}
              />
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.auth.title")}
            </h3>
            <p className="mt-1 ml-5 text-gray-400">
              {t("setupGuide.fields.auth.description")}
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.timeout.title")}
            </h3>
            <p className="mt-1 ml-5 text-gray-400">
              {t("setupGuide.fields.timeout.description")}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={closeSetupGuideModal}
            className={`px-4 py-2 rounded-md font-medium transition-all
              ${darkMode ? "bg-blue-700 hover:bg-blue-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
          >
            {t("setupGuide.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupGuideModal;
