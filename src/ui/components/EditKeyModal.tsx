import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { XMarkIcon } from "@heroicons/react/24/solid";
import CodeMirror from "@uiw/react-codemirror";
import { useState, useEffect, FormEvent, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useDarkMode } from "../hooks/useDarkMode";
import { useModal } from "../hooks/useModal";
import { toneButton } from "../utils/buttonTone";

type Key = {
  key: string;
  value: string;
  size: number;
  timeUntilExpiration?: number;
};
type Params = { onSave: (key: Key) => void };

const EditKeyModal = ({ onSave }: Params) => {
  const { editModalIsOpen, closeEditModal, itemToEdit } = useModal();
  const { darkMode } = useDarkMode();
  const { t } = useTranslation();

  const [value, setValue] = useState(itemToEdit?.value || "");
  const [timeUntilExpiration, setTimeUntilExpiration] = useState(
    itemToEdit?.timeUntilExpiration !== undefined
      ? itemToEdit.timeUntilExpiration
      : ""
  );
  const [format, setFormat] = useState("TEXT");

  useEffect(() => {
    if (itemToEdit) {
      setValue(itemToEdit.value || "");
      setTimeUntilExpiration(
        itemToEdit.timeUntilExpiration !== undefined
          ? itemToEdit.timeUntilExpiration
          : ""
      );
      setFormat("TEXT");
    }
  }, [itemToEdit]);

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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) {
      onSave({
        ...itemToEdit,
        value,
        timeUntilExpiration: timeUntilExpiration
          ? Number(timeUntilExpiration)
          : undefined
      });
      closeEditModal();
    }
  };

  if (!editModalIsOpen || !itemToEdit) return null;

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
          <h2 className="text-lg font-medium">{t("editKeyModal.title")}</h2>
          <button
            onClick={closeEditModal}
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
              {t("editKeyModal.fields.key").toUpperCase()}:
            </label>
            <input
              type="text"
              value={itemToEdit.key}
              readOnly
              className={`mt-1 w-full p-2 rounded-md cursor-not-allowed
                ${darkMode ? "bg-gray-700 text-white border-gray-600 opacity-75" : "bg-gray-100 text-gray-900 border-gray-300"}`}
            />
          </div>

          <div className="mt-4">
            <label
              className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              {t("editKeyModal.fields.expiration").toUpperCase()}:
            </label>
            <input
              type="number"
              min={0}
              value={timeUntilExpiration}
              onChange={(e) => setTimeUntilExpiration(e.target.value)}
              placeholder={t("createKeyModal.optional")}
              className={`mt-1 w-full p-2 rounded-md border focus:outline-none transition
                ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-blue-400" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-blue-500"}`}
            />
          </div>

          <div className="mt-4">
            <label
              className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
            >
              {t("editKeyModal.fields.format").toUpperCase()}:
            </label>
            <select
              id="format-selector"
              className={`mt-1 p-2 rounded-md w-full border focus:outline-none focus:ring transition
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
              {t("editKeyModal.fields.value").toUpperCase()}:
            </label>
            <div
              className={`mt-1 p-3 rounded-md border max-h-72 overflow-auto transition
                ${darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-100 border-gray-300"}`}
            >
              <CodeMirror
                value={value}
                onChange={setValue}
                extensions={languageExtension ? [languageExtension] : undefined}
                theme={darkMode ? "dark" : "light"}
                basicSetup={{ lineNumbers: true }}
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeEditModal}
              className={toneButton("neutral", darkMode, "sm")}
            >
              {t("editKeyModal.cancel")}
            </button>
            <button
              type="submit"
              className={toneButton("primary", darkMode, "sm")}
            >
              {t("editKeyModal.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditKeyModal;
