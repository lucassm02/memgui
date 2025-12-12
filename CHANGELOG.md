# Changelog

All notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org/) and uses the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## [1.1.0] - 2025-12-12

### Added

- **Connection editing** directly from the connection list via the existing modal flow.
- **Bulk key deletion** endpoint and UI action to remove all keys from the current server.
- **Update and auto-update notices** surfaced in the UI/Electron shell when new builds are available.
- **Server key count** displayed across the key list and statistics screens.
- **Mandatory field warnings** in the create-key form to prevent empty submissions.
- **Internationalization (i18n)** across the UI using i18next with language auto-detection (browser) and persistence via storage.
- **Language Selector** in the header (connected and disconnected views) to switch between Portuguese (Brazil) and English.
- **Locale Files & Provider**: structured translation resources for `pt-BR` and `en`, plus a dedicated provider/hook to manage language changes.
- **Documentation** on how to add new languages, where to place locale files, and how detection/persistence works.

### Changed

- **Key search** now handled in the backend with optimized queries and a refreshed key list experience.
- **Connection switching and list UI** refined for smoother transitions and clearer presentation.
- **General UI polish** across headers, modals, and button tones for better layout and readability.
- **UI Text & Error Messages** now sourced from translation keys instead of hardcoded strings.
- **Statistics & Modals** updated to render translated labels, placeholders, and messages using the translation hooks.

### Fixed

- **Expiration calculations** now handle negative `timeUntilExpiration` values correctly.
- **Zero-length responses** fallback added to avoid crashes when reading empty payloads.
- **Header alignment** adjusted to keep UI elements centered.

## [1.0.0] - 2025-02-11

### Added

- **Welcome Screen** displaying a welcome message, a “Create New Connection” button, and a setup guide.
- **Connection Creation/Editing Form** supporting username, password, and timeout (SASL).
- **Disclaimer** about key management limitations when using SASL authentication.
- **Enhanced Key Listing** with a search bar (including regex support) and a selectable number of displayed results.
- **Auto-Update Functionality** to automatically refresh the key list.
- **Data Visualization Modal** for detailed inspection of key values (e.g., JSON).
- **Data Formats (TEXT, JSON, etc.)** when creating/editing keys.
- **Statistics Screen** showing Memcached server metrics (uptime, connections, GET/SET, memory usage, slabs, etc.).

### Changed

- **Project Organization**:
  - Added a routing system to improve navigation structure.
  - Reconfigured folders and build settings to avoid conflicts.
- **User Experience (UI/UX)**:
  - Introduced new icons, logos, and layouts compatible with the application theme.
  - Streamlined the flow for creating, editing, and viewing keys.
  - Removed extra loading steps during auto-updates, making the process smoother.

### Fixed

- **More Robust Error Handling**, preventing application crashes with invalid inputs.
- **Script path** and build process corrections.
- **Window Title Handling** so it is not improperly displayed in browser environments.
- **Form Value Type Conversion**, ensuring consistent data submission (e.g., numeric vs. string values).
- **Local Storage** switched from `localStorage` to `API Storage` to bypass limitations and prevent data loss.
- **Statistics Fields** adjustments, fixing calculations for requests per second and size metrics.

### Removed

- _(No existing features from the previous version were removed; any items not present before are simply not included.)_

## [0.1.0] - 2025-02-02

### Added

- **Initial Release**:
  - Complete release of MemGUI.
  - Graphical user interface for managing Memcached databases and cache.
  - Key management functionalities:
    - Create, edit, and delete keys.
    - Display key details such as key name, stored value, TTL, and content size.
  - Multi-server support for connecting to multiple Memcached instances simultaneously.
  - User-friendly interface with both light and dark modes.
  - Navigation improvements for efficient key and server management.
  - Visual examples with screenshots for connection screen, key list, key creating, key editing, and switch connection.
