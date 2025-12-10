import { ReactNode, useEffect, useMemo, useState } from "react";

import { LanguageContext } from "@/ui/contexts";
import { useStorage } from "@/ui/hooks";
import { supportedLanguages } from "@/ui/i18n";
import i18n from "@/ui/i18n";

const normalizeLanguage = (value: string | undefined) => {
  if (!value) return supportedLanguages[0];

  const exact = supportedLanguages.find((item) => item === value);
  if (exact) return exact;

  const fallback = supportedLanguages.find((item) =>
    item.startsWith(value.split("-")[0])
  );

  return fallback || supportedLanguages[0];
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { getKey, setKey } = useStorage();
  const [language, setLanguage] = useState(supportedLanguages[0]);
  const [loaded, setLoaded] = useState(false);

  const availableLanguages = useMemo(() => [...supportedLanguages], []);

  useEffect(() => {
    const load = async () => {
      const storedLanguage = await getKey("LANGUAGE");
      const navigatorLanguage =
        (navigator.languages && navigator.languages[0]) || navigator.language;

      const selected = normalizeLanguage(
        (storedLanguage?.value as string) || navigatorLanguage
      );

      setLanguage(selected);
      i18n.changeLanguage(selected);
      setLoaded(true);
    };

    load();
  }, [getKey]);

  const changeLanguage = (newLanguage: string) => {
    const normalized = normalizeLanguage(newLanguage);
    setLanguage(normalized);
    setKey("LANGUAGE", normalized);
    i18n.changeLanguage(normalized);
  };

  if (!loaded) return null;

  return (
    <LanguageContext.Provider
      value={{
        language,
        changeLanguage,
        supported: availableLanguages
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
