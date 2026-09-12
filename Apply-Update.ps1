$ErrorActionPreference = 'Stop'
$log = Join-Path $PSScriptRoot 'update-result.txt'
try {
    if (Get-Process firefox -ErrorAction SilentlyContinue) { throw 'Close Firefox before running this update.' }
    # Elevation is restricted to the Firefox integration. The host stays per-user.
    $script = Join-Path $PSScriptRoot 'install.ps1'
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $script + '" -NonInteractive'
    $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw 'Firefox integration update failed or was cancelled. The native host has not been updated.' }
    & (Join-Path $PSScriptRoot 'Install-Support.ps1')
    'SUCCESS: Firefox enhancements and Download Router support installed. Get the extension separately from https://github.com/Artllex/download-router' | Set-Content -LiteralPath $log
    exit 0
} catch {
    $_.Exception.Message | Set-Content -LiteralPath $log
    exit 1
}
