param([Parameter(Mandatory=$true)][string]$DownloadLensRoot)
$ErrorActionPreference='Stop'
$fe=Split-Path $PSScriptRoot
$dl=Join-Path $DownloadLensRoot 'support/Configure-Firefox.ps1'
$root=Join-Path $PSScriptRoot ('coexist-tests-'+[guid]::NewGuid().ToString('N'))
function Get-Process {param($Name,$ErrorAction) @()}
function Fixture($name) {
 $p=Join-Path $root $name
 New-Item -ItemType Directory -Path (Join-Path $p 'defaults/pref') -Force | Out-Null
 [IO.File]::WriteAllText((Join-Path $p 'firefox.exe'),'fixture')
 return $p
}
foreach($order in @('FE-first','DL-first')){
 $p=Fixture $order
 if($order -eq 'FE-first'){& "$fe/install.ps1" -FirefoxDirectory $p -NonInteractive -IsolatedTest; & $dl -FirefoxDirectory $p}
 else {& $dl -FirefoxDirectory $p; & "$fe/install.ps1" -FirefoxDirectory $p -NonInteractive -IsolatedTest}
 & "$fe/install.ps1" -FirefoxDirectory $p -NonInteractive -IsolatedTest
 & $dl -FirefoxDirectory $p
 $dlHash=(Get-FileHash "$p/download-router-support.cfg").Hash
 & "$fe/uninstall.ps1" -FirefoxDirectory $p -NonInteractive -IsolatedTest
 if((Get-FileHash "$p/download-router-support.cfg").Hash -ne $dlHash){throw 'FE uninstall damaged DL'}
 & "$fe/install.ps1" -FirefoxDirectory $p -NonInteractive -IsolatedTest
 $feHash=(Get-FileHash "$p/zipquickextract.cfg").Hash
 & $dl -FirefoxDirectory $p -Action Remove
 if((Get-FileHash "$p/zipquickextract.cfg").Hash -ne $feHash){throw 'DL uninstall damaged FE'}
 & "$fe/uninstall.ps1" -FirefoxDirectory $p -NonInteractive -IsolatedTest
 if(Get-ChildItem "$p/defaults/pref" -Filter '*.js'){throw 'Orphan preference'}
 Write-Output "PASS: $order; updates and both uninstall orders"
}
$p=Fixture 'foreign'
[IO.File]::WriteAllText("$p/defaults/pref/foreign.js",'pref("general.config.filename","foreign.cfg");')
foreach($script in @("$fe/install.ps1",$dl)){
 $rejected=$false
 try{if($script -eq $dl){& $script -FirefoxDirectory $p}else{& $script -FirefoxDirectory $p -NonInteractive -IsolatedTest}}catch{$rejected=$true}
 if(!$rejected){throw 'Foreign AutoConfig was accepted'}
}
$p=Fixture 'modified'
& "$fe/install.ps1" -FirefoxDirectory $p -NonInteractive -IsolatedTest
Add-Content "$p/zipquickextract.cfg" '// user modification'
$rejected=$false
try{& "$fe/uninstall.ps1" -FirefoxDirectory $p -NonInteractive -IsolatedTest}catch{$rejected=$true}
if(!$rejected -or !(Test-Path "$p/zipquickextract.cfg")){throw 'Modified configuration not preserved'}
Write-Output 'PASS: unknown AutoConfig rejected and modified files preserved'
