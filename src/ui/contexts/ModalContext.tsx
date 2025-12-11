import { createContext } from "react";
import { Connection } from "./ConnectionsContext";

type Key = {
  key: string;
  value: string;
  size: number;
  timeUntilExpiration?: number;
};

export type AlertType = "error" | "success" | "warning";

export interface ModalContextType {
  openEditModal: (itemToEdit: Key) => void;
  closeEditModal: () => void;
  showConfirm: (params: {
    message: string;
    onConfirm: () => void | Promise<void>;
    type?: AlertType;
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openViewDataModal: (dataToShow: Key) => void;
  closeViewDataModal: () => void;
  openConnectionModal: (connectionToEdit?: Connection | null) => void;
  openSetupGuideModal: () => void;
  closeConnectionModal: () => void;
  closeSetupGuideModal: () => void;
  showLoading: () => void;
  dismissLoading: () => void;
  showAlert: (message: string, type?: AlertType) => void;
  dismissAlert: () => void;
  setupGuideModalIsOpen: boolean;
  createModalIsOpen: boolean;
  editModalIsOpen: boolean;
  connectionModalIsOpen: boolean;
  alertModalIsOpen: boolean;
  alertModalMessage: string;
  alertModalType: AlertType;
  alertModalMode: "alert" | "confirm";
  alertModalConfirmLabel: string | null;
  alertModalCancelLabel: string | null;
  alertModalOnConfirm: (() => void | Promise<void>) | null;
  alertModalTitle: string | null;
  loadingModalIsOpen: boolean;
  viewDataModalIsOpen: boolean;
  itemToView: Key;
  itemToEdit: Key;
  isEditingConnection: boolean;
  connectionToEdit: Connection | null;
}

export const ModalContext = createContext<ModalContextType | undefined>(
  undefined
);
