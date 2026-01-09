import { Connection } from "@/ui/contexts";

export const getConnectionIdentity = (connection: Connection) => {
  const ssh = connection.ssh;
  const sshTag = ssh
    ? `ssh:${ssh.port}:${ssh.username ?? ""}`
    : "direct";
  return `${connection.host}:${connection.port}|${sshTag}`;
};

export const isSameConnection = (left: Connection, right: Connection) =>
  getConnectionIdentity(left) === getConnectionIdentity(right);
