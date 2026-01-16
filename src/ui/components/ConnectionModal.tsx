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
import { useStorage } from "../hooks/useStorage";
import { toneButton } from "../utils/buttonTone";
import StorageSecurityModal from "./StorageSecurityModal";
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
  timeout: 30,
  sshEnabled: false,
  authEnabled: false,
  sshHost: "",
  sshPort: 22,
  sshUsername: "",
  sshAuthMethod: "password",
  sshPassword: "",
  sshPrivateKey: "",
  sshHostKeyFingerprint: ""
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
  const { encryptionEnabled } = useStorage();
  const { t } = useTranslation();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [isTesting, setIsTesting] = useState(false);
  const [sshPrivateKeyFileName, setSshPrivateKeyFileName] = useState("");
  const [storageSecurityModalOpen, setStorageSecurityModalOpen] =
    useState(false);
  const [pendingSshEnable, setPendingSshEnable] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const sshPrivateKeyInputRef = useRef<HTMLInputElement | null>(null);
  const openStorageSecurityModal = (enableAfterUnlock: boolean) => {
    setPendingSshEnable(enableAfterUnlock);
    setStorageSecurityModalOpen(true);
  };
  const handleCloseStorageSecurityModal = () => {
    setStorageSecurityModalOpen(false);
    setPendingSshEnable(false);
  };

  const buildSshConfig = () => {
    if (!formData.sshEnabled) return undefined;

    const authMethod = formData.sshAuthMethod;
    const passwordValue = formData.sshPassword;
    const privateKeyValue = formData.sshPrivateKey.trim();
    const hostKeyFingerprintValue = formData.sshHostKeyFingerprint.trim();
    const hasPassword =
      authMethod === "password" && passwordValue.trim().length > 0;
    const hasPrivateKey =
      authMethod === "privateKey" && privateKeyValue.length > 0;

    return {
      host: formData.sshHost.trim(),
      port: formData.sshPort,
      username: formData.sshUsername.trim(),
      ...(hasPassword ? { password: passwordValue } : {}),
      ...(hasPrivateKey ? { privateKey: privateKeyValue } : {}),
      ...(hostKeyFingerprintValue
        ? { hostKeyFingerprint: hostKeyFingerprintValue }
        : {})
    };
  };

  const isSshAuthMissing =
    formData.sshEnabled &&
    (formData.sshAuthMethod === "privateKey"
      ? !formData.sshPrivateKey.trim()
      : !formData.sshPassword.trim());
  const isAuthMissing =
    formData.authEnabled &&
    (!formData.username.trim() || !formData.password.trim());

  const buildConnectionPayload = (): Omit<Connection, "id"> => {
    const payload: Omit<Connection, "id"> = {
      name: formData.name,
      host: formData.host,
      port: formData.port,
      timeout: formData.timeout,
      ssh: buildSshConfig()
    };

    if (formData.authEnabled) {
      payload.username = formData.username;
      payload.password = formData.password;
    }

    return payload;
  };

  useEffect(() => {
    if (!connectionModalIsOpen) {
      setStorageSecurityModalOpen(false);
      setPendingSshEnable(false);
      setSshPrivateKeyFileName("");
      return;
    }
    if (connectionModalIsOpen && connectionToEdit) {
      const sshConfig = connectionToEdit.ssh;
      const authEnabled = !!(
        connectionToEdit.username || connectionToEdit.password
      );
      setFormData({
        name: connectionToEdit.name,
        host: connectionToEdit.host,
        port: connectionToEdit.port,
        username: connectionToEdit.username ?? "",
        password: connectionToEdit.password ?? "",
        timeout: connectionToEdit.timeout ?? defaultForm.timeout,
        sshEnabled: !!sshConfig,
        authEnabled,
        sshHost: sshConfig?.host ?? (sshConfig ? connectionToEdit.host : ""),
        sshPort: sshConfig?.port ?? defaultForm.sshPort,
        sshUsername: sshConfig?.username ?? "",
        sshAuthMethod:
          sshConfig?.privateKey && !sshConfig?.password
            ? "privateKey"
            : "password",
        sshPassword: sshConfig?.password ?? "",
        sshPrivateKey: sshConfig?.privateKey ?? "",
        sshHostKeyFingerprint: sshConfig?.hostKeyFingerprint ?? ""
      });
      setSshPrivateKeyFileName("");
      setShowAdvanced(
        !!(
          authEnabled ||
          connectionToEdit.timeout !== defaultForm.timeout ||
          sshConfig
        )
      );
      return;
    }

    if (connectionModalIsOpen && !connectionToEdit) {
      setFormData(defaultForm);
      setShowAdvanced(false);
      setSshPrivateKeyFileName("");
    }
  }, [connectionModalIsOpen, connectionToEdit]);

  const handleSelectSshPrivateKey = () => {
    sshPrivateKeyInputRef.current?.click();
  };

  const handleClearSshPrivateKey = () => {
    setFormData((prev) => ({ ...prev, sshPrivateKey: "" }));
    setSshPrivateKeyFileName("");
    if (sshPrivateKeyInputRef.current) {
      sshPrivateKeyInputRef.current.value = "";
    }
  };

  const handleSshPrivateKeyFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const filePath = (file as { path?: string }).path;
      setFormData((prev) => ({ ...prev, sshPrivateKey: content }));
      setSshPrivateKeyFileName(filePath ?? file.name);
    } catch (_error) {
      showAlert(t("connectionModal.sshPrivateKeyLoadError"), "error");
    } finally {
      if (sshPrivateKeyInputRef.current) {
        sshPrivateKeyInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    if (!storageSecurityModalOpen || !encryptionEnabled) {
      return;
    }
    setStorageSecurityModalOpen(false);
    if (pendingSshEnable) {
      setFormData((prev) => ({
        ...prev,
        sshEnabled: true,
        host: "127.0.0.1"
      }));
      setPendingSshEnable(false);
    }
  }, [storageSecurityModalOpen, encryptionEnabled, pendingSshEnable]);

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      target.type === "checkbox" &&
      target.name === "sshEnabled" &&
      target.checked
    ) {
      if (!encryptionEnabled) {
        openStorageSecurityModal(true);
        return;
      }
      setFormData((prev) => ({
        ...prev,
        sshEnabled: true,
        host: "127.0.0.1"
      }));
      return;
    }
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
    if (formData.sshEnabled && !encryptionEnabled) {
      openStorageSecurityModal(false);
      return;
    }
    if (isAuthMissing) {
      showAlert(t("connectionModal.authRequired"), "error");
      return;
    }
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
    if (formData.sshEnabled && !encryptionEnabled) {
      openStorageSecurityModal(false);
      return;
    }
    if (isAuthMissing) {
      showAlert(t("connectionModal.authRequired"), "error");
      return;
    }
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

  const hostLabel = t("connectionModal.fields.address");
  const hostPlaceholder = t("connectionModal.fields.hostPlaceholder");
  const memcachedPortLabel = t("connectionModal.fields.port");

  return (
    <>
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
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="authEnabled"
                      checked={formData.authEnabled}
                      onChange={handleChange}
                      className="h-4 w-4"
                    />
                    <span
                      className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                    >
                      {t("connectionModal.fields.authToggle")}
                    </span>
                  </div>

                  {formData.authEnabled && (
                    <div className="space-y-3">
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
                          required={formData.authEnabled}
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
                          required={formData.authEnabled}
                          onChange={handleChange}
                          className={`w-full p-2 rounded-md border focus:outline-none transition
                  ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                        />
                      </div>
                    </div>
                  )}

                  {formData.authEnabled && (
                    <div
                      className={`rounded-md border p-3 text-xs ${
                        darkMode
                          ? "border-amber-500/40 text-amber-200 bg-amber-500/10"
                          : "border-amber-300 text-amber-700 bg-amber-50"
                      }`}
                    >
                      <Trans
                        i18nKey="connectionModal.authNote"
                        components={{ strong: <strong /> }}
                      />
                    </div>
                  )}
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
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label
                            className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                          >
                            {t("connectionModal.fields.sshHost")}:
                          </label>
                          <input
                            type="text"
                            name="sshHost"
                            placeholder={t(
                              "connectionModal.fields.sshHostPlaceholder"
                            )}
                            value={formData.sshHost}
                            required={formData.sshEnabled}
                            onChange={handleChange}
                            className={`w-full p-2 rounded-md border focus:outline-none transition
                  ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                          />
                        </div>
                        <div className="w-24">
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
                            className={`w-full p-2 rounded-md border focus:outline-none transition
                    ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                          />
                        </div>
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
                          {t("connectionModal.fields.sshAuthMethod")}:
                        </label>
                        <select
                          name="sshAuthMethod"
                          value={formData.sshAuthMethod}
                          onChange={handleChange}
                          className={`w-full p-2 rounded-md border focus:outline-none transition
                  ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
                        >
                          <option value="password">
                            {t("connectionModal.fields.sshAuthMethodPassword")}
                          </option>
                          <option value="privateKey">
                            {t(
                              "connectionModal.fields.sshAuthMethodPrivateKey"
                            )}
                          </option>
                        </select>
                      </div>
                      {formData.sshAuthMethod === "password" ? (
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
                      ) : (
                        <div>
                          <label
                            className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                          >
                            {t("connectionModal.fields.sshPrivateKey")}:
                          </label>
                          <div className="mt-2 space-y-2">
                            <input
                              ref={sshPrivateKeyInputRef}
                              type="file"
                              accept=".pem,.key,.ppk"
                              onChange={handleSshPrivateKeyFileChange}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={handleSelectSshPrivateKey}
                              className={`${toneButton("neutral", darkMode)} w-full justify-center`}
                            >
                              {t("connectionModal.fields.sshPrivateKeySelect")}
                            </button>
                            <div
                              className={`text-xs ${
                                darkMode ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              {sshPrivateKeyFileName
                                ? `${t("connectionModal.fields.sshPrivateKeySelected")}: ${sshPrivateKeyFileName}`
                                : formData.sshPrivateKey.trim()
                                  ? t(
                                      "connectionModal.fields.sshPrivateKeyLoaded"
                                    )
                                  : t(
                                      "connectionModal.fields.sshPrivateKeyHint"
                                    )}
                            </div>
                            {formData.sshPrivateKey.trim() && (
                              <button
                                type="button"
                                onClick={handleClearSshPrivateKey}
                                className={`text-xs font-semibold underline underline-offset-2 ${
                                  darkMode
                                    ? "text-gray-300 hover:text-gray-100"
                                    : "text-gray-600 hover:text-gray-800"
                                }`}
                              >
                                {t("connectionModal.fields.sshPrivateKeyClear")}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
                      min={1}
                      max={3600}
                      onChange={handleChange}
                      className="w-full p-2 rounded-md border"
                    />
                  </div>
                </div>
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
      <StorageSecurityModal
        isOpen={storageSecurityModalOpen}
        onClose={handleCloseStorageSecurityModal}
      />
    </>
  );
};

export default ConnectionModal;
