/* eslint-disable react-hooks/exhaustive-deps */
import React, { ReactNode, useEffect, useState } from "react";
import { DarkModeContext } from "../contexts";
import { useStorage } from "../hooks";

export interface DarkModeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

interface DarkModeProviderProps {
  children: ReactNode;
}

export const DarkModeProvider: React.FC<DarkModeProviderProps> = ({
  children
}) => {
  const [darkMode, setDarkMode] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const { setKey, getKey, storageVersion } = useStorage();

  async function load() {
    const data = await getKey("DARK_MODE");
    if (!data) {
      setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
    } else {
      setDarkMode(data.value as boolean);
    }

    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, [storageVersion]);

  function toggleDarkMode() {
    document.documentElement.classList.toggle("dark", darkMode);
    setKey("DARK_MODE", !darkMode);
    setDarkMode(!darkMode);
  }

  if (!loaded) return null;

  return (
    <DarkModeContext.Provider
      value={{
        darkMode,
        toggleDarkMode
      }}
    >
      {children}
    </DarkModeContext.Provider>
  );
};
