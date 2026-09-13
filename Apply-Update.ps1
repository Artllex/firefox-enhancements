$ErrorActionPreference = 'Stop'
$log = Join-Path $PSScriptRoot 'update-result.txt'
try {
    if (Get-Process firefox -ErrorAction SilentlyContinue) { throw 'Close Firefox before running this update.' }
    # Elevation is restricted to the Firefox integration. The host stays per-user.
    $script = Join-Path $PSScriptRoot 'install.ps1'
    $detail = Join-Path $PSScriptRoot ('integration-error-' + [guid]::NewGuid().ToString('N') + '.txt')
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $script + '" -NonInteractive -ErrorLog "' + $detail + '"'
    $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -PassThru -Wait
    if ($process.ExitCode -ne 0) {
        if (Test-Path -LiteralPath $detail) {throw ([IO.File]::ReadAllText($detail))}
        throw 'Firefox integration update failed or administrator confirmation was cancelled.'
    }
    'SUCCESS: Firefox Enhancements installed. DownloadLens is optional.' | Set-Content -LiteralPath $log
    exit 0
} catch {
    $_.Exception.Message | Set-Content -LiteralPath $log
    exit 1
}
