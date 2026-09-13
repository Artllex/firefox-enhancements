# Firefox Enhancements

Windows Firefox enhancements by Arkadiusz Pajda (Artllex), 2026. MIT.

Repository: https://github.com/Artllex/firefox-enhancements

## Current scope (0.1.15)

- Move Restore Previous Session and Clear Recent History directly below History in the main menu.
- Separate Firefox profile toggled with Ctrl+Alt+Space.
- Hide its windows and suspend its processes/media while hidden.
- Disable Firefox Sync in that profile. It is isolated, not encrypted.

Download routing, ZIP extraction, deletion controls and download-history synchronization belong to [DownloadLens](https://github.com/Artllex/download-router), not the current FE installer.

## Installation

Build with Build.ps1 (Inno Setup 7 on PATH), then run Firefox-Enhancements-Setup-0.1.15.exe with Firefox closed. AutoConfig installation requires UAC approval.

FE is privileged AutoConfig, not a WebExtension. Another active AutoConfig configuration (including DownloadLens Support) blocks installation. Do not overwrite it. Simultaneous installation is not yet supported by these separate loaders.

Use uninstall.ps1 as administrator to remove integration. The separate profile data is retained. See INSTALLER-README.txt.

## Naming and compatibility

The repository was formerly firefox-zip-quick-extract. Historical releases retain their original version and asset names. AutoConfig filenames, ownership identifiers, profile paths and backup prefixes retain legacy names for compatibility.

Legacy download source files remain for reference but are not packaged or loaded by the current installer. This rename does not claim that the repository has been fully cleaned of historical code.

## License

MIT. See LICENSE.
