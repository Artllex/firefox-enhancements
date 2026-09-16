param([string]$InstalledRoot='C:\Program Files\Mozilla Firefox')
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot
. "$repo/Shared-AutoConfig.ps1"
$suite=Join-Path $repo ('dist/hover-upgrade-'+[guid]::NewGuid().ToString('N'))
$sources=@{}
foreach($name in @('zipquickextract.cfg','firefox_secret_window.ps1','firefox_secret_window.vbs','FirefoxEnhancementsHoverChild.sys.mjs')) {$sources[$name]=Join-Path $repo $name}
foreach($scenario in @('known-orphan','modified-orphan')) {
    $root=Join-Path $suite $scenario
    New-Item -ItemType Directory -Path "$root/defaults/pref" -Force | Out-Null
    [IO.File]::WriteAllText("$root/firefox.exe",'isolated fixture - not executable')
    foreach($name in @('artllex.cfg','zipquickextract.cfg','firefox_secret_window.ps1','firefox_secret_window.vbs','FirefoxEnhancementsHoverChild.sys.mjs','firefox-enhancements-state.json','download-router-support.cfg','download-router-support-state.json','download-router-sync.sys.mjs','download-router-actions.sys.mjs','download-router-extract.ps1','download-router-extract.vbs')) {
        if(Test-Path "$InstalledRoot/$name") {Copy-Item -LiteralPath "$InstalledRoot/$name" -Destination "$root/$name"}
    }
    foreach($name in @('zipquickextract-autoconfig.js','download-router-support.js')) {
        if(Test-Path "$InstalledRoot/defaults/pref/$name") {Copy-Item -LiteralPath "$InstalledRoot/defaults/pref/$name" -Destination "$root/defaults/pref/$name"}
    }
    $actor="$root/FirefoxEnhancementsHoverChild.sys.mjs"
    if($scenario -eq 'modified-orphan') {
        [IO.File]::AppendAllText($actor,"`n// unknown modification")
        $before=(Get-FileHash $actor).Hash
        try {Invoke-ArtllexAutoConfig -Root $root -Product FE -Sources $sources; throw 'Expected rejection'}
        catch {if($_.Exception.Message -notlike 'Unmanaged or modified file preserved:*') {throw}}
        if((Get-FileHash $actor).Hash -ne $before) {throw 'Unknown file changed'}
    } else {
        Invoke-ArtllexAutoConfig -Root $root -Product FE -Sources $sources
        $state=Get-Content "$root/firefox-enhancements-state.json" -Raw | ConvertFrom-Json
        if($state.hashes.'FirefoxEnhancementsHoverChild.sys.mjs' -ne (Get-FileHash $actor).Hash) {throw 'Actor not adopted'}
        Invoke-ArtllexAutoConfig -Root $root -Product FE -Sources $sources
    }
    Write-Output "PASS: $scenario"
}
