import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { XMarkIcon } from "@heroicons/react/24/solid";
import CodeMirror from "@uiw/react-codemirror";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDarkMode } from "../hooks/useDarkMode";
import { useModal } from "../hooks/useModal";
import { toneButton } from "../utils/buttonTone";

interface Key {
  key: string;
  value: string;
  size: number;
  timeUntilExpiration?: number;
}

type Params = { onSave: (key: Key) => void };

const CreateKeyModal = ({ onSave }: Params) => {
  const [formData, setFormData] = useState<Key>({
    key: "",
    value: "",
    size: 0,
    timeUntilExpiration: undefined
  });
  const [format, setFormat] = useState("TEXT");
  const [valueError, setValueError] = useState("");

  const { createModalIsOpen, closeCreateModal } = useModal();
  const { darkMode } = useDarkMode();
  const { t } = useTranslation();

  const languageExtension = useMemo(() => {
    switch (format) {
      case "HTML":
        return html();
      case "XML":
        return xml();
      case "JavaScript":
        return javascript();
      case "TEXT":
        return null;
      default:
        return json();
    }
  }, [format]);

  useEffect(() => {
    if (createModalIsOpen) {
      document.getElementById("key-input")?.focus();
      setValueError("");
    }
  }, [createModalIsOpen]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!formData.value) {
      setValueError(t("createKeyModal.errors.valueRequired"));
      return;
    }

    setValueError("");

    if (formData.key && formData.value) {
      onSave(formData);
      closeCreateModal();
      setFormData({
        key: "",
        value: "",
        size: 0,
        timeUntilExpiration: undefined
      });
      setFormat("TEXT");
    }
  };

  if (!createModalIsOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div
        className={`p-5 rounded-lg shadow-lg w-[90%] max-w-xl border transition-all
          ${darkMode ? "bg-gray-800 text-white border-gray-700" : "bg-white text-gray-900 border-gray-300"}`}
      >
        <div
          className={`flex justify-between items-center border-b pb-3
            ${darkMode ? "border-gray-700" : "border-gray-300"}`}
        >
          <h2 className="text-lg font-medium">{t("createKeyModal.title")}</h2>
          <button
            onClick={closeCreateModal}
            className={`${toneButton("neutral", darkMode, "icon")} !p-1`}
            aria-label={t("common.close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mt-4">
            <label
              className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              {t("createKeyModal.fields.key").toUpperCase()}:
            </label>
            <input
              id="key-input"
              type="text"
              required
              value={formData.key}
              onChange={(e) =>
                setFormData({ ...formData, key: e.target.value })
              }
              className={`mt-1 p-2 rounded-md w-full border focus:outline-none transition
                ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
            />
          </div>

          <div className="mt-4">
            <label
              className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              {t("createKeyModal.fields.expiration").toUpperCase()}:
            </label>
            <input
              type="number"
              min={0}
              value={formData.timeUntilExpiration ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  timeUntilExpiration: e.target.value
                    ? Number(e.target.value)
                    : undefined
                })
              }
              placeholder={t("createKeyModal.optional")}
              className={`mt-1 p-2 rounded-md w-full border focus:outline-none transition
                ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
            />
          </div>

          <div className="mt-4">
            <label
              className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              {t("createKeyModal.fields.format").toUpperCase()}:
            </label>
            <select
              id="format-selector"
              className={`p-2 rounded-md w-full mt-1 border focus:outline-none focus:ring transition
                ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:ring-gray-500" : "bg-gray-100 text-gray-900 border-gray-300 focus:ring-gray-400"}`}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option>TEXT</option>
              <option>JSON</option>
              <option>HTML</option>
              <option>XML</option>
              <option>JavaScript</option>
            </select>
          </div>

          <div className="mt-4">
            <label
              className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              {t("createKeyModal.fields.value").toUpperCase()}:
            </label>
            <div
              className={`p-3 rounded-md border mt-1 max-h-72 overflow-auto transition
                ${darkMode ? "bg-gray-700" : "bg-gray-100"}
                ${
                  valueError
                    ? "border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.6)]"
                    : darkMode
                      ? "border-gray-600"
                      : "border-gray-300"
                }`}
              aria-invalid={!!valueError}
            >
              <CodeMirror
                value={formData.value}
                onChange={(value) => {
                  setFormData({ ...formData, value });
                  if (valueError) setValueError("");
                }}
                extensions={languageExtension ? [languageExtension] : undefined}
                theme={darkMode ? "dark" : "light"}
                basicSetup={{ lineNumbers: true }}
              />
            </div>
            {valueError && (
              <p className="mt-1 text-xs text-red-500">{valueError}</p>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeCreateModal}
              className={toneButton("neutral", darkMode, "sm")}
            >
              {t("createKeyModal.cancel")}
            </button>
            <button
              type="submit"
              className={toneButton("success", darkMode, "sm")}
            >
              {t("createKeyModal.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateKeyModal;
