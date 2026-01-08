import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import ptBR from "./locales/pt-BR.json";
import zhCN from "./locales/zh-CN.json";

export const supportedLanguages = [
  "pt-BR",
  "en",
  "es",
  "fr",
  "de",
  "zh-CN",
  "ja",
  "ko",
  "ar"
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "pt-BR": { translation: ptBR },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      "zh-CN": { translation: zhCN },
      ja: { translation: ja },
      ko: { translation: ko },
      ar: { translation: ar }
    },
    fallbackLng: "pt-BR",
    supportedLngs: supportedLanguages,
    detection: {
      order: ["navigator"],
      caches: []
    },
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
