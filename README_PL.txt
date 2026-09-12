Firefox ZIP Quick Extract v0.1.10 - lokalna wersja testowa
================================

Pakiet rozbudowuje interfejs Firefoxa na Windows.

NOWOSC v0.1.10: synchronizacja lokalizacji po przeniesieniu pliku przez
Download Router. Przeczytaj DOWNLOAD-LOCATION-SYNC.md oraz VALIDATION.md.
Zamknij Firefox. Uruchom INSTALL.bat, a nastepnie Update-DownloadRouter.ps1
jako dotychczasowy uzytkownik Windows. Ten drugi skrypt tworzy kopie hosta.
Zaladuj companion\Download-Router-1.1.6.xpi przez about:debugging.
Rozszerzenie jest niepodpisane, tymczasowe; znika po restarcie Firefoxa.
Nie opublikowano tej wersji na GitHub.

POPRAWKA v0.1.9
--------------
Folder wynikowy otwiera powloka Windows bezposrednio po rozpakowaniu,
przed kopiowaniem do schowka. Zachowano ikone otwartego pudelka.

POPRAWKA v0.1.8
--------------
Ikona rozpakowywania to teraz biale otwarte pudelko wedlug wzoru uzytkownika.
Poprzednia paczka v0.1.7 omylkowo zawierala ikone strzalki.

FUNKCJE
-------
1. Panel pobierania
- biala ikona kosza dla zakonczonych pobran,
- biala ikona rozpakowania dla zakonczonych plikow ZIP,
- ZIP jest rozpakowywany do folderu o nazwie archiwum,
- folder po rozpakowaniu jest kopiowany do schowka (FileDropList + sciezka tekstowa),
- rozpakowany folder otwiera sie w nowym oknie Eksploratora,
- PowerShell dziala niewidocznie w tle.

2. Glowne menu Firefoxa
- Przywroc poprzednia sesje jest przeniesione bezposrednio pod Historia,
- Wyczysc ostatnia historie... jest przeniesione bezposrednio pod Historia.

3. Tajne / ukryte okno - v0.1.7
- globalny skrot: Ctrl+Alt+Space,
- nie ma przycisku Ukryte okno w menu Firefoxa; jedynym przełącznikiem jest skrót,
- pierwszy skrot uruchamia ODDZIELNA instancje Firefoxa z osobnym profilem,
- profil jest zapisany w:
    %LOCALAPPDATA%\Mozilla\Firefox\FirefoxSecretProfile
- uruchomienie uzywa -no-remote oraz -profile, dlatego zwykly i tajny Firefox
  maja oddzielne cookies, historie, loginy, sesje, storage witryn, rozszerzenia itd.,
- Firefox Accounts / Sync sa w tajnym profilu wylaczone, aby historia i karty nie
  mogly przypadkowo zsynchronizowac sie z profilem glownym,
- Ctrl+Alt+Space ukrywa wszystkie okna nalezace do tajnego profilu,
- ukrywanie wykorzystuje Win32 SW_HIDE - nie jest to minimalizacja,
- tajne okna znikaja z pulpitu, paska zadan i Alt+Tab.

4. Media i dzwiek tajnego profilu - v0.1.7
Po ukryciu wykonywane sa DWIE niezalezne warstwy blokady:
- Firefox wycisza wszystkie karty tajnego profilu i pamieta, ktore karty byly
  wyciszone juz wczesniej,
- caly wieloprocesowy proces Firefoxa tajnego profilu jest zawieszany na poziomie
  Windows (NtSuspendProcess), razem z procesami tresci/mediow.

Efekt:
- video/audio nie gra w tle,
- odtwarzacze, dekodery i timery sa zamrozone w aktualnym stanie,
- CPU tajnego Firefoxa praktycznie nie pracuje w stanie ukrytym,
- po ponownym Ctrl+Alt+Space okno jest najpierw pokazywane, potem procesy sa
  wznawiane i dopiero wtedy przywracane sa poprzednie stany wyciszenia kart.

Odtwarzanie wraca od tego samego miejsca, w ktorym zostalo zamrozone.

POPRAWKI v0.1.7
----------------
- usunieto przycisk Ukryte okno z glownego menu Firefoxa,
- pierwszy Ctrl+Alt+Space tworzy tajny profil i pozostawia go WIDOCZNY,
- helper globalnego skrotu nie jest uruchamiany przez tajny profil,
- helper sam siebie wyklucza z listy procesow do zawieszenia,
- zmieniono identyfikator globalnego hotkey helpera na v017,
- instalator zamyka osierocone helpery starszej wersji, aby zwolnic Ctrl+Alt+Space.

PRYWATNOSC / IZOLACJA
---------------------
To jest osobny profil lokalny Firefoxa, a nie tylko osobne okno. Dane profilu glownego
nie sa uzywane przez tajny profil. Pakiet nie szyfruje jednak tajnego profilu i nie
ukrywa istnienia procesu/pliku profilu przed administratorem systemu lub narzedziami
systemowymi.

Firefox Sync jest celowo niedostepny w tajnym profilu. Logowanie do zwyklych stron
(np. Google, Reddit, serwisy streamingowe) pozostaje normalnie mozliwe i dotyczy tylko
tego profilu.

DIAGNOSTYKA UKRYTEGO OKNA
-------------------------
Log helpera:
  %TEMP%\FirefoxSecretWindow.log

INSTALACJA / AKTUALIZACJA
-------------------------
1. Zamknij wszystkie WIDOCZNE okna Firefoxa.
2. Uruchom INSTALL.bat.
3. Zaakceptuj UAC. Instalator zamknie osierocony helper v0.1.6, jezeli istnieje.
4. Uruchom zwykly Firefox.
5. Jezeli tajny profil z v0.1.6 pozostal ukryty/zawieszony, nacisnij Ctrl+Alt+Space - v0.1.7 powinien go wznowic i pokazac.
6. Jezeli tajny profil nie byl uruchomiony, pierwszy Ctrl+Alt+Space uruchomi go i pozostawi widoczny.

DEINSTALACJA
------------
1. Pokaz tajny profil Ctrl+Alt+Space i zamknij go.
2. Zamknij zwykly Firefox.
3. Uruchom UNINSTALL.bat.
4. Uruchom Firefox.

UWAGA: deinstalator NIE kasuje katalogu FirefoxSecretProfile ani jego historii/danych.
To jest celowe zabezpieczenie przed przypadkowa utrata danych. Jezeli chcesz usunac
profil na stale, zrob to osobno po deinstalacji.

Pozostala diagnostyka:
- blad rozpakowywania: %TEMP%\FirefoxZipQuickExtract_last_error.txt
- bledy skryptu UI: Browser Console Firefoxa (Ctrl+Shift+J)
