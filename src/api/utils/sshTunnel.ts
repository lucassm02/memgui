import net from "net";
import { Client, ConnectConfig } from "ssh2";
import { SshConfig, SshTunnel } from "@/api/types";

const LOCAL_HOST = "127.0.0.1";

type CreateSshTunnelOptions = {
  sshHost: string;
  ssh: SshConfig;
  remoteHost: string;
  remotePort: number;
  readyTimeoutMs?: number;
};

function normalizePrivateKey(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("\\n")) {
    return trimmed.replace(/\\n/g, "\n");
  }
  return trimmed;
}

export function createSshTunnel({
  sshHost,
  ssh,
  remoteHost,
  remotePort,
  readyTimeoutMs
}: CreateSshTunnelOptions): Promise<SshTunnel> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let server: net.Server | null = null;
    let resolved = false;

    const cleanup = () => {
      if (server) {
        try {
          server.close();
        } catch {
          // Ignore close errors.
        }
        server = null;
      }
      try {
        client.end();
      } catch {
        // Ignore close errors.
      }
    };

    const fail = (error: Error) => {
      if (resolved) return;
      cleanup();
      reject(error);
    };

    client.on("ready", () => {
      server = net.createServer((socket) => {
        client.forwardOut(LOCAL_HOST, 0, remoteHost, remotePort, (err, stream) => {
          if (err) {
            socket.destroy();
            return;
          }

          socket.pipe(stream).pipe(socket);
          stream.on("error", () => socket.destroy());
          socket.on("error", () => stream.destroy());
        });
      });

      server.once("error", (err) =>
        fail(err instanceof Error ? err : new Error("SSH tunnel error"))
      );

      server.listen(0, LOCAL_HOST, () => {
        const address = server?.address();
        if (!address || typeof address === "string") {
          fail(new Error("Failed to allocate SSH tunnel port"));
          return;
        }

        resolved = true;
        resolve({
          client,
          server,
          localHost: LOCAL_HOST,
          localPort: address.port,
          remoteHost,
          remotePort
        });
      });
    });

    client.on("error", (err) => {
      const error =
        err instanceof Error ? err : new Error("SSH connection error");
      if (!resolved) {
        fail(error);
        return;
      }
      cleanup();
    });
    client.on("close", () => {
      if (!resolved) {
        fail(new Error("SSH connection closed before tunnel was ready"));
        return;
      }
      cleanup();
    });

    const privateKey = normalizePrivateKey(ssh.privateKey);
    const config: ConnectConfig = {
      host: sshHost,
      port: ssh.port,
      username: ssh.username,
      readyTimeout: readyTimeoutMs
    };

    if (privateKey) {
      config.privateKey = privateKey;
    }
    if (ssh.password) {
      config.password = ssh.password;
    }

    if (!config.password && !config.privateKey) {
      fail(new Error("SSH authentication missing password or private key"));
      return;
    }

    client.connect(config);
  });
}

export function closeSshTunnel(tunnel?: SshTunnel) {
  if (!tunnel) return;
  try {
    tunnel.server.close();
  } catch {
    // Ignore close errors.
  }
  try {
    tunnel.client.end();
  } catch {
    // Ignore close errors.
  }
}
