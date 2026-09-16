param([string]$FirefoxDirectory, [switch]$NonInteractive, [switch]$IsolatedTest, [string]$ErrorLog)
$ErrorActionPreference = 'Stop'
trap {
    if ($ErrorLog) { $_.Exception.Message | Set-Content -LiteralPath $ErrorLog -Encoding UTF8; exit 1 }
    break
}

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
. (Join-Path $scriptDir 'Shared-AutoConfig.ps1')
if (!$IsolatedTest -and (Get-Process firefox -ErrorAction SilentlyContinue)) {throw 'Close all Firefox windows before changing integration.'}
$firefoxDir = if ($FirefoxDirectory) { [IO.Path]::GetFullPath($FirefoxDirectory) } else { Find-FirefoxDir }
if (!$firefoxDir) {throw 'Firefox installation not found.'}
$sources=@{}
foreach($name in @('zipquickextract.cfg','firefox_secret_window.ps1','firefox_secret_window.vbs','FirefoxEnhancementsHoverChild.sys.mjs')) {$sources[$name]=Join-Path $scriptDir $name}
Invoke-ArtllexAutoConfig -Root $firefoxDir -Product FE -Sources $sources
$obsoleteShortcutActor=Join-Path $firefoxDir 'FirefoxEnhancementsShortcutsChild.sys.mjs'
if(Test-Path -LiteralPath $obsoleteShortcutActor) {Remove-Item -LiteralPath $obsoleteShortcutActor -Force}
Write-Host 'Firefox Enhancements 0.1.41 installed. DownloadLens is optional.'
if (!$NonInteractive) {Read-Host 'Press Enter to close'}
