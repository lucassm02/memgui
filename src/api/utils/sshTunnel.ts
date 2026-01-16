import crypto from "crypto";
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
  expectedHostFingerprint?: string;
};

export type SshHostKeyErrorCode =
  | "SSH_HOST_KEY_UNVERIFIED"
  | "SSH_HOST_KEY_MISMATCH";

export class SshHostKeyError extends Error {
  code: SshHostKeyErrorCode;
  fingerprint: string;
  expectedFingerprint?: string;

  constructor(
    code: SshHostKeyErrorCode,
    fingerprint: string,
    expectedFingerprint?: string
  ) {
    super(
      code === "SSH_HOST_KEY_MISMATCH"
        ? "SSH host key does not match trusted fingerprint"
        : "SSH host key has not been trusted yet"
    );
    this.name = "SshHostKeyError";
    this.code = code;
    this.fingerprint = fingerprint;
    this.expectedFingerprint = expectedFingerprint;
  }
}

function normalizePrivateKey(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("\\n")) {
    return trimmed.replace(/\\n/g, "\n");
  }
  return trimmed;
}

function normalizeFingerprint(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatHostFingerprint(key: Buffer): string {
  const digest = crypto.createHash("sha256").update(key).digest("base64");
  return `SHA256:${digest}`;
}

export function createSshTunnel({
  sshHost,
  ssh,
  remoteHost,
  remotePort,
  readyTimeoutMs,
  expectedHostFingerprint
}: CreateSshTunnelOptions): Promise<SshTunnel> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let server: net.Server | null = null;
    let settled = false;
    let hostKeyFailure: {
      code: SshHostKeyErrorCode;
      fingerprint: string;
      expectedFingerprint?: string;
    } | null = null;

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
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    client.on("ready", () => {
      server = net.createServer((socket) => {
        client.forwardOut(
          LOCAL_HOST,
          0,
          remoteHost,
          remotePort,
          (err, stream) => {
            if (err) {
              socket.destroy();
              return;
            }

            socket.pipe(stream).pipe(socket);
            stream.on("error", () => socket.destroy());
            socket.on("error", () => stream.destroy());
          }
        );
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

        settled = true;
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
      if (hostKeyFailure) {
        fail(
          new SshHostKeyError(
            hostKeyFailure.code,
            hostKeyFailure.fingerprint,
            hostKeyFailure.expectedFingerprint
          )
        );
        return;
      }
      const error =
        err instanceof Error ? err : new Error("SSH connection error");
      if (!settled) {
        fail(error);
        return;
      }
      cleanup();
    });
    client.on("close", () => {
      if (!settled) {
        if (hostKeyFailure) {
          fail(
            new SshHostKeyError(
              hostKeyFailure.code,
              hostKeyFailure.fingerprint,
              hostKeyFailure.expectedFingerprint
            )
          );
          return;
        }
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
      readyTimeout: readyTimeoutMs,
      hostVerifier: (key) => {
        const fingerprint = formatHostFingerprint(key);
        const expected = normalizeFingerprint(expectedHostFingerprint);
        if (!expected) {
          hostKeyFailure = {
            code: "SSH_HOST_KEY_UNVERIFIED",
            fingerprint
          };
          return false;
        }
        if (fingerprint !== expected) {
          hostKeyFailure = {
            code: "SSH_HOST_KEY_MISMATCH",
            fingerprint,
            expectedFingerprint: expected
          };
          return false;
        }
        return true;
      }
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
