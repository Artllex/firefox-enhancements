# Firefox Enhancements 0.1.41

- Hover save now supplies the loaded image MIME type and content disposition, matching Firefox's native image save action. Fixes HTML file-type selection for image URLs without an extension. Original image format is preserved, not converted to JPEG.

- Fix upgrade after rollback to 0.1.37: adopt only the exact known orphaned hover actor (SHA-256 allowlist). Unknown or modified files remain protected. Tested using a copy of the installed integration with DownloadLens enabled, including repeated install and rejection of a modified actor.

![Firefox Enhancements](https://raw.githubusercontent.com/Artllex/firefox-enhancements/v0.1.41/assets/firefox-enhancements-icon.png)

- Removed the redundant experimental screenshot shortcut and its low-level keyboard hook. Firefox already provides Ctrl+Shift+S.
- Ctrl+Shift+X saves the loaded image under the mouse pointer without opening the context menu, including images inside frames. The native save dialog is used.
- The existing Windows helper reserves this combination globally while running.
- Shortcut registration now continues even if Secret profile initialization fails, which previously terminated the helper before the diagnostic hotkey was registered.
- A content actor checks the current hover state on demand; previously hovered images are not cached.
- Save Image As remains the first command in the compact image context menu.
- The shortcuts remain part of Firefox Enhancements and independent of DownloadLens.
- Save Image As is the first image context-menu action.
- Image context menus retain the requested native actions and WebExtension entries, including generated IDs used by extensions such as IMU.
- Link-only context menus retain Open in New Tab, Open in New Window, both Copy Link actions, Send Link to Device and both Inspect actions.
- WebExtension entries are kept and moved to the end of compact link and image menus.

Close Firefox before installation. Administrator confirmation is required for Firefox integration. DownloadLens is optional and not bundled.

An isolated Firefox 155.0.1 test confirmed hover detection without a context menu and dispatch to the native save function. Moving away from the image dispatched nothing. The save dialog was intercepted for this automated test. The user subsequently installed 0.1.41 and confirmed that saving works correctly. Actor registration failures no longer abort other enhancements.

Independent, unofficial MIT-licensed tool. Firefox trademarks belong to their respective owners. Privileged AutoConfig is not a Mozilla-signed WebExtension.
