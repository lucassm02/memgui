import { createContext } from "react";

export type LanguageContextType = {
  language: string;
  changeLanguage: (newLanguage: string) => void;
  supported: string[];
};

export const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);
