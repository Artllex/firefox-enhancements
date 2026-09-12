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

$firefoxDir = Find-FirefoxDir
if (-not $firefoxDir) { throw 'Nie znaleziono instalacji Firefox.' }

$paths = @(
    (Join-Path $firefoxDir 'defaults\pref\zipquickextract-autoconfig.js'),
    (Join-Path $firefoxDir 'zipquickextract.cfg'),
    (Join-Path $firefoxDir 'zip_quick_extract.ps1'),
    (Join-Path $firefoxDir 'zip_quick_extract.vbs'),
    (Join-Path $firefoxDir 'firefox_secret_window.ps1'),
    (Join-Path $firefoxDir 'firefox_secret_window.vbs')
)
foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
}

Write-Host ''
Write-Host 'Firefox ZIP Quick Extract usuniety.' -ForegroundColor Green
Write-Host 'Dane tajnego profilu pozostawiono w %LOCALAPPDATA%\Mozilla\Firefox\FirefoxSecretProfile.' -ForegroundColor DarkGray
Write-Host 'Uruchom ponownie Firefox.' -ForegroundColor Yellow
Write-Host ''
Read-Host 'Nacisnij Enter, aby zamknac deinstalator'
