# Local validation — 2026-09-16

2026-09-17 / 0.1.44: isolated Firefox 155 live Library test passed for the renamed eight headers, removal of leading www and path slash, reuse of the Name-column favicon source, a 16 x 16 px domain-image style rule, blank/marked star with persisted toggle, native Last Visit sorting, domain row ordering, custom marking and duration sorting, a real TabClose with last/total elapsed timing, and the `↱` open-in-new-tab action. No module errors were logged. Normal user-profile visual acceptance, private-window exclusion and shutdown-time persistence were not live-tested. No publication requested for this version.

User acceptance: after installing 0.1.41 the user confirmed "Dziala. Gotowe." following the JPEG fix and requested publication. This confirms the user's tested workflow, not exhaustive coverage of every site or image format.

0.1.41: live isolated Firefox with updated child actor returned image/jpeg from a loaded JPEG and production saveHoveredImage passed that MIME type to internalSave. Native initFileInfo and appendFiltersForContentType selected a JPEG extension/filter for an extensionless https://example.org/images URL. This fixes the missing MIME/disposition arguments; no forced JPEG conversion. Dialog interaction and disk download remain untested. Installed Firefox files/profile were not changed.

0.1.40 installer: update-result.txt identified an unowned FirefoxEnhancementsHoverChild.sys.mjs; its installed SHA-256 matched the known 0.1.38 artifact, while the ownership record lacked that entry. PASS on copied installed files: upgrade with both FE and DownloadLens active; ownership adoption; repeated installation; rejection and preservation of a modified orphan. No live installation was performed by these tests. The following runtime checks were performed on 0.1.39, whose hover logic is unchanged in 0.1.40.

v0.1.40: isolated headless Firefox 155.0.1, separate profile, real content actor and pointer actions. PASS: image under pointer returned without context menu; production saveHoveredImage dispatched internalSave with the matching URL; moving onto blank space dispatched nothing. internalSave was intercepted: the save dialog, actual disk write and physical Windows hotkey were not exercised by this test. The user previously confirmed key detection and context-menu saving in 0.1.37.

Fixed actor registration to use esModuleURI and safeForUntrustedWebProcess. Registration is caught independently so failure cannot abort other enhancements. Removed the browser-element :hover gate, which was false even while the content image was hovered in the live test. Local and installed child-module SHA-256 matched. Mock tests additionally cover shadow DOM, unloaded/hidden images, native context-menu dispatch and helper launch. Frames and the full installer still need interactive acceptance. Earlier attribution of helper failure to user.js access denial was not established; sandbox restrictions can produce that error.

v0.1.11: isolated Firefox test confirmed capture of `Mario (Europe) (En,Fr,De).zip` while Firefox produced `Mario (Europe) (En,Fr,De)(1).zip`. Native-host tests passed for restoring an original name, a destination collision and preserving a literal `(1)` suffix. Live romsfun.com download with this version has not yet been tested.

- PASS: native relocation module in an isolated copy of Firefox, separate profile, real Downloads/DownloadHistory APIs; target changed, change notification emitted, target exists.
- PASS: restart of that test profile retained the destination in download history.
- PASS: eight module checks (relocation, retry, source present, size mismatch, private record, ambiguity, wrong URL, relative path).
- PASS: Download Router extension logic tests and native host edge-case tests.
- PASS: installer copied the integrated module and existing features into an isolated directory.

User acceptance: after installation the user reported that the integration works perfectly. Individual UI actions were not separately documented. Future Firefox versions remain unverified. The headless harness loads the same synchronization module but does not exercise the entire ZIP interface or hidden-profile helper.

The user installed and accepted the package and authorized committing and pushing the integration. A new GitHub Release is separate from this source update.
