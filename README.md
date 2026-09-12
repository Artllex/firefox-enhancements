# Firefox ZIP Quick Extract

Modyfikacja interfejsu Mozilla Firefox dla Windows, która usprawnia obsługę pobranych plików i dodaje izolowane, ukrywane okno przeglądarki.

Wersja lokalna do testów: **v0.1.10** (nieopublikowana).

Nowość: integracja z Download Router — po przeniesieniu pliku aktualizuje jego lokalizację w natywnej liście pobrań Firefoxa oraz historii. Przyciski otwierania, pokazywania w folderze, rozpakowania ZIP i usuwania korzystają z tej samej docelowej ścieżki. Szczegóły i ograniczenia: [DOWNLOAD-LOCATION-SYNC.md](DOWNLOAD-LOCATION-SYNC.md).

W v0.1.9 folder wynikowy otwiera powłoka Windows bezpośrednio po rozpakowaniu, przed kopiowaniem do schowka.

W v0.1.8 zastąpiono omyłkowo pozostawioną strzałkę białą ikoną otwartego pudełka zgodną z dostarczonym wzorem.

## Funkcje

- dodatkowy przycisk rozpakowania ukończonych plików ZIP w panelu pobierania;
- rozpakowanie do folderu o nazwie archiwum, bez usuwania pliku ZIP;
- automatyczne otwarcie folderu wynikowego i skopiowanie go do schowka;
- przycisk trwałego usuwania pobranego pliku z potwierdzeniem;
- przeniesienie natywnych poleceń „Przywróć poprzednią sesję” i „Wyczyść ostatnią historię…” bezpośrednio pod pozycję Historia w menu Firefoxa;
- oddzielny profil Firefoxa przełączany globalnym skrótem `Ctrl+Alt+Space`;
- całkowite ukrycie okien profilu (pulpit, pasek zadań i `Alt+Tab`) oraz zatrzymanie jego procesów i multimediów na czas ukrycia;
- wyłączony Firefox Sync w profilu ukrytym, aby ograniczyć ryzyko połączenia jego historii i kart z profilem głównym.

## Wymagania

- Windows 10 lub Windows 11;
- zainstalowany Mozilla Firefox;
- uprawnienia administratora podczas instalacji i deinstalacji.

Projekt korzysta z mechanizmu Firefox AutoConfig i instaluje pliki w katalogu programu Firefox. Nie jest zwykłym rozszerzeniem WebExtension. Aktualizacja Firefoxa może zmienić wewnętrzny interfejs przeglądarki i wymagać aktualizacji projektu.

## Instalacja

1. Pobierz archiwum `firefox_zip_quick_extract_v0.1.9.zip` z sekcji Releases.
2. Rozpakuj je w dowolnym katalogu.
3. Zamknij wszystkie okna Firefoxa.
4. Uruchom `INSTALL.bat` i zaakceptuj monit UAC.
5. Uruchom Firefox ponownie.

Instalator wykrywa standardową lokalizację Firefoxa. Jeżeli znajdzie inną konfigurację AutoConfig, przerwie pracę bez jej nadpisywania. Przy aktualizacji zapisuje kopię poprzednich plików projektu w katalogu tymczasowym systemu.

## Użycie

W panelu pobierania:

- kliknij ikonę otwartego pudełka obok ukończonego pliku ZIP, aby go rozpakować;
- kliknij ikonę kosza, aby po potwierdzeniu trwale usunąć pobrany plik.

Ukryty profil:

- `Ctrl+Alt+Space` uruchamia oddzielny profil przy pierwszym użyciu;
- kolejne użycie skrótu ukrywa albo pokazuje wszystkie jego okna;
- dane profilu są przechowywane w `%LOCALAPPDATA%\Mozilla\Firefox\FirefoxSecretProfile`.

Ukryty profil ma oddzielne cookies, historię, loginy, sesje, pamięć witryn i dodatki. Nie jest jednak szyfrowany i nie ukrywa swojego istnienia przed administratorem systemu ani narzędziami systemowymi.

## Deinstalacja

1. Pokaż ukryty profil skrótem `Ctrl+Alt+Space` i zamknij go.
2. Zamknij zwykły Firefox.
3. Uruchom `UNINSTALL.bat`.
4. Uruchom Firefox ponownie.

Deinstalator celowo nie usuwa katalogu `FirefoxSecretProfile` ani zapisanych w nim danych. Aby usunąć je trwale, skasuj profil osobno po deinstalacji.

## Diagnostyka

- log ukrytego okna: `%TEMP%\FirefoxSecretWindow.log`;
- ostatni błąd rozpakowywania: `%TEMP%\FirefoxZipQuickExtract_last_error.txt`;
- błędy warstwy interfejsu: konsola przeglądarki Firefoxa (`Ctrl+Shift+J`).

## Struktura projektu

- `zipquickextract-autoconfig.js` — bootstrap AutoConfig;
- `zipquickextract.cfg` — integracja z interfejsem Firefoxa;
- `zip_quick_extract.ps1` i `.vbs` — ciche rozpakowywanie ZIP;
- `firefox_secret_window.ps1` i `.vbs` — obsługa globalnego skrótu i ukrytego profilu;
- `install.ps1`, `uninstall.ps1`, `INSTALL.bat`, `UNINSTALL.bat` — instalacja i usuwanie.

## Licencja

Kod jest udostępniany na licencji MIT. Szczegóły znajdują się w pliku [LICENSE](LICENSE).
