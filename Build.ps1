$ErrorActionPreference='Stop'
& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe "/out:$PSScriptRoot\native-host\FirefoxDownloadHost.exe" /reference:System.Web.Extensions.dll /reference:System.Xml.Linq.dll /reference:System.Windows.Forms.dll "$PSScriptRoot\native-host\FirefoxDownloadHost.cs"
if ($LASTEXITCODE -ne 0) {throw 'Native host build failed'}
$compiler = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (!$compiler) {throw 'Install Inno Setup 7 and add ISCC.exe to PATH.'}
& $compiler.Source "$PSScriptRoot\firefox-enhancements-setup.iss"
if ($LASTEXITCODE -ne 0) {throw 'Installer build failed'}
