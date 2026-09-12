#define Version "0.1.14"
[Setup]
AppId=Artllex.FirefoxEnhancements
AppName=Firefox Enhancements
AppVersion={#Version}
AppPublisher=Arkadiusz Pajda (Artllex)
AppPublisherURL=https://github.com/Artllex
DefaultDirName={localappdata}\Programs\FirefoxEnhancements
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
WizardStyle=modern
DisableWelcomePage=no
LanguageDetectionMethod=none
MinVersion=10.0
Uninstallable=no
OutputDir=..\..\outputs
OutputBaseFilename=Firefox-Enhancements-Setup-{#Version}
Compression=lzma2
SolidCompression=yes
CloseApplications=no
RestartApplications=no
LicenseFile=LICENSE
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"
[Files]
Source: "zipquickextract.cfg"; DestDir: "{app}"; Flags: ignoreversion
Source: "zipquickextract-autoconfig.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "download-location-sync.sys.mjs"; DestDir: "{app}"; Flags: ignoreversion
Source: "zip_quick_extract.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "zip_quick_extract.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "firefox_secret_window.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "firefox_secret_window.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "install.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Apply-Update.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Install-Support.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "native-host\FirefoxDownloadHost.exe"; DestDir: "{app}\native-host"; Flags: ignoreversion
Source: "INSTALLER-README.txt"; DestDir: "{app}"; Flags: ignoreversion
[Run]
Filename: "{app}\INSTALLER-README.txt"; Description: "Open installation instructions / Otworz instrukcje"; Flags: shellexec postinstall skipifsilent unchecked
[Code]
procedure InitializeWizard;
begin
  if ActiveLanguage = 'polish' then
    WizardForm.WelcomeLabel2.Caption := 'Usprawnienia panelu pobierania i Biblioteki Firefox oraz lokalne wsparcie Download Router. Zamknij Firefox. Rozszerzenie Download Router jest osobnym projektem i nie jest instalowane przez ten program.'
  else
    WizardForm.WelcomeLabel2.Caption := 'Enhances the Firefox downloads panel and Library and installs local Download Router support. Close Firefox first. Download Router is a separate extension and is not installed by this program.';
end;
procedure CurStepChanged(CurStep: TSetupStep);
var ResultCode: Integer;
begin
  if CurStep = ssPostInstall then begin
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\Apply-Update.ps1') + '"',
      ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      RaiseException('Could not start update.');
    if ResultCode <> 0 then
      RaiseException('Update failed / Aktualizacja nieudana. See: ' + ExpandConstant('{app}\update-result.txt'));
  end;
end;
