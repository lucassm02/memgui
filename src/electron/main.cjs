const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

const DEV_SERVER_PORT = 5173;

const isDev = !app.isPackaged;

const HOST = "http://localhost";

const normalizeReleaseNotes = releaseNotes => {
  if (!releaseNotes) return "";

  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map(note => {
        if (typeof note === "string") return note;
        if (note && typeof note === "object" && "note" in note) {
          return note.note ?? "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  if (typeof releaseNotes === "object" && "note" in releaseNotes) {
    return releaseNotes.note ?? "";
  }

  if (typeof releaseNotes === "string") return releaseNotes;

  return "";
};

const toPlainText = text =>
  text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");

app.whenReady().then(async () => {
  let PRODUCTION_PORT = null;

  try {
    if (!isDev) {
      const serverPath = path.join(process.resourcesPath, "server.cjs");
      const { server } = require(serverPath);
      PRODUCTION_PORT = await server();
    }
  } catch (error) {
    app.quit();
  }

  const startURL = isDev
    ? `${HOST}:${DEV_SERVER_PORT}`
    : `${HOST}:${PRODUCTION_PORT}`;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const iconPath = path.join(__dirname, "..", "..", "asset", "mem-gui.ico");

  const mainWindow = new BrowserWindow({
    width: width - 100,
    height: height - 100,
    frame: false,
    show: false,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#1A1D2A",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: iconPath
  });

  mainWindow.loadURL(startURL);

  setTimeout(() => {
    mainWindow.show();
  }, 1_000);

  if (!isDev) {
    autoUpdater.autoDownload = true;
    const sendUpdateEvent = (channel, payload) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send(channel, payload);
    };

    autoUpdater.on("update-available", info => {
      sendUpdateEvent("auto-update-available", {
        version: info?.version,
        releaseDate: info?.releaseDate,
        releaseName: info?.releaseName,
        releaseNotes: toPlainText(normalizeReleaseNotes(info?.releaseNotes))
      });
    });

    autoUpdater.on("error", error => {
      console.error("Auto update error:", error);
      sendUpdateEvent("auto-update-error", {
        message: error?.message ?? "Update error"
      });
    });

    autoUpdater.on("update-downloaded", (_event, info) => {
      sendUpdateEvent("auto-update-downloaded", {
        version: info?.version,
        releaseName: info?.releaseName,
        releaseDate: info?.releaseDate,
        releaseNotes: toPlainText(normalizeReleaseNotes(info?.releaseNotes))
      });
    });

    autoUpdater.checkForUpdatesAndNotify();
  }

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximized");
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-unmaximized");
  });

  if (isDev) {
    globalShortcut.register("CommandOrControl+Shift+I", () => {
      mainWindow.webContents.toggleDevTools({ mode: "detach" });
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("window-close", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

ipcMain.on("window-minimize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.on("window-maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win && !win.isMaximized()) {
    win.maximize();
  }
});

ipcMain.on("window-unmaximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win && win.isMaximized()) {
    win.unmaximize();
  }
});

ipcMain.on("auto-update-install", () => {
  if (!isDev) {
    autoUpdater.quitAndInstall();
  }
});
