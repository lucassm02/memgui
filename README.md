# MemGUI

<p align="center">
  <img src="https://raw.githubusercontent.com/lucassm02/mem-gui/main/asset/images/logo-white.svg" alt="MemGUI Logo" width="160" />
</p>

[![Latest Release](https://img.shields.io/github/v/release/lucassm02/mem-gui?color=blue&label=Download)](https://github.com/lucassm02/mem-gui/releases)
[![License: Non-Commercial Use Only](https://img.shields.io/badge/license-NCU-orange.svg)](LICENSE)

**MemGUI** is a modern, intuitive GUI for **Memcached**ƒ?"perfect for anyone wanting to visualize, monitor, and manage cached data without wrestling with the command line. Whether you're handling a single Memcached instance or multiple servers at once, MemGUI makes your workflow faster and simpler.

---

## ÐYs? Why MemGUI?

- **Visually Manage Keys**: Create, edit (with text or JSON data), delete, and monitor keys in real time.
- **Auto-Refreshing Listings**: Keep an always up-to-date view of your keysƒ?"no manual refresh needed (unless you want to!).
- **Advanced Search**: Filter keys by keywords or use regex for pinpoint accuracy.
- **SASL Authentication**: Safely connect using username/password when your server requires it.
- **In-Depth Stats**: Get instant insights on uptime, memory usage, cache hits, slab details, and more.
- **Multi-Server Connections**: Easily switch between different Memcached servers without losing your flow.
- **Easy Setup Guide**: An optional step-by-step tutorial helps newcomers get started in seconds.
- **Dark & Light Themes**: Choose the interface style that feels best for you.

---

## ÐY"¾ Installation

To start using **MemGUI**, visit our [Releases page](https://github.com/lucassm02/mem-gui/releases). Two download options are provided:

1. **Portable (Unpacked)**

   - No installation required. Just unzip and run the executable.

2. **Setup (Installer)**
   - A guided installation wizard that walks you through setup on your system.

Pick the format you prefer and launch **MemGUI** to begin managing your Memcached servers!

---

## ÐY-¬ Screenshots

![Home](./screenshot/00-home.png)
![Help](./screenshot/01-help.png)
![Connection](./screenshot/02-connection.png)
![Advanced Connection](./screenshot/03-advanced-connection.png)
![Empty List](./screenshot/04-empty-list.png)
![Create key](./screenshot/05-create-key.png)
![List](./screenshot/06-list.png)
![Details](./screenshot/07-details.png)
![Edit key](./screenshot/08-edit-key.png)
![Auto refresh](./screenshot/09-auto-refresh.png)
![Filters](./screenshot/10-filter.png)
![Statistics](./screenshot/11-statistics.png)

---

## Internationalization

- Languages available: Portuguese (Brazil) and English. The UI picks the saved preference (`LANGUAGE` key) or falls back to your browser/OS locale.
- A language selector is always visible in the top bar (both connected and disconnected states).

**Adding a new language**
1. Copy an existing locale file (e.g., `src/ui/i18n/locales/pt-BR.json`) to `src/ui/i18n/locales/<language>.json` and translate the values.
2. Add the new language code to `supportedLanguages` in `src/ui/i18n/index.ts`.
3. In every locale file, include a label for the new code inside the `language` section so it appears correctly in the selector.

---

## ÐYÏ? Contributing

While **MemGUI** is licensed for **non-commercial use**, we welcome feedback and collaboration! Feel free to [open an issue](https://github.com/lucassm02/mem-gui/issues) or submit a pull request if you spot improvements, bugs, or have feature requests.

---

## ÐY"o License

This project is licensed under the **Non-Commercial Use Only License**. You are granted a limited, non-exclusive, and non-transferable license to use this software for personal, educational, or non-commercial research purposes only. Commercial useƒ?"including selling, offering paid services, or integrating this software into commercial productsƒ?"is strictly prohibited. For the full details, please see the [LICENSE](LICENSE) file.
