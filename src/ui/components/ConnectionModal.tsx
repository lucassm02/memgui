import {
  XMarkIcon,
  ServerIcon,
  ChevronRightIcon
} from "@heroicons/react/24/outline";
import { useState, ChangeEvent, FormEvent, useEffect, useRef } from "react";
import { useTranslation, Trans } from "react-i18next";

import { useDarkMode } from "../hooks/useDarkMode";
import { useElectron } from "../hooks/useElectron";
import { useModal } from "../hooks/useModal";
import Disclaimer from "./Disclaimer";
import { Connection } from "@/ui/contexts";

type Props = {
  onSubmit: (
    connection: Connection,
    options: { isEditing: boolean; previousConnection?: Connection | null }
  ) => void;
  onTest: (connection: Omit<Connection, "id">) => Promise<boolean>;
};

const defaultForm = {
  name: "",
  host: "",
  port: 11211,
  username: "",
  password: "",
  timeout: 300
};

const ConnectionModal = ({ onSubmit, onTest }: Props) => {
  const {
    connectionModalIsOpen,
    closeConnectionModal,
    connectionToEdit,
    isEditingConnection,
    showAlert
  } = useModal();
  const { darkMode } = useDarkMode();
  const { enabled: electronEnabled } = useElectron();
  const { t } = useTranslation();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [isTesting, setIsTesting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (connectionModalIsOpen && connectionToEdit) {
      setFormData({
        name: connectionToEdit.name,
        host: connectionToEdit.host,
        port: connectionToEdit.port,
        username: connectionToEdit.username ?? "",
        password: connectionToEdit.password ?? "",
        timeout: connectionToEdit.timeout ?? defaultForm.timeout
      });
      setShowAdvanced(
        !!(
          connectionToEdit.username ||
          connectionToEdit.password ||
          connectionToEdit.timeout !== defaultForm.timeout
        )
      );
      return;
    }

    if (connectionModalIsOpen && !connectionToEdit) {
      setFormData(defaultForm);
      setShowAdvanced(false);
    }
  }, [connectionModalIsOpen, connectionToEdit]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const getValue = (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.type === "number") {
        return Number(event.target.value);
      }

      if (event.target.type === "checkbox") {
        return event.target.checked;
      }

      return event.target.value;
    };

    setFormData((prev) => ({
      ...prev,
      [event.target.name]: getValue(event)
    }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(
      { ...formData, id: connectionToEdit?.id ?? "" },
      { isEditing: isEditingConnection, previousConnection: connectionToEdit }
    );
    closeConnectionModal();
  };

  const handleTestConnection = async () => {
    if (isTesting) return;
    if (formRef.current && !formRef.current.reportValidity()) return;

    setIsTesting(true);
    const tested = await onTest({
      ...formData
    });
    if (tested) {
      showAlert(t("connectionModal.testSuccess"), "success");
    }
    setIsTesting(false);
  };

  if (!connectionModalIsOpen) return null;

  return (
    <div
      className={`fixed ${
        electronEnabled ? "top-10 left-0 right-0 bottom-0" : "inset-0"
      } flex items-center justify-center bg-black/50 backdrop-blur-sm z-50`}
    >
      <div
        className={`p-5 rounded-lg shadow-lg w-[90%] max-w-md border transition-all
          ${darkMode ? "bg-gray-800 text-white border-gray-700" : "bg-white text-gray-900 border-gray-300"}`}
      >
        <div
          className={`flex justify-between items-center border-b pb-3 ${darkMode ? "border-gray-700" : "border-gray-300"}`}
        >
          <div className="flex items-center gap-2">
            <ServerIcon className="w-6 h-6 text-blue-400" />
            <h2 className="text-lg font-medium">
              {isEditingConnection
                ? t("connectionModal.editTitle")
                : t("connectionModal.title")}
            </h2>
          </div>
          <button
            onClick={closeConnectionModal}
            className={`transition ${darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-600 hover:text-gray-900"}`}
            aria-label={t("common.close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} ref={formRef}>
          <div className="mt-4">
            <label
              className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              {t("connectionModal.fields.name")}:
            </label>
            <input
              type="text"
              name="name"
              placeholder={t("connectionModal.fields.namePlaceholder")}
              value={formData.name}
              onChange={handleChange}
              className={`mt-1 w-full p-2 rounded-md border focus:outline-none transition
                ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
              required
            />
          </div>

          <div className="mt-4">
            <label
              className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              {t("connectionModal.fields.address")}:
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                name="host"
                placeholder={t("connectionModal.fields.hostPlaceholder")}
                value={formData.host}
                onChange={handleChange}
                className={`flex-1 p-2 rounded-md border focus:outline-none transition
                  ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                required
              />
              <input
                type="number"
                name="port"
                aria-label={t("connectionModal.fields.port")}
                value={formData.port}
                onChange={handleChange}
                className={`w-24 p-2 rounded-md border focus:outline-none transition
                  ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                required
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-500"
            >
              <ChevronRightIcon
                className={`w-5 h-5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
              />
              {t("connectionModal.fields.options")}
            </button>
          </div>

          {showAdvanced && (
            <>
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                  >
                    {t("connectionModal.fields.username")}:
                  </label>
                  <input
                    type="text"
                    name="username"
                    placeholder={t(
                      "connectionModal.fields.usernamePlaceholder"
                    )}
                    value={formData.username}
                    onChange={handleChange}
                    className={`w-full p-2 rounded-md border focus:outline-none transition
                  ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                  />
                </div>
                <div>
                  <label
                    className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                  >
                    {t("connectionModal.fields.password")}:
                  </label>
                  <input
                    type="password"
                    name="password"
                    placeholder={t(
                      "connectionModal.fields.passwordPlaceholder"
                    )}
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full p-2 rounded-md border focus:outline-none transition
                  ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                  />
                </div>
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <label
                    className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                  >
                    {t("connectionModal.fields.timeout")}:
                  </label>
                  <input
                    type="number"
                    name="timeout"
                    value={formData.timeout}
                    min={300}
                    max={3600}
                    onChange={handleChange}
                    className="w-full p-2 rounded-md border"
                  />
                </div>
              </div>

              <Disclaimer className="mt-5 mb-5" showDisclaimer={true}>
                <Trans
                  i18nKey="connectionModal.authNote"
                  components={{ strong: <strong /> }}
                />
              </Disclaimer>
            </>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              className={`px-4 py-2 rounded-md border ${
                darkMode
                  ? "border-gray-600 text-gray-200 hover:bg-gray-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
              disabled={isTesting}
            >
              {isTesting
                ? t("connectionModal.testing")
                : t("connectionModal.test")}
            </button>
            <button
              type="button"
              onClick={closeConnectionModal}
              className="px-4 py-2 rounded-md bg-red-500 text-white"
            >
              {t("connectionModal.cancel")}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-blue-600 text-white"
            >
              {isEditingConnection
                ? t("connectionModal.save")
                : t("connectionModal.connect")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConnectionModal;
