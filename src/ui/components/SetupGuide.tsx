import { ServerIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Trans, useTranslation } from "react-i18next";

import { useDarkMode } from "../hooks/useDarkMode";
import { useModal } from "../hooks/useModal";
import { toneButton } from "../utils/buttonTone";
import Disclaimer from "./Disclaimer";

const SetupGuideModal = () => {
  const { darkMode } = useDarkMode();
  const { setupGuideModalIsOpen, closeSetupGuideModal } = useModal();
  const { t } = useTranslation();

  if (!setupGuideModalIsOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div
        className={`p-5 rounded-lg shadow-lg w-[92%] max-w-md max-h-[85vh] overflow-y-auto border transition-all
          ${darkMode ? "bg-gray-800 text-white border-gray-700" : "bg-white text-gray-900 border-gray-300"}`}
      >
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center gap-2">
            <ServerIcon className="w-6 h-6 text-blue-400" />
            <h2 className="text-lg font-medium">{t("setupGuide.title")}</h2>
          </div>
          <button
            onClick={closeSetupGuideModal}
            className={`${toneButton("neutral", darkMode, "icon")} !p-1`}
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

        <div className="mt-3 space-y-3 text-sm">
          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.name.title")}
            </h3>
            <p className="mt-0.5 ml-5 text-gray-400">
              {t("setupGuide.fields.name.description")}
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.address.title")}
            </h3>
            <p className="mt-0.5 ml-5 text-gray-400">
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
            <p className="mt-0.5 ml-5 text-gray-400">
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
            <p className="mt-0.5 ml-5 text-gray-400">
              {t("setupGuide.fields.auth.description")}
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.sshToggle.title")}
            </h3>
            <p className="mt-0.5 ml-5 text-gray-400">
              {t("setupGuide.fields.sshToggle.description")}
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.sshPort.title")}
            </h3>
            <p className="mt-0.5 ml-5 text-gray-400">
              <Trans
                i18nKey="setupGuide.fields.sshPort.description"
                components={{ strong: <strong /> }}
              />
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.sshAuth.title")}
            </h3>
            <p className="mt-0.5 ml-5 text-gray-400">
              {t("setupGuide.fields.sshAuth.description")}
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.sshHostKey.title")}
            </h3>
            <p className="mt-0.5 ml-5 text-gray-400">
              {t("setupGuide.fields.sshHostKey.description")}
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.sshStorage.title")}
            </h3>
            <p className="mt-0.5 ml-5 text-gray-400">
              {t("setupGuide.fields.sshStorage.description")}
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold">
              {t("setupGuide.fields.timeout.title")}
            </h3>
            <p className="mt-0.5 ml-5 text-gray-400">
              {t("setupGuide.fields.timeout.description")}
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={closeSetupGuideModal}
            className={toneButton("primary", darkMode, "sm")}
          >
            {t("setupGuide.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupGuideModal;
