# Run as the same Windows user who installed Download Router. Close Firefox first.
$ErrorActionPreference = 'Stop'
$installed = Join-Path $env:LOCALAPPDATA 'Programs\ChatGPTFolderLauncher\FirefoxDownloadHost.exe'
if (!(Test-Path -LiteralPath $installed)) { throw 'Existing Download Router native host not found. Install ChatGPT Workspace Setup first.' }
if (Get-Process firefox -ErrorAction SilentlyContinue) { throw 'Close Firefox before updating Download Router.' }
$replacement = Join-Path $PSScriptRoot 'companion\FirefoxDownloadHost.exe'
if (!(Test-Path -LiteralPath $replacement)) { throw 'Companion native host is missing from this package.' }
$backup = $installed + '.backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
Copy-Item -LiteralPath $installed -Destination $backup
Copy-Item -LiteralPath $replacement -Destination $installed -Force
Write-Host "Updated native host. Backup: $backup"
Write-Host 'Load companion\Download-Router-1.1.6.xpi in about:debugging (temporary unsigned extension). Existing native-host registration and folder settings were not changed.'
