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

. (Join-Path $PSScriptRoot 'Shared-AutoConfig.ps1')
if (!$IsolatedTest -and (Get-Process firefox -ErrorAction SilentlyContinue)) {throw 'Close all Firefox windows before changing integration.'}
Invoke-ArtllexAutoConfig -Root $firefoxDir -Product FE -Action Remove
Write-Host 'Firefox Enhancements removed. Profile data and other modules preserved.'
if (!$NonInteractive) {Read-Host 'Press Enter to close'}
