# Local validation — 2026-09-12

- PASS: native relocation module in an isolated copy of Firefox, separate profile, real Downloads/DownloadHistory APIs; target changed, change notification emitted, target exists.
- PASS: restart of that test profile retained the destination in download history.
- PASS: eight module checks (relocation, retry, source present, size mismatch, private record, ambiguity, wrong URL, relative path).
- PASS: Download Router extension logic tests and native host edge-case tests.
- PASS: installer copied the integrated module and existing features into an isolated directory.

User acceptance: after installation the user reported that the integration works perfectly. Individual UI actions were not separately documented. Future Firefox versions remain unverified. The headless harness loads the same synchronization module but does not exercise the entire ZIP interface or hidden-profile helper.

The user installed and accepted the package and authorized committing and pushing the integration. A new GitHub Release is separate from this source update.
