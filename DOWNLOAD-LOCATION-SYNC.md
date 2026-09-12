# Download location synchronization — v0.1.10 local preview

## PL

Moduł jest częścią istniejącego AutoConfig ZIP Quick Extract. Nie instaluje drugiej konfiguracji ani nie modyfikuje plików wykonywalnych Firefoxa.

Wymaga nowego komponentu lokalnego Download Router (`FirefoxDownloadHost.exe`) i rozszerzenia 1.1.6 z dołączonego pakietu. Starszy komponent nie generuje żądań synchronizacji. Samo zainstalowanie ZIP Quick Extract nie aktualizuje komponentu Download Router.

Komponent po przeniesieniu pliku zapisuje żądanie w `%LOCALAPPDATA%\Programs\ChatGPTFolderLauncher\sync-requests`. Firefox sprawdza kolejkę co sekundę. Dopasowanie wymaga zgodności starej ścieżki, adresu pobrania i czasu rozpoczęcia. Nowy plik musi istnieć i mieć właściwy rozmiar, a stary musi być nieobecny. Po aktualizacji powiadamiany jest natywny panel i zapisywana historia.

Pobrania prywatne nie są zapisywane w kolejce. Niedopasowane żądania pozostają dla innych profili; po 24 godzinach od rozpoczęcia pobrania są ignorowane. Starsze pobrania nie są naprawiane wstecz. Moduł nie nasłuchuje w sieci ani nie wykonuje poleceń z kolejki.

Instalacja ZIP: zamknij Firefox, rozpakuj pakiet i uruchom INSTALL.bat. Instalator wykonuje kopię poprzednich plików i obejmuje moduł synchronizacji. Deinstalator usuwa moduł razem z ZIP Quick Extract. Ustawienia Download Router pozostają bez zmian.

To integracja z wewnętrznymi mechanizmami Firefoxa: zgodności z przyszłymi aktualizacjami nie można zagwarantować. Wersja testowa nie została jeszcze sprawdzona przez użytkownika w głównym profilu.

Aktualizacja komponentu: po zamknięciu Firefoxa uruchom `Update-DownloadRouter.ps1` jako dotychczasowy użytkownik Windows. Skrypt zachowuje kopię pliku hosta. Załaduj `companion/Download-Router-1.1.6.xpi` przez `about:debugging`. To niepodpisana wersja testowa, ładowana tymczasowo do restartu przeglądarki.

## EN

This module shares ZIP Quick Extract's existing AutoConfig startup. It updates native download records and history after Download Router moves a file. ZIP, reveal, open and delete actions then use the updated target.

Requires the accompanying updated native host and Download Router 1.1.6. ZIP setup does not upgrade that companion. Requests are matched by original path, URL and start time; the destination must exist with the expected size and the source must be absent. Private downloads are excluded. Requests older than 24 hours are ignored. Existing downloads are not repaired retroactively.

Close Firefox and run INSTALL.bat to install ZIP Quick Extract. Previous files are backed up; uninstall includes this module. No additional AutoConfig loader or Firefox binary patch is installed. Internal Firefox APIs may change in future versions. Main-profile user acceptance is still pending.
