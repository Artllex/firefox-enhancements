$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$source=[Drawing.Bitmap]::new((Join-Path $PSScriptRoot 'assets/firefox-enhancements-icon.png'))
$sizes=@(16,24,32,48,64,128,256)
$frames=@()
try {
 foreach($size in $sizes){
  $bitmap=[Drawing.Bitmap]::new($size,$size)
  $graphics=[Drawing.Graphics]::FromImage($bitmap)
  $stream=[IO.MemoryStream]::new()
  try {
   $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
   $graphics.DrawImage($source,0,0,$size,$size)
   $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
   $frames+=,@($stream.ToArray())
  } finally {$graphics.Dispose();$bitmap.Dispose();$stream.Dispose()}
 }
 $output=[IO.File]::Create((Join-Path $PSScriptRoot 'assets/Firefox-Enhancements.ico'))
 $writer=[IO.BinaryWriter]::new($output)
 try {
  $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$sizes.Count)
  $offset=6+16*$sizes.Count
  for($i=0;$i -lt $sizes.Count;$i++){
   $dimension=if($sizes[$i] -eq 256){0}else{$sizes[$i]}
   $writer.Write([byte]$dimension);$writer.Write([byte]$dimension)
   $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]32)
   $writer.Write([uint32]$frames[$i].Count);$writer.Write([uint32]$offset)
   $offset+=$frames[$i].Count
  }
  foreach($frame in $frames){$writer.Write([byte[]]$frame)}
 } finally {$writer.Dispose();$output.Dispose()}
} finally {$source.Dispose()}
