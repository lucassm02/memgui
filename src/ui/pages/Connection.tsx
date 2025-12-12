/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from "react";
import { useNavigate } from "react-router";
import ConnectionHome from "@/ui/components/ConnectionHome";
import ConnectionList from "@/ui/components/ConnectionList";
import ConnectionModal from "@/ui/components/ConnectionModal";
import SetupGuide from "@/ui/components/SetupGuide";
import UnconnectedHeader from "@/ui/components/UnconnectedHeader";

import { Connection as ConnectionType } from "@/ui/contexts";
import { useMenu, useModal } from "@/ui/hooks";
import { useConnections } from "@/ui/hooks/useConnections";
import { useDarkMode } from "@/ui/hooks/useDarkMode";

type SubmitParams = {
  name: string;
  host: string;
  port: number;
  timeout: number;
  username?: string;
  password?: string;
};

export function Connection() {
  const {
    handleConnect,
    savedConnections,
    handleEditConnection,
    handleTestConnection
  } = useConnections();
  const navigate = useNavigate();

  const { darkMode } = useDarkMode();
  const { openConnectionModal } = useModal();
  const { openMenu } = useMenu();

  useEffect(() => {
    if (savedConnections.length > 0) {
      openMenu();
    }
  }, [savedConnections]);

  async function handleSubmit(
    params: SubmitParams,
    options: { isEditing: boolean; previousConnection?: ConnectionType }
  ) {
    if (options.isEditing) {
      handleEditConnection({ ...params, id: "" }, options.previousConnection);
      return;
    }

    const redirect = await handleConnect(params);

    if (!redirect) {
      openConnectionModal();
      return;
    }
    navigate("/panel");
  }

  return (
    <>
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all ${
          darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
        }`}
      >
        <UnconnectedHeader />
        <main className="flex-1 overflow-hidden">
          <ConnectionModal
            onSubmit={handleSubmit}
            onTest={handleTestConnection}
          />
          <ConnectionHome />
          <ConnectionList />
          <SetupGuide />
        </main>
      </div>
    </>
  );
}
