import { I18nextProvider } from "react-i18next";
import { Route, Routes } from "react-router-dom";
import ErrorModal from "@/ui/components/ErrorModal";
import LoadingModal from "@/ui/components/LoadingModal";

import TitleBar from "@/ui/components/TitleBar";
import i18n from "@/ui/i18n";
import { Connection } from "@/ui/pages/Connection";
import { Panel } from "@/ui/pages/Panel";
import { Dashboard } from "@/ui/pages/Statistics";
import {
  ConnectionsProvider,
  DarkModeProvider,
  LanguageProvider,
  MenuProvider,
  ModalProvider,
  ElectronProvider,
  StorageProvider
} from "@/ui/providers";

const App = () => (
  <I18nextProvider i18n={i18n}>
    <ElectronProvider>
      <StorageProvider>
        <LanguageProvider>
          <DarkModeProvider>
            <ModalProvider>
              <ConnectionsProvider>
                <MenuProvider>
                  <div className="h-screen flex flex-col">
                    <TitleBar />
                    <LoadingModal />
                    <ErrorModal />
                    <Routes>
                      <Route path="/" element={<Connection />} />
                      <Route path="/panel" element={<Panel />} />
                      <Route path="/statistics" element={<Dashboard />} />
                    </Routes>
                  </div>
                </MenuProvider>
              </ConnectionsProvider>
            </ModalProvider>
          </DarkModeProvider>
        </LanguageProvider>
      </StorageProvider>
    </ElectronProvider>
  </I18nextProvider>
);

export default App;
