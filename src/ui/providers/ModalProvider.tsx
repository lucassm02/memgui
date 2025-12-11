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
  const [alertModalMode, setAlertModalMode] = useState<"alert" | "confirm">(
    "alert"
  );
  const [alertModalConfirmLabel, setAlertModalConfirmLabel] = useState<
    string | null
  >(null);
  const [alertModalCancelLabel, setAlertModalCancelLabel] = useState<
    string | null
  >(null);
  const [alertModalOnConfirm, setAlertModalOnConfirm] = useState<
    (() => void | Promise<void>) | null
  >(null);
  const [alertModalTitle, setAlertModalTitle] = useState<string | null>(null);
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
    setAlertModalMode("alert");
    setAlertModalConfirmLabel(null);
    setAlertModalCancelLabel(null);
    setAlertModalOnConfirm(null);
    setAlertModalTitle(null);
  };

  const dismissAlert = () => {
    setAlertModalIsOpen(false);
    setAlertModalMode("alert");
    setAlertModalConfirmLabel(null);
    setAlertModalCancelLabel(null);
    setAlertModalOnConfirm(null);
    setAlertModalTitle(null);
  };

  const showConfirm = ({
    message,
    onConfirm,
    type = "warning",
    title,
    confirmLabel,
    cancelLabel
  }: {
    message: string;
    onConfirm: () => void | Promise<void>;
    type?: AlertType;
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => {
    setAlertModalIsOpen(true);
    setAlertModalMessage(message);
    setAlertModalType(type);
    setAlertModalMode("confirm");
    setAlertModalOnConfirm(() => onConfirm);
    setAlertModalTitle(title ?? null);
    setAlertModalConfirmLabel(confirmLabel ?? null);
    setAlertModalCancelLabel(cancelLabel ?? null);
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
        showConfirm,
        dismissAlert,
        alertModalIsOpen,
        alertModalMessage,
        alertModalType,
        alertModalMode,
        alertModalConfirmLabel,
        alertModalCancelLabel,
        alertModalOnConfirm,
        alertModalTitle,
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
