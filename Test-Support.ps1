$ErrorActionPreference='Stop'
$testRoot=Join-Path $PSScriptRoot ('support-test-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$settings=Join-Path $testRoot 'folders.xml'
$xml='<Folders><Temp>C:\TEST\preserved</Temp></Folders>'
[IO.File]::WriteAllText($settings,$xml)
# Isolate process detection. The test never touches Firefox or the registry.
function Get-Process { param($Name,$ErrorAction) return @() }
& "$PSScriptRoot\Install-Support.ps1" -SupportDirectory $testRoot -SkipRegistry
if([IO.File]::ReadAllText($settings) -ne $xml) {throw 'Settings changed'}
$manifest=Get-Content (Join-Path $testRoot 'firefox-native-host.json') -Raw | ConvertFrom-Json
if($manifest.allowed_extensions[0] -ne 'download-router@artllex') {throw 'Wrong extension ID'}
if($manifest.path -ne (Join-Path $testRoot 'FirefoxDownloadHost.exe')) {throw 'Wrong host path'}
& "$PSScriptRoot\Install-Support.ps1" -SupportDirectory $testRoot -SkipRegistry
if(!(Get-ChildItem $testRoot -Filter 'FirefoxDownloadHost.exe.backup-*')) {throw 'Backup missing'}
Write-Output 'Support installation in isolated directory: settings, manifest, update backup PASS'
