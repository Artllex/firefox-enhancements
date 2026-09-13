# Artllex shared AutoConfig protocol v2. Keep this file identical in both packages.
$script:ArtllexLoader = @'
// Artllex shared AutoConfig v2
(function () {
  if (globalThis.__artllexSharedLoaded) return;
  globalThis.__artllexSharedLoaded = true;
  var root = Services.dirsvc.get("GreD", Ci.nsIFile);
  Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler)
    .setSubstitution("artllex-shared", Services.io.newFileURI(root));
  var entries = [
    ["zipquickextract-autoconfig.js", "zipquickextract.cfg"],
    ["download-router-support.js", "download-router-support.cfg"]
  ];
  for (var entry of entries) {
    var enabled = root.clone();
    enabled.append("defaults"); enabled.append("pref"); enabled.append(entry[0]);
    var module = root.clone(); module.append(entry[1]);
    if (!enabled.exists() || !module.exists()) continue;
    try { Services.scriptloader.loadSubScript("resource://artllex-shared/" + entry[1], globalThis, "UTF-8"); }
    catch (error) { Components.utils.reportError(error); }
  }
})();
'@
function Convert-ArtllexModule([string]$Text) {
    # Remove only the known v1 peer-loading suffix; retain the product's own code.
    $marker = '  // Only load the other product while its own preference file is active.'
    $index = $Text.IndexOf($marker)
    if ($index -ge 0) {return $Text.Substring(0,$index) + "})();`n"}
    # Adapter from FE 0.1.17: keep the old feature body, remove its peer dispatcher.
    if ($Text.StartsWith('// Download Router Support - compatibility adapter')) {
        $index = $Text.IndexOf('  try {')
        if ($index -lt 0) {throw 'Unrecognized legacy adapter; preserved.'}
        return $Text.Substring(0,$index) + "})();`n"
    }
    return $Text
}
function Invoke-ArtllexAutoConfig {
    param([string]$Root,[ValidateSet('FE','DL')][string]$Product,
          [ValidateSet('Install','Remove')][string]$Action='Install',[hashtable]$Sources)
    $Root=[IO.Path]::GetFullPath($Root)
    if (!(Test-Path -LiteralPath (Join-Path $Root 'firefox.exe'))) {throw 'Firefox installation not found.'}
    $definitions=@{
        FE=@{owner='FirefoxEnhancements';state='firefox-enhancements-state.json';pref='zipquickextract-autoconfig.js';cfg='zipquickextract.cfg';files=@('zipquickextract.cfg','firefox_secret_window.ps1','firefox_secret_window.vbs')}
        DL=@{owner='DownloadRouterSupport';state='download-router-support-state.json';pref='download-router-support.js';cfg='download-router-support.cfg';files=@('download-router-support.cfg','download-router-sync.sys.mjs','download-router-actions.sys.mjs','download-router-extract.ps1','download-router-extract.vbs')}
    }
    $prefDir=Join-Path $Root 'defaults/pref'
    $shared=Join-Path $Root 'artllex.cfg'
    $writes=@{}; $removals=@(); $states=@{}
    # Validate everything before changing anything, including disabled product files.
    foreach($key in @('FE','DL')) {
        $d=$definitions[$key]; $statePath=Join-Path $Root $d.state
        if($key -ne $Product -and !(Test-Path -LiteralPath (Join-Path $prefDir $d.pref))) {continue}
        $state=$null
        if(Test-Path -LiteralPath $statePath) {
            $state=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
            if($state.owner -ne $d.owner) {throw "Unknown ownership: $statePath"}
        }
        $paths=@($d.files | ForEach-Object {Join-Path $Root $_}) + @(Join-Path $prefDir $d.pref)
        foreach($p in $paths) {
            if(Test-Path -LiteralPath $p) {
                $expected=if($state){$state.hashes.([IO.Path]::GetFileName($p))}else{$null}
                # Known pre-ownership FE files, permitted only when FE itself is upgraded.
                if(!$state -and $Product -eq 'FE' -and $key -eq 'FE') {
                    $legacy=@{
                        'zipquickextract.cfg'='C38C51BD78937039A92C5BC7019086E15180CE727B2A5634F6EA1066B815B8EC'
                        'firefox_secret_window.ps1'='21CD2F444ABC62490814F03DDDB951CC0801E1AE14475890F7BF3A601391D851'
                        'firefox_secret_window.vbs'='B5FE7AE4479DBEBB5056E3BBF1ED566826416B227C92A804B4A233D28DDCBED8'
                    }
                    $expected=$legacy[[IO.Path]::GetFileName($p)]
                }
                if(!$expected -or (Get-FileHash -LiteralPath $p).Hash -ne $expected) {throw "Unmanaged or modified file preserved: $p"}
            }
        }
        $states[$key]=$state
    }
    foreach($pref in Get-ChildItem -LiteralPath $prefDir -Filter '*.js' -File -ErrorAction SilentlyContinue) {
        if($pref.Name -notin @($definitions.FE.pref,$definitions.DL.pref) -and
           (Select-String -LiteralPath $pref.FullName -Pattern 'general\.config\.filename' -Quiet)) {
            throw "Another AutoConfig is active; no files changed: $($pref.FullName)"
        }
    }
    if(Test-Path -LiteralPath $shared) {
        if([IO.File]::ReadAllText($shared).Replace("`r`n","`n").TrimEnd() -cne $script:ArtllexLoader.Replace("`r`n","`n").TrimEnd()) {
            throw 'Shared AutoConfig was modified or is from an unsupported version; preserved.'
        }
    }
    $own=$definitions[$Product]
    if($Action -eq 'Install') {
        foreach($name in $own.files) {
            if(!$Sources.ContainsKey($name)) {throw "Missing installation source: $name"}
            $bytes=[IO.File]::ReadAllBytes($Sources[$name])
            if($name -eq $own.cfg) {$bytes=[Text.Encoding]::UTF8.GetBytes((Convert-ArtllexModule ([IO.File]::ReadAllText($Sources[$name]))))}
            $writes[(Join-Path $Root $name)]=$bytes
        }
    } else {
        $removals=@($own.files | ForEach-Object {Join-Path $Root $_}) + @(Join-Path $prefDir $own.pref) + @(Join-Path $Root $own.state)
    }
    $active=0
    foreach($key in @('FE','DL')) {
        $d=$definitions[$key]; $pref=Join-Path $prefDir $d.pref
        if($key -eq $Product -and $Action -eq 'Remove') {continue}
        if(!($key -eq $Product -and $Action -eq 'Install') -and !(Test-Path -LiteralPath $pref)) {continue}
        $active++
        $cfg=Join-Path $Root $d.cfg
        if(!$writes.ContainsKey($cfg)) {
            if(!(Test-Path -LiteralPath $cfg)) {throw "Active module missing: $cfg"}
            $writes[$cfg]=[Text.Encoding]::UTF8.GetBytes((Convert-ArtllexModule ([IO.File]::ReadAllText($cfg))))
        }
        $header=if($key -eq 'FE'){'// Firefox ZIP Quick Extract - AutoConfig bootstrap'}else{'// Download Router Support - AutoConfig bootstrap'}
        $text=$header+"`n"+'pref("general.config.filename", "artllex.cfg");'+"`n"+'pref("general.config.obscure_value", 0);'+"`n"+'pref("general.config.sandbox_enabled", false);'+"`n"
        $writes[$pref]=[Text.Encoding]::UTF8.GetBytes($text)
        $hashes=@{}
        foreach($p in @($d.files | ForEach-Object {Join-Path $Root $_}) + @($pref)) {
            if($writes.ContainsKey($p)) {
                $sha=[Security.Cryptography.SHA256]::Create()
                try {$hashes[[IO.Path]::GetFileName($p)]=[BitConverter]::ToString($sha.ComputeHash($writes[$p])).Replace('-','')} finally {$sha.Dispose()}
            } elseif(Test-Path -LiteralPath $p) {$hashes[[IO.Path]::GetFileName($p)]=(Get-FileHash -LiteralPath $p).Hash}
        }
        $writes[(Join-Path $Root $d.state)]=[Text.Encoding]::UTF8.GetBytes((@{owner=$d.owner;hashes=$hashes}|ConvertTo-Json))
    }
    if($active) {$writes[$shared]=[Text.Encoding]::UTF8.GetBytes($script:ArtllexLoader)}
    else {$removals+=@($shared)}
    # Backup and rollback include both ownership records and migrated preferences.
    $targets=@(@($writes.Keys)+$removals | Select-Object -Unique)
    $backup=Join-Path $Root ('artllex-backup-'+[guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    $snapshots=@{}; $changed=@()
    foreach($p in $targets) {
        $relative=$p.Substring($Root.Length).TrimStart('\','/')
        if(Test-Path -LiteralPath $p) {
            $b=Join-Path $backup $relative
            New-Item -ItemType Directory -Path (Split-Path $b) -Force | Out-Null
            Copy-Item -LiteralPath $p -Destination $b
            $snapshots[$p]=$b
        }
    }
    try {
        foreach($p in $writes.Keys) {
            New-Item -ItemType Directory -Path (Split-Path $p) -Force | Out-Null
            $changed+=@($p)
            [IO.File]::WriteAllBytes($p,$writes[$p])
        }
        foreach($p in $removals) {if(Test-Path -LiteralPath $p) {$changed+=@($p); Remove-Item -LiteralPath $p}}
    } catch {
        foreach($p in $changed) {
            if($snapshots.ContainsKey($p)) {Copy-Item -LiteralPath $snapshots[$p] -Destination $p -Force}
            elseif(Test-Path -LiteralPath $p) {Remove-Item -LiteralPath $p}
        }
        throw
    }
    Write-Output "Shared AutoConfig: $Action $Product; active modules: $active; backup: $backup"
}
