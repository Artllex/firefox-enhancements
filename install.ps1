param([string]$FirefoxDirectory, [switch]$NonInteractive, [switch]$IsolatedTest)
$ErrorActionPreference = 'Stop'

function Find-FirefoxDir {
    $candidates = New-Object System.Collections.Generic.List[string]
    $regKeys = @(
        'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe',
        'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe',
        'Registry::HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe'
    )
    foreach ($key in $regKeys) {
        try {
            $exe = (Get-ItemProperty -LiteralPath $key).'(default)'
            if ($exe) { $candidates.Add([System.IO.Path]::GetDirectoryName($exe)) }
        } catch {}
    }
    if ($env:ProgramFiles) { $candidates.Add((Join-Path $env:ProgramFiles 'Mozilla Firefox')) }
    if (${env:ProgramFiles(x86)}) { $candidates.Add((Join-Path ${env:ProgramFiles(x86)} 'Mozilla Firefox')) }
    if ($env:LOCALAPPDATA) { $candidates.Add((Join-Path $env:LOCALAPPDATA 'Mozilla Firefox')) }

    foreach ($dir in ($candidates | Select-Object -Unique)) {
        if ($dir -and (Test-Path -LiteralPath (Join-Path $dir 'firefox.exe'))) { return $dir }
    }
    return $null
}


function Stop-LegacySecretHelpers {
    try {
        $items = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            ($_.Name -ieq 'powershell.exe' -or $_.Name -ieq 'pwsh.exe' -or $_.Name -ieq 'wscript.exe') -and
            $_.CommandLine -and
            ($_.CommandLine -match 'firefox_secret_window\.(ps1|vbs)')
        }
        foreach ($item in $items) {
            try { Stop-Process -Id ([int]$item.ProcessId) -Force -ErrorAction SilentlyContinue } catch {}
        }
        if ($items) { Start-Sleep -Milliseconds 250 }
    } catch {}
}

function Write-Utf8NoBomLf([string]$Source, [string]$Destination) {
    $text = [System.IO.File]::ReadAllText($Source)
    $text = $text -replace "`r`n", "`n"
    $text = $text -replace "`r", "`n"
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Destination, $text, $utf8)
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$firefoxDir = if ($FirefoxDirectory) { [IO.Path]::GetFullPath($FirefoxDirectory) } else { Find-FirefoxDir }
if (-not $firefoxDir) {
    throw 'Nie znaleziono instalacji Firefox.'
}

# v0.1.7: stop any older background hotkey helper before replacing files.
# This also releases Ctrl+Alt+Space if a v0.1.6 helper became stranded.
# Validate conflicts before stopping any existing helper.

$prefDir = Join-Path $firefoxDir 'defaults\pref'
if (-not (Test-Path -LiteralPath $prefDir)) {
    New-Item -ItemType Directory -Path $prefDir -Force | Out-Null
}

$ourPref = Join-Path $prefDir 'zipquickextract-autoconfig.js'
$ourCfg = Join-Path $firefoxDir 'zipquickextract.cfg'
$ourHelper = Join-Path $firefoxDir 'zip_quick_extract.ps1'
$ourLauncher = Join-Path $firefoxDir 'zip_quick_extract.vbs'
$ourSecretHelper = Join-Path $firefoxDir 'firefox_secret_window.ps1'
$ourSecretLauncher = Join-Path $firefoxDir 'firefox_secret_window.vbs'
$ourSync = Join-Path $firefoxDir 'download-location-sync.sys.mjs'

# Do not overwrite another AutoConfig owned by the user or another product.
$existingAutoConfig = @()
Get-ChildItem -LiteralPath $prefDir -Filter '*.js' -File -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.FullName -ne $ourPref) {
        try {
            if (Select-String -LiteralPath $_.FullName -Pattern 'general\.config\.filename' -Quiet) {
                $existingAutoConfig += $_.FullName
            }
        } catch {}
    }
}
if ($existingAutoConfig.Count -gt 0) {
    throw "Wykryto inna konfiguracje AutoConfig:`r`n$($existingAutoConfig -join "`r`n")`r`n`r`nInstalator niczego nie nadpisal."
}
if (!$IsolatedTest) { Stop-LegacySecretHelpers }

# Make a small backup if v0.1.0 (or an earlier revision) is already installed.
$backupDir = Join-Path $env:TEMP ('FirefoxZipQuickExtract_backup_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$hadOld = $false
foreach ($path in @($ourPref, $ourCfg, $ourHelper, $ourLauncher, $ourSecretHelper, $ourSecretLauncher, $ourSync)) {
    if (Test-Path -LiteralPath $path) {
        if (-not $hadOld) {
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
            $hadOld = $true
        }
        Copy-Item -LiteralPath $path -Destination $backupDir -Force
    }
}

Write-Utf8NoBomLf (Join-Path $scriptDir 'zipquickextract-autoconfig.js') $ourPref
Write-Utf8NoBomLf (Join-Path $scriptDir 'zipquickextract.cfg') $ourCfg
Copy-Item -LiteralPath (Join-Path $scriptDir 'firefox_secret_window.ps1') -Destination $ourSecretHelper -Force
Copy-Item -LiteralPath (Join-Path $scriptDir 'firefox_secret_window.vbs') -Destination $ourSecretLauncher -Force

Write-Host ''
Write-Host 'Firefox Enhancements v0.1.15 zainstalowany.' -ForegroundColor Green
Write-Host "Firefox: $firefoxDir"
if ($hadOld) {
    Write-Host "Kopia poprzedniej wersji: $backupDir" -ForegroundColor DarkGray
}
Write-Host ''
Write-Host 'WAZNE: zamknij WSZYSTKIE widoczne okna Firefoxa i uruchom Firefox ponownie.' -ForegroundColor Yellow
Write-Host 'Jesli tajny profil byl zablokowany przez v0.1.6, po restarcie nacisnij Ctrl+Alt+Space.' -ForegroundColor Yellow
Write-Host ''
if (!$NonInteractive) { Read-Host 'Nacisnij Enter, aby zamknac instalator' }
