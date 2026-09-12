param(
    [Parameter(Mandatory = $true)]
    [string]$Archive
)

$ErrorActionPreference = 'Stop'

try {
    $archiveFull = [System.IO.Path]::GetFullPath($Archive)

    if (-not [System.IO.File]::Exists($archiveFull)) {
        throw "Archive does not exist: $archiveFull"
    }

    if ([System.IO.Path]::GetExtension($archiveFull) -ine '.zip') {
        throw "Selected file is not a ZIP archive: $archiveFull"
    }

    $parent = [System.IO.Path]::GetDirectoryName($archiveFull)
    $name = [System.IO.Path]::GetFileNameWithoutExtension($archiveFull)
    $destination = [System.IO.Path]::Combine($parent, $name)

    Expand-Archive -LiteralPath $archiveFull -DestinationPath $destination -Force

    # Ask the desktop shell to open the extracted folder. This is independent
    # of the hidden PowerShell launcher and runs even if clipboard access fails.
    $desktopShell = New-Object -ComObject Shell.Application
    try {
        $desktopShell.Open($destination)
    }
    finally {
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($desktopShell)
    }

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Collections

    $files = New-Object System.Collections.Specialized.StringCollection
    [void]$files.Add($destination)

    $data = New-Object System.Windows.Forms.DataObject
    $data.SetFileDropList($files)
    $data.SetText($destination)

    $clipboardSet = $false
    for ($i = 0; $i -lt 12; $i++) {
        try {
            [System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
            $clipboardSet = $true
            break
        }
        catch {
            Start-Sleep -Milliseconds 120
        }
    }

    if (-not $clipboardSet) {
        throw 'Could not place extracted folder on the clipboard.'
    }

    exit 0
}
catch {
    try {
        $errorFile = Join-Path $env:TEMP 'FirefoxZipQuickExtract_last_error.txt'
        ($_ | Out-String) | Set-Content -LiteralPath $errorFile -Encoding UTF8
    }
    catch {}
    exit 2
}
