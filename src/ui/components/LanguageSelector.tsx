import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

import { useDarkMode, useLanguage } from "@/ui/hooks";

const LanguageSelector = () => {
  const { language, changeLanguage, supported } = useLanguage();
  const { darkMode } = useDarkMode();
  const { t } = useTranslation();

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-sm ${
        darkMode
          ? "border-gray-700 bg-gray-800 text-gray-200"
          : "border-gray-300 bg-white text-gray-700"
      }`}
    >
      <GlobeAltIcon className="w-4 h-4" />
      <label className="sr-only" htmlFor="language-selector">
        {t("language.label")}
      </label>
      <select
        id="language-selector"
        value={language}
        onChange={(event) => changeLanguage(event.target.value)}
        className={`bg-transparent focus:outline-none cursor-pointer ${
          darkMode ? "text-gray-200" : "text-gray-700"
        }`}
      >
        {supported.map((code) => (
          <option
            key={code}
            value={code}
            className={
              darkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }
          >
            {t(`language.${code}`)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
