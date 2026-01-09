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
import { toneButton } from "../utils/buttonTone";
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
  timeout: 300,
  sshEnabled: false,
  sshPort: 22,
  sshUsername: "",
  sshPassword: "",
  sshPrivateKey: ""
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

  const buildSshConfig = () => {
    if (!formData.sshEnabled) return undefined;

    const passwordValue = formData.sshPassword;
    const privateKeyValue = formData.sshPrivateKey.trim();
    const hasPassword = passwordValue.trim().length > 0;
    const hasPrivateKey = privateKeyValue.length > 0;

    return {
      port: formData.sshPort,
      username: formData.sshUsername.trim(),
      ...(hasPassword ? { password: passwordValue } : {}),
      ...(hasPrivateKey ? { privateKey: privateKeyValue } : {})
    };
  };

  const isSshAuthMissing =
    formData.sshEnabled &&
    !formData.sshPassword.trim() &&
    !formData.sshPrivateKey.trim();

  const buildConnectionPayload = (): Omit<Connection, "id"> => ({
    name: formData.name,
    host: formData.host,
    port: formData.port,
    username: formData.username,
    password: formData.password,
    timeout: formData.timeout,
    ssh: buildSshConfig()
  });

  useEffect(() => {
    if (connectionModalIsOpen && connectionToEdit) {
      const sshConfig = connectionToEdit.ssh;
      setFormData({
        name: connectionToEdit.name,
        host: connectionToEdit.host,
        port: connectionToEdit.port,
        username: connectionToEdit.username ?? "",
        password: connectionToEdit.password ?? "",
        timeout: connectionToEdit.timeout ?? defaultForm.timeout,
        sshEnabled: !!sshConfig,
        sshPort: sshConfig?.port ?? defaultForm.sshPort,
        sshUsername: sshConfig?.username ?? "",
        sshPassword: sshConfig?.password ?? "",
        sshPrivateKey: sshConfig?.privateKey ?? ""
      });
      setShowAdvanced(
        !!(
          connectionToEdit.username ||
          connectionToEdit.password ||
          connectionToEdit.timeout !== defaultForm.timeout ||
          sshConfig
        )
      );
      return;
    }

    if (connectionModalIsOpen && !connectionToEdit) {
      setFormData(defaultForm);
      setShowAdvanced(false);
    }
  }, [connectionModalIsOpen, connectionToEdit]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const target = event.target;
    const value = (() => {
      if (target instanceof HTMLInputElement) {
        if (target.type === "number") {
          return Number(target.value);
        }

        if (target.type === "checkbox") {
          return target.checked;
        }
      }

      return target.value;
    })();

    setFormData((prev) => ({
      ...prev,
      [target.name]: value
    }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (formRef.current && !formRef.current.reportValidity()) return;
    if (isSshAuthMissing) {
      showAlert(t("connectionModal.sshAuthRequired"), "error");
      return;
    }
    onSubmit(
      { ...buildConnectionPayload(), id: connectionToEdit?.id ?? "" },
      { isEditing: isEditingConnection, previousConnection: connectionToEdit }
    );
    closeConnectionModal();
  };

  const handleTestConnection = async () => {
    if (isTesting) return;
    if (formRef.current && !formRef.current.reportValidity()) return;
    if (isSshAuthMissing) {
      showAlert(t("connectionModal.sshAuthRequired"), "error");
      return;
    }

    setIsTesting(true);
    const tested = await onTest(buildConnectionPayload());
    if (tested) {
      showAlert(t("connectionModal.testSuccess"), "success");
    }
    setIsTesting(false);
  };

  if (!connectionModalIsOpen) return null;

  const hostLabel = formData.sshEnabled
    ? t("connectionModal.fields.sshHost")
    : t("connectionModal.fields.address");
  const hostPlaceholder = formData.sshEnabled
    ? t("connectionModal.fields.sshHostPlaceholder")
    : t("connectionModal.fields.hostPlaceholder");
  const memcachedPortLabel = formData.sshEnabled
    ? t("connectionModal.fields.memcachedPort")
    : t("connectionModal.fields.port");

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
            <ServerIcon className="w-6 h-6 text-blue-400" />
            <h2 className="text-lg font-medium">
              {isEditingConnection
                ? t("connectionModal.editTitle")
                : t("connectionModal.title")}
            </h2>
          </div>
          <button
            onClick={closeConnectionModal}
            className={`${toneButton("neutral", darkMode, "icon")} !p-1`}
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
            <div className="flex gap-3">
              <div className="flex-1">
                <label
                  className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                >
                  {hostLabel}:
                </label>
                <input
                  type="text"
                  name="host"
                  placeholder={hostPlaceholder}
                  value={formData.host}
                  onChange={handleChange}
                  className={`mt-1 w-full p-2 rounded-md border focus:outline-none transition
                    ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                  required
                />
              </div>
              <div className="w-24">
                <label
                  className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                >
                  {memcachedPortLabel}:
                </label>
                <input
                  type="number"
                  name="port"
                  aria-label={memcachedPortLabel}
                  title={memcachedPortLabel}
                  value={formData.port}
                  onChange={handleChange}
                  className={`mt-1 w-full p-2 rounded-md border focus:outline-none transition
                    ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                  required
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`${toneButton("primary", darkMode, "sm")} !px-3`}
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
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="sshEnabled"
                    checked={formData.sshEnabled}
                    onChange={handleChange}
                    className="h-4 w-4"
                  />
                  <span
                    className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                  >
                    {t("connectionModal.fields.sshToggle")}
                  </span>
                </div>

                {formData.sshEnabled && (
                  <div className="space-y-3">
                    <div>
                      <label
                        className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                      >
                        {t("connectionModal.fields.sshPort")}:
                      </label>
                      <input
                        type="number"
                        name="sshPort"
                        value={formData.sshPort}
                        min={1}
                        max={65535}
                        required={formData.sshEnabled}
                        onChange={handleChange}
                        className="w-full p-2 rounded-md border"
                      />
                    </div>
                    <div>
                      <label
                        className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                      >
                        {t("connectionModal.fields.sshUsername")}:
                      </label>
                      <input
                        type="text"
                        name="sshUsername"
                        placeholder={t(
                          "connectionModal.fields.sshUsernamePlaceholder"
                        )}
                        value={formData.sshUsername}
                        required={formData.sshEnabled}
                        onChange={handleChange}
                        className={`w-full p-2 rounded-md border focus:outline-none transition
                  ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                      />
                    </div>
                    <div>
                      <label
                        className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                      >
                        {t("connectionModal.fields.sshPassword")}:
                      </label>
                      <input
                        type="password"
                        name="sshPassword"
                        placeholder={t(
                          "connectionModal.fields.sshPasswordPlaceholder"
                        )}
                        value={formData.sshPassword}
                        onChange={handleChange}
                        className={`w-full p-2 rounded-md border focus:outline-none transition
                  ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                      />
                    </div>
                    <div>
                      <label
                        className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                      >
                        {t("connectionModal.fields.sshPrivateKey")}:
                      </label>
                      <textarea
                        name="sshPrivateKey"
                        placeholder={t(
                          "connectionModal.fields.sshPrivateKeyPlaceholder"
                        )}
                        value={formData.sshPrivateKey}
                        onChange={handleChange}
                        rows={4}
                        className={`w-full p-2 rounded-md border focus:outline-none transition
                  ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                      />
                    </div>
                  </div>
                )}
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
              className={toneButton("neutral", darkMode, "sm")}
              disabled={isTesting}
            >
              {isTesting
                ? t("connectionModal.testing")
                : t("connectionModal.test")}
            </button>
            <button
              type="button"
              onClick={closeConnectionModal}
              className={toneButton("neutral", darkMode, "sm")}
            >
              {t("connectionModal.cancel")}
            </button>
            <button
              type="submit"
              className={toneButton("success", darkMode, "sm")}
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
