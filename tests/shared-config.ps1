param([Parameter(Mandatory=$true)][string]$DownloadLensRoot,[Parameter(Mandatory=$true)][string]$Node,[string]$InstalledRoot)
$ErrorActionPreference='Stop'
$fe=Split-Path $PSScriptRoot
function Get-Process {param($Name,$ErrorAction) @()}
if((Get-FileHash "$fe/Shared-AutoConfig.ps1").Hash -ne (Get-FileHash "$DownloadLensRoot/support/Shared-AutoConfig.ps1").Hash) {throw 'Shared protocol packages differ'}
$suite=Join-Path $PSScriptRoot ('coexist-tests-'+[guid]::NewGuid().ToString('N'))
foreach($scenario in @('FE','DL','FE-DL','DL-FE','legacy-FE-DL','legacy-DL-FE')) {
    $root=Join-Path $suite $scenario
    New-Item -ItemType Directory -Path "$root/defaults/pref" -Force | Out-Null
    [IO.File]::WriteAllText("$root/firefox.exe",'fixture')
    if($scenario.StartsWith('legacy-')) {
        if(!$InstalledRoot) {continue}
        foreach($name in @('zipquickextract.cfg','firefox_secret_window.ps1','firefox_secret_window.vbs','firefox-enhancements-state.json','download-router-support.cfg','download-router-support-state.json','download-router-sync.sys.mjs','download-router-actions.sys.mjs','download-router-extract.ps1','download-router-extract.vbs')) {
            if(Test-Path "$InstalledRoot/$name") {Copy-Item -LiteralPath "$InstalledRoot/$name" -Destination "$root/$name"}
        }
        foreach($name in @('zipquickextract-autoconfig.js','download-router-support.js')) {
            if(Test-Path "$InstalledRoot/defaults/pref/$name") {Copy-Item -LiteralPath "$InstalledRoot/defaults/pref/$name" -Destination "$root/defaults/pref/$name"}
        }
    }
    $order=$scenario.Replace('legacy-','').Split('-')
    foreach($product in $order) {
        if($product -eq 'FE') {& "$fe/install.ps1" -FirefoxDirectory $root -NonInteractive -IsolatedTest}
        else {& "$DownloadLensRoot/support/Configure-Firefox.ps1" -FirefoxDirectory $root}
        & $Node "$PSScriptRoot/shared-loader.cjs" $root
        if($LASTEXITCODE -ne 0) {throw "Runtime failed: $scenario"}
        foreach($pref in Get-ChildItem "$root/defaults/pref" -Filter '*.js') {
            if(![IO.File]::ReadAllText($pref.FullName).Contains('"artllex.cfg"')) {throw 'Multiple AutoConfig targets'}
        }
    }
    foreach($product in $order) {
        if($product -eq 'FE') {& "$fe/uninstall.ps1" -FirefoxDirectory $root -NonInteractive -IsolatedTest}
        else {& "$DownloadLensRoot/support/Configure-Firefox.ps1" -FirefoxDirectory $root -Action Remove}
    }
    if(Test-Path "$root/artllex.cfg") {throw 'Orphan common loader'}
    Write-Output "PASS lifecycle: $scenario"
}
$root=Join-Path $suite 'rollback-and-disabled'
New-Item -ItemType Directory -Path "$root/defaults/pref" -Force | Out-Null
[IO.File]::WriteAllText("$root/firefox.exe",'fixture')
& "$fe/install.ps1" -FirefoxDirectory $root -NonInteractive -IsolatedTest
# Disabled FE must not be reactivated by Support.
Rename-Item "$root/defaults/pref/zipquickextract-autoconfig.js" 'zipquickextract-autoconfig.js.disabled'
& "$DownloadLensRoot/support/Configure-Firefox.ps1" -FirefoxDirectory $root
& $Node "$PSScriptRoot/shared-loader.cjs" $root
if($LASTEXITCODE -ne 0 -or (Test-Path "$root/defaults/pref/zipquickextract-autoconfig.js")) {throw 'Disabled module reactivated'}
$snapshot=@{}
foreach($file in Get-ChildItem $root -File) {$snapshot[$file.FullName]=(Get-FileHash $file.FullName).Hash}
$global:artllexTestInjection=$true
function Remove-Item {
    param([string]$LiteralPath)
    if($global:artllexTestInjection -and [IO.Path]::GetFileName($LiteralPath) -eq 'artllex.cfg') {
        $global:artllexTestInjection=$false
        throw 'Injected filesystem failure'
    }
    Microsoft.PowerShell.Management\Remove-Item -LiteralPath $LiteralPath
}
$rejected=$false
try { & "$DownloadLensRoot/support/Configure-Firefox.ps1" -FirefoxDirectory $root -Action Remove } catch {$rejected=$true}
if(!$rejected) {throw 'Fault injection failed'}
foreach($file in $snapshot.Keys) {if((Get-FileHash $file).Hash -ne $snapshot[$file]) {throw "Rollback mismatch: $file"}}
Write-Output 'PASS disabled peer and rollback after injected removal failure'
Remove-Variable artllexTestInjection -Scope Global
