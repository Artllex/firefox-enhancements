# Firefox Enhancements

![Firefox Enhancements](assets/firefox-enhancements-icon.png)

Windows Firefox enhancements by Arkadiusz Pajda (Artllex), 2026. MIT.

Repository: https://github.com/Artllex/firefox-enhancements

## Current scope (0.1.41)

- Move Restore Previous Session and Clear Recent History directly below History in the main menu.
- Separate Firefox profile toggled with Ctrl+Alt+Space.
- Hide its windows and suspend its processes/media while hidden.
- Disable Firefox Sync in that profile. It is isolated, not encrypted.
- Firefox's native Ctrl+Shift+S shortcut starts the screenshot tool; FE does not replace it.
- Hover over a loaded image and press Ctrl+Shift+X to open Save Image As, without opening the context menu. Frames are supported. The helper currently reserves this combination globally while running.
- The image context menu keeps the requested link/image commands, both Inspect commands and extension-provided entries while hiding other native entries.

Download routing, ZIP extraction, deletion controls and download-history synchronization belong to [DownloadLens](https://github.com/Artllex/DownloadLens), not the current FE installer.

## Installation

Download Firefox-Enhancements-Setup-0.1.41.exe from the latest release and run it with Firefox closed. AutoConfig installation requires UAC approval. Build from source with Build.ps1 (Inno Setup 7 on PATH).

FE is privileged AutoConfig, not a WebExtension. FE 0.1.41 works alone or with DownloadLens Support 1.2.6 in either order, using one shared dispatcher. Recognized older installations are migrated with backups. Disabled modules are not reactivated; unknown or modified configurations remain protected.

Use uninstall.ps1 as administrator to remove integration. The separate profile data is retained. See INSTALLER-README.txt.

## Naming and compatibility

The repository was formerly firefox-zip-quick-extract. Historical releases retain their original version and asset names. AutoConfig filenames, ownership identifiers, profile paths and backup prefixes retain legacy names for compatibility.

Legacy download source files remain for reference but are not packaged or loaded by the current installer. This rename does not claim that the repository has been fully cleaned of historical code.

## License

MIT. See LICENSE.
# Update 0.1.18: shared AutoConfig

Firefox Enhancements and DownloadLens Support 1.2.6 use one `artllex.cfg`
dispatcher. Each package registers only its own module; neither requires the
other. Both installation orders and independent removal are supported. The last
removal deletes the dispatcher. Existing recognized configurations are migrated
with backups and ownership checks; unknown or modified files are preserved.
The common protocol implementation is shipped in both standalone installers and
tested byte-for-byte for equality. Download and FE feature code remain separate.

Automated tests cover clean installs, both orders, upgrades from a copy of the
installed legacy configuration, repeated updates and independent uninstalls.
Full interactive Firefox acceptance remains a separate test.
