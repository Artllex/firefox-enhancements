#define Version "0.1.41"
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
OutputDir=dist
OutputBaseFilename=Firefox-Enhancements-Setup-{#Version}
Compression=lzma2
SolidCompression=yes
CloseApplications=no
RestartApplications=no
LicenseFile=LICENSE
SetupIconFile=assets\Firefox-Enhancements.ico
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"
[Files]
Source: "FirefoxEnhancementsHoverChild.sys.mjs"; DestDir: "{app}"; Flags: ignoreversion
Source: "zipquickextract.cfg"; DestDir: "{app}"; Flags: ignoreversion
Source: "zipquickextract-autoconfig.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "firefox_secret_window.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "firefox_secret_window.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "install.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Shared-AutoConfig.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Apply-Update.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "INSTALLER-README.txt"; DestDir: "{app}"; Flags: ignoreversion
[Run]
Filename: "{app}\INSTALLER-README.txt"; Description: "Open installation instructions / Otworz instrukcje"; Flags: shellexec postinstall skipifsilent unchecked
[Code]
procedure InitializeWizard;
begin
  if ActiveLanguage = 'polish' then
    WizardForm.WelcomeLabel2.Caption := 'Firefox Enhancements: usprawnienia menu historii oraz oddzielny profil przelaczany skrotem Ctrl+Alt+Space. Zamknij Firefox. Funkcje pobierania naleza do osobnego projektu DownloadLens.'
  else
    WizardForm.WelcomeLabel2.Caption := 'Firefox Enhancements: history menu improvements and a separate profile toggled with Ctrl+Alt+Space. Close Firefox first. Download features belong to the separate DownloadLens project.';
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
