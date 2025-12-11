import ConnectedHeader from "@/ui/components/ConnectedHeader";
import ConnectionList from "@/ui/components/ConnectionList";
import KeyList from "@/ui/components/KeyList";

import { useDarkMode } from "@/ui/hooks/useDarkMode";

export function Panel() {
  const { darkMode } = useDarkMode();

  return (
    <>
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all ${
          darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
        }`}
      >
        <ConnectedHeader />
        <main className="flex-1 overflow-auto">
          <div className="w-full max-w-none mx-auto px-2 sm:px-3">
            <KeyList />
          </div>
          <ConnectionList />
        </main>
      </div>
    </>
  );
}
