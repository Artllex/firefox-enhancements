# Firefox Enhancements 0.1.16 — local coexistence candidate

- Works with DownloadLens Support 1.2.5 using cooperative AutoConfig v1.
- Each active configuration loads its peer once through a local resource URI; disabled peers are not loaded.
- FE uninstall checks file ownership and preserves DownloadLens files and modified user files.
- Install/update/remove tested in both orders. Real isolated Firefox 155.0.1 loaded both configurations.
- Full acceptance of hotkey, ZIP and download routing on the user's installed browser remains to be tested.
- Close Firefox, update DownloadLens Support to 1.2.5, then install FE 0.1.16. Do not re-enable old disabled loaders.

Tests: powershell.exe -File tests/coexistence.ps1 -DownloadLensRoot <downloadlens-repo>; node tests/cooperative-loader.cjs <downloadlens-repo>.

## Historical 0.1.15 notes (superseded)

- Uses the approved Firefox Enhancements fox-and-sparkle icon in the Windows installer.
- Renames the project and repository to Firefox Enhancements.
- Keeps history menu shortcuts and the separate Ctrl+Alt+Space profile.
- Download features are no longer included in this installer; they belong to DownloadLens.

Windows only. Close Firefox before installation. Privileged AutoConfig requires UAC approval.
Another active AutoConfig (including DownloadLens Support) blocks installation. Do not overwrite it; co-installation is not currently supported.
The separate profile is not encrypted. Uninstall using uninstall.ps1 as administrator; profile data is retained.

MIT license for code. Firefox/Mozilla marks belong to their respective owners; this is an independent, unofficial project. The icon is a generated interpretation based on the supplied reference, not an official Mozilla endorsement.

The installer build was verified; it was not installed over the active DownloadLens integration.
