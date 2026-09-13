param([string]$FirefoxDirectory, [switch]$NonInteractive, [switch]$IsolatedTest)
$ErrorActionPreference = 'Stop'

function Find-FirefoxDir {
    $candidates = @()
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles 'Mozilla Firefox') }
    if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} 'Mozilla Firefox') }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'Mozilla Firefox') }
    foreach ($dir in ($candidates | Select-Object -Unique)) {
        if ($dir -and (Test-Path -LiteralPath (Join-Path $dir 'firefox.exe'))) { return $dir }
    }
    return $null
}

$firefoxDir = if ($FirefoxDirectory) { [IO.Path]::GetFullPath($FirefoxDirectory) } else { Find-FirefoxDir }
if (-not $firefoxDir) { throw 'Nie znaleziono instalacji Firefox.' }

$paths = @(
    (Join-Path $firefoxDir 'defaults\pref\zipquickextract-autoconfig.js'),
    (Join-Path $firefoxDir 'zipquickextract.cfg'),
    (Join-Path $firefoxDir 'firefox_secret_window.ps1'),
    (Join-Path $firefoxDir 'firefox_secret_window.vbs')
)
if (!$IsolatedTest -and (Get-Process firefox -ErrorAction SilentlyContinue)) {throw 'Close all Firefox windows before changing integration.'}
$statePath=Join-Path $firefoxDir 'firefox-enhancements-state.json'
if (!(Test-Path -LiteralPath $statePath)) {throw 'No ownership record. Legacy files preserved; install current FE first.'}
$state=Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
if($state.owner -ne 'FirefoxEnhancements') {throw 'Unknown ownership'}
foreach($path in $paths) {
    if(Test-Path -LiteralPath $path) {
        $expected=$state.hashes.([IO.Path]::GetFileName($path))
        if(!$expected -or (Get-FileHash -LiteralPath $path).Hash -ne $expected) {throw "Modified file preserved: $path"}
    }
}
foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
}

Write-Host ''
Remove-Item -LiteralPath $statePath
Write-Host 'Firefox Enhancements usuniety.' -ForegroundColor Green
Write-Host 'Dane tajnego profilu pozostawiono w %LOCALAPPDATA%\Mozilla\Firefox\FirefoxSecretProfile.' -ForegroundColor DarkGray
Write-Host 'Uruchom ponownie Firefox.' -ForegroundColor Yellow
Write-Host ''
if (!$NonInteractive) { Read-Host 'Nacisnij Enter, aby zamknac deinstalator' }
