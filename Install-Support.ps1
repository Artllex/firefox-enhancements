param([string]$SupportDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\ChatGPTFolderLauncher'), [switch]$SkipRegistry)
$ErrorActionPreference = 'Stop'
if (Get-Process firefox -ErrorAction SilentlyContinue) { throw 'Close Firefox first.' }
$source = Join-Path $PSScriptRoot 'native-host\FirefoxDownloadHost.exe'
if (!(Test-Path -LiteralPath $source)) { throw 'Native host payload missing.' }
New-Item -ItemType Directory -Path $SupportDirectory -Force | Out-Null
$hostPath = Join-Path $SupportDirectory 'FirefoxDownloadHost.exe'
$manifestPath = Join-Path $SupportDirectory 'firefox-native-host.json'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
foreach ($file in @($hostPath, $manifestPath)) {
    if (Test-Path -LiteralPath $file) { Copy-Item -LiteralPath $file -Destination ($file + '.backup-' + $stamp) }
}
$settings = Join-Path $SupportDirectory 'folders.xml'
if (!(Test-Path -LiteralPath $settings)) {
    $tempFolder = Join-Path $env:LOCALAPPDATA 'DownloadRouter\temp'
    New-Item -ItemType Directory -Path $tempFolder -Force | Out-Null
    $xml = '<Folders><Temp>' + [Security.SecurityElement]::Escape($tempFolder) + '</Temp></Folders>'
    [IO.File]::WriteAllText($settings,$xml,[Text.UTF8Encoding]::new($false))
}
Copy-Item -LiteralPath $source -Destination $hostPath -Force
$manifest = @{name='com.artllex.download_router';description='Download Router support by Firefox Enhancements';path=$hostPath;type='stdio';allowed_extensions=@('download-router@artllex')} | ConvertTo-Json
[IO.File]::WriteAllText($manifestPath,$manifest,[Text.UTF8Encoding]::new($false))
if (!$SkipRegistry) {
    foreach ($view in @([Microsoft.Win32.RegistryView]::Registry32,[Microsoft.Win32.RegistryView]::Registry64)) {
        $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,$view)
        $key = $base.CreateSubKey('Software\Mozilla\NativeMessagingHosts\com.artllex.download_router')
        try {
            $previous = $key.GetValue('')
            if ($previous -and $previous -ne $manifestPath) {
                [IO.File]::WriteAllText((Join-Path $SupportDirectory ("registry-$view-$stamp.previous.txt")),[string]$previous)
            }
            $key.SetValue('',$manifestPath)
        } finally { $key.Dispose(); $base.Dispose() }
    }
}
Write-Output 'Download Router support installed. Existing folder settings preserved.'
