Firefox Enhancements 0.1.14 - Arkadiusz Pajda (Artllex)

PL
Instaluje usprawnienia Firefox i lokalne wsparcie Download Router. Nie zawiera XPI.
Rozszerzenie: https://github.com/Artllex/download-router
Usprawnienia: https://github.com/Artllex/firefox-zip-quick-extract
ChatGPT Workspace Setup nie jest wymagany. Zamknij Firefox przed instalacja.
Istniejacy folders.xml jest zachowany; nowa instalacja uzywa
LOCALAPPDATA\DownloadRouter\temp. Systemowy TEMP nie jest zmieniany.
Host zachowuje kompatybilna sciezke LOCALAPPDATA\Programs\ChatGPTFolderLauncher.
Log: LOCALAPPDATA\Programs\FirefoxEnhancements\update-result.txt

Brak nowego deinstalatora i skrotow. Zachowaj kopie poprzednich plikow.
Kopie konfiguracji Firefox: TEMP\FirefoxZipQuickExtract_backup_*.
Kopie hosta i manifestu: obok oryginalow, z sufiksem .backup-data.
Usuniecie katalogu instalatora nie cofa zmian. W razie czesciowego bledu sprawdz log.
Rozszerzenie XPI jest osobna instalacja; niepodpisana wersja jest tymczasowa.

EN
Installs Firefox enhancements and local Download Router support, not the extension.
Get the XPI from its separate repository above. ChatGPT Workspace Setup is not required.
Close Firefox before setup. Existing folder settings are preserved; no system TEMP change.
No shortcuts or new uninstaller. Keep backups. Removing setup files does not roll back
changes. A partial failure is recorded in update-result.txt. The unsigned XPI remains
a separate temporary installation until Mozilla signing.
