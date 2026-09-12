# ZIP Quick Extract 0.1.12 — Biblioteka / Library

## Instalacja

Zamknij Firefox, rozpakuj pakiet i uruchom INSTALL.bat. Instalator zachowuje kopię poprzednich plików. Ta poprawka zmienia wyłącznie AutoConfig ZIP Quick Extract; zainstalowany Download Router 1.2.0 i jego reguły nie wymagają zmian. Tymczasowy dodatek Download Router trzeba jak zwykle ponownie wczytać po restarcie Firefoxa.

Biblioteka jest osobnym oknem i nie wysyła zdarzenia uruchomienia głównego okna, którego dotychczas używał projekt. Nowa wersja podłącza wspólną obsługę przycisków po załadowaniu Biblioteki, również przy kolejnych otwarciach. Nie uruchamia w Bibliotece funkcji menu głównego ani dodatkowego skrótu globalnego.

Te same funkcje rozpakowywania i usuwania obsługują panel oraz Bibliotekę. Usunięcie wymaga potwierdzenia i jest trwałe. Dla pliku, który nie istnieje, obie ikony są ukryte. Aktualizacje listy nadal są obserwowane, a ikony nie są dodawane wielokrotnie.

## Validation

An isolated real Firefox Library test passed: both actions were created, the ZIP button had a visible rendered layout, and both actions became hidden after the test file was removed and the download refreshed. No user files or main Firefox configuration were changed. Shared action handlers remain unchanged; actual archive extraction and confirmation-driven deletion from Library were not separately executed in this test.

Close Firefox and run INSTALL.bat to update. Existing Download Router 1.2.0 settings and host need no update. Temporarily loaded extensions must be reloaded after restart as usual.
