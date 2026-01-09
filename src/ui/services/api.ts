import axios from "axios";

let connectionId = "";
let storagePassword = "";

const api = axios.create({
  baseURL: "/api"
});

api.interceptors.request.use((config) => {
  if (connectionId) {
    config.headers["X-Connection-ID"] = connectionId;
  }
  if (storagePassword) {
    config.headers["X-Storage-Password"] = storagePassword;
  }
  return config;
});

export const setConnectionId = (newConnectionId: string) => {
  connectionId = newConnectionId;
};

export const clearConnectionId = () => {
  connectionId = "";
};

export const setStoragePassword = (password: string) => {
  storagePassword = password;
};

export const clearStoragePassword = () => {
  storagePassword = "";
};

export default api;
