import http from "http";
import path from "path";
import dotenv from "dotenv";
import express from "express";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import connectionsRoutes from "./api/routes/connections";
import keysRoutes from "./api/routes/keys";
import storagesRoutes from "./api/routes/storages";
import { logger } from "./api/utils";
import { registerDumpWebsocket } from "./api/ws/dump";
import { registerImportWebsocket } from "./api/ws/import";

function loadEnvFile(dev: boolean = false) {
  if (!dev) return;
  const envPath = path.resolve(process.cwd(), ".env");
  dotenv.config({ path: envPath });
}

export async function server(port = 0, dev: boolean = false, host?: string) {
  try {
    process.env.MEMGUI_DEV = dev ? "true" : "false";
    const app = express();

    app.use(express.json());

    app.use("/api", storagesRoutes);
    app.use("/api", connectionsRoutes);
    app.use("/api", keysRoutes);

    if (dev) {
      const { createServer } = await import("vite");

      const vite = await createServer({
        logLevel: "silent",
        server: { middlewareMode: true }
      });

      app.use(vite.middlewares);

      app.use("*", async (req, res, next) => {
        try {
          const url = req.originalUrl;
          let template = await vite.transformIndexHtml(
            url,
            "<!-- VITE TEMPLATE -->"
          );
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (err) {
          vite.ssrFixStacktrace(err);
          next(err);
        }
      });
    } else {
      app.use(express.static(path.join(__dirname, "public")));

      app.get("/", (_, res) => {
        res.sendFile(path.join(__dirname, "public", "index.html"));
      });
    }

    let address: { port: number };

    const server = http.createServer(app);
    const dumpWss = registerDumpWebsocket();
    const importWss = registerImportWebsocket();

    server.on("upgrade", (request, socket, head) => {
      const host = request.headers.host ?? "localhost";
      const url = request.url ? new URL(request.url, `http://${host}`) : null;
      const pathname = url?.pathname ?? "";

      if (pathname === "/ws/dump") {
        dumpWss.handleUpgrade(request, socket, head, (ws) => {
          dumpWss.emit("connection", ws, request);
        });
        return;
      }

      if (pathname === "/ws/import") {
        importWss.handleUpgrade(request, socket, head, (ws) => {
          importWss.emit("connection", ws, request);
        });
        return;
      }

      if (pathname.startsWith("/ws/")) {
        socket.destroy();
      }
    });

    function listenAsync(port = 0, host?: string) {
      return new Promise((resolve, reject) => {
        server.listen({ port, host }, () => {
          server.on("error", (error) => {
            reject(error);
          });

          resolve(server);
        });
      });
    }

    await listenAsync(port, host);

    address = <{ port: number }>server.address()!;

    logger.info(`Servidor rodando em http://localhost:${address.port}`);
    return address!.port;
  } catch (error) {
    logger.error(error);
  }
}

const cli = yargs(hideBin(process.argv));

cli.option("port", {
  alias: "p",
  describe: "Set server port",
  type: "number"
});

cli.option("host", {
  alias: "h",
  describe: "Set server hots",
  type: "string"
});

cli.option("start", {
  describe:
    "Defines whether the server should start or just export the start function",
  type: "boolean"
});

cli.option("dev", {
  describe: "Defines whether the server is in development mode",
  type: "boolean"
});

type Argv = { port?: number; host?: string; start?: boolean; dev?: boolean };

const { port, host, start, dev } = cli.argv as Argv;

if (start) {
  loadEnvFile(dev);
  server(port, dev, host);
}
