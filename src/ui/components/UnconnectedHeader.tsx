import { Bars3Icon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";

import LanguageSelector from "./LanguageSelector";
import { useDarkMode, useMenu } from "@/ui/hooks";

const UnconnectedHeader = () => {
  const { openMenu } = useMenu();
  const { darkMode, toggleDarkMode } = useDarkMode();

  return (
    <header
      className={`p-4 border-b flex items-center justify-between ${darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"}`}
    >
      <button
        onClick={openMenu}
        className={`cursor-pointer p-2 rounded-lg ${darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-200"}`}
      >
        <Bars3Icon className="w-6 h-6" />
      </button>

      <div className="flex items-center gap-3">
        <LanguageSelector />
        <button
          onClick={toggleDarkMode}
          className={`cursor-pointer p-2 rounded-lg ${darkMode ? "text-blue-400 hover:bg-gray-700" : "text-blue-600 hover:bg-gray-100"}`}
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
