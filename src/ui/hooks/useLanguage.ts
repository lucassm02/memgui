import { useContext } from "react";

import { LanguageContext, LanguageContextType } from "@/ui/contexts";

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }

  return context;
};
