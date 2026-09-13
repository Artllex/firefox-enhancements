$ErrorActionPreference='Stop'
$compiler = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (!$compiler) {throw 'Install Inno Setup 7 and add ISCC.exe to PATH.'}
& $compiler.Source "$PSScriptRoot\firefox-enhancements-setup.iss"
if ($LASTEXITCODE -ne 0) {throw 'Installer build failed'}
