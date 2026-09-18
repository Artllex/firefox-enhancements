$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$assets=Join-Path (Split-Path $PSScriptRoot) 'assets'
$png=[Drawing.Bitmap]::new((Join-Path $assets 'firefox-enhancements-icon.png'))
try {
 if($png.GetPixel(0,0).A -ne 0){throw 'PNG background is not transparent'}
 if($png.GetPixel(600,600).A -ne 255){throw 'Artwork transparency damaged'}
} finally {$png.Dispose()}
$bytes=[IO.File]::ReadAllBytes((Join-Path $assets 'Firefox-Enhancements.ico'))
$count=[BitConverter]::ToUInt16($bytes,4)
if($count -ne 7){throw 'Missing ICO sizes'}
for($i=0;$i -lt $count;$i++){
 $pos=6+16*$i; $size=[BitConverter]::ToUInt32($bytes,$pos+8);$offset=[BitConverter]::ToUInt32($bytes,$pos+12)
 $stream=[IO.MemoryStream]::new($bytes,$offset,$size)
 $frame=[Drawing.Bitmap]::new($stream)
 try{if($frame.GetPixel(0,0).A -ne 0){throw 'Opaque ICO corner'};Write-Output "PASS transparent ICO frame: $($frame.Width)"}finally{$frame.Dispose();$stream.Dispose()}
}
$exe=Join-Path (Split-Path $PSScriptRoot) 'dist/Firefox-Enhancements-Setup-0.1.50.exe'
# Compare actual embedded PNG resources, not the Windows shell icon cache.
$exeHex=[BitConverter]::ToString([IO.File]::ReadAllBytes([IO.Path]::GetFullPath($exe)))
for($i=0;$i -lt $count;$i++) {
 $pos=6+16*$i; $size=[BitConverter]::ToUInt32($bytes,$pos+8); $offset=[BitConverter]::ToUInt32($bytes,$pos+12)
 $frameHex=[BitConverter]::ToString($bytes,$offset,$size)
 if(!$exeHex.Contains($frameHex)) {throw 'Installer is missing an exact current ICO frame'}
}
Write-Output 'PASS all seven installer icon resources exactly match current ICO'
