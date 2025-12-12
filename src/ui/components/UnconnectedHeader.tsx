import { Bars3Icon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";

import LanguageSelector from "./LanguageSelector";
import { useDarkMode, useMenu } from "@/ui/hooks";
import { toneButton } from "@/ui/utils/buttonTone";

const UnconnectedHeader = () => {
  const { openMenu } = useMenu();
  const { darkMode, toggleDarkMode } = useDarkMode();

  return (
    <header
      className={`p-4 border-b flex items-center justify-between ${darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"}`}
    >
      <button
        onClick={openMenu}
        className={toneButton("neutral", darkMode, "icon")}
      >
        <Bars3Icon className="w-6 h-6" />
      </button>

      <div className="flex items-center gap-3">
        <LanguageSelector />
        <button
          onClick={toggleDarkMode}
          className={toneButton("neutral", darkMode, "icon")}
        >
          {darkMode ? (
            <SunIcon className="w-6 h-6" />
          ) : (
            <MoonIcon className="w-6 h-6" />
          )}
        </button>
      </div>
    </header>
  );
};

export default UnconnectedHeader;
