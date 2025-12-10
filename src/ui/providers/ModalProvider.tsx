import { ReactNode, useState } from "react";
import { AlertType, Connection, ModalContext } from "../contexts";

type Key = {
  key: string;
  value: string;
  size: number;
  timeUntilExpiration?: number;
};

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [createModalIsOpen, setCreateModalIsOpen] = useState(false);
  const [editModalIsOpen, setEditModalIsOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Key>({
    key: "",
    value: "",
    size: 0
  });
  const [alertModalIsOpen, setAlertModalIsOpen] = useState(false);
  const [alertModalMessage, setAlertModalMessage] = useState("");
  const [alertModalType, setAlertModalType] = useState<AlertType>("error");
  const [loadingModalIsOpen, setLoadingModalIsOpen] = useState(false);
  const [viewDataModalIsOpen, setViewDataModalIsOpen] = useState(false);
  const [connectionModalIsOpen, setConnectionModalIsOpen] = useState(false);
  const [setupGuideModalIsOpen, setSetupGuideModalIsOpen] = useState(false);
  const [connectionToEdit, setConnectionToEdit] = useState<Connection | null>(
    null
  );
  const [isEditingConnection, setIsEditingConnection] = useState(false);
  const [itemToView, setItemToView] = useState<Key>({
    key: "",
    value: "",
    size: 0
  });

  const openEditModal = (itemToEdit: Key) => {
    setEditModalIsOpen(true);
    setItemToEdit(itemToEdit);
  };

  const closeEditModal = () => {
    setEditModalIsOpen(false);
    setItemToEdit({ key: "", value: "", size: 0 });
  };

  const openCreateModal = () => {
    setCreateModalIsOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalIsOpen(false);
  };

  const openConnectionModal = (connection?: Connection | null) => {
    const isConnectionObject =
      connection &&
      typeof connection === "object" &&
      "host" in connection &&
      "port" in connection;

    const parsedConnection = isConnectionObject ? connection : null;

    setConnectionToEdit(parsedConnection);
    setIsEditingConnection(!!parsedConnection);
    setConnectionModalIsOpen(true);
  };

  const closeConnectionModal = () => {
    setConnectionModalIsOpen(false);
    setConnectionToEdit(null);
    setIsEditingConnection(false);
  };

  const openSetupGuideModal = () => {
    setSetupGuideModalIsOpen(true);
  };

  const closeSetupGuideModal = () => {
    setSetupGuideModalIsOpen(false);
  };

  const showAlert = (message: string, type: AlertType = "error") => {
    setAlertModalIsOpen(true);
    setAlertModalMessage(message);
    setAlertModalType(type);
  };

  const dismissAlert = () => {
    setAlertModalIsOpen(false);
  };

  const showLoading = () => {
    setLoadingModalIsOpen(true);
  };

  const dismissLoading = () => {
    setLoadingModalIsOpen(false);
  };

  const openViewDataModal = (dataToShow: Key) => {
    setViewDataModalIsOpen(true);
    setItemToView(dataToShow);
  };

  const closeViewDataModal = () => {
    setViewDataModalIsOpen(false);
    setItemToView({ key: "", value: "", size: 0 });
  };

  return (
    <ModalContext.Provider
      value={{
        openCreateModal,
        closeCreateModal,
        closeEditModal,
        openEditModal,
        itemToEdit,
        createModalIsOpen,
        editModalIsOpen,
        showAlert,
        dismissAlert,
        alertModalIsOpen,
        alertModalMessage,
        alertModalType,
        dismissLoading,
        loadingModalIsOpen,
        showLoading,
        closeViewDataModal,
        openViewDataModal,
        viewDataModalIsOpen,
        itemToView,
        closeConnectionModal,
        connectionModalIsOpen,
        openConnectionModal,
        closeSetupGuideModal,
        openSetupGuideModal,
        setupGuideModalIsOpen,
        isEditingConnection,
        connectionToEdit
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};
