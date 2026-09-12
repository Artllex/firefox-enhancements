param(
    [Parameter(Mandatory = $true)]
    [int]$ParentPid,

    [Parameter(Mandatory = $true)]
    [string]$FirefoxExe,

    [switch]$SignalToggle
)

$ErrorActionPreference = 'Stop'
$logFile = Join-Path $env:TEMP 'FirefoxSecretWindow.log'
$secretProfileDir = Join-Path $env:LOCALAPPDATA 'Mozilla\Firefox\FirefoxSecretProfile'
$hiddenRequestFile = Join-Path $secretProfileDir '.secret-window-hidden'
$hiddenAckFile = Join-Path $secretProfileDir '.secret-window-hidden-ack'
$stateFile = Join-Path $secretProfileDir '.secret-window-state.json'

# Static names are intentional. The secret Firefox runs as a completely separate
# -no-remote instance, so either Firefox profile must be able to reach the same helper.
$eventName = 'Local\FirefoxSecretWindowToggle_v017'
$mutexName = 'Local\FirefoxSecretWindowHelper_v017'

function Write-SecretLog([string]$Message) {
    try {
        $line = ('{0:yyyy-MM-dd HH:mm:ss.fff}  {1}' -f (Get-Date), $Message)
        Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
    }
    catch {}
}

if ($SignalToggle) {
    try {
        $evt = [System.Threading.EventWaitHandle]::OpenExisting($eventName)
        [void]$evt.Set()
        $evt.Dispose()
        exit 0
    }
    catch {
        Write-SecretLog "Nie mozna wyslac sygnalu toggle: $($_.Exception.Message)"
        exit 4
    }
}

$createdNew = $false
$mutex = [System.Threading.Mutex]::new($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
    $mutex.Dispose()
    exit 0
}

$nativeCode = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class FirefoxSecretNative
{
    public const uint MOD_ALT = 0x0001;
    public const uint MOD_CONTROL = 0x0002;
    public const uint WM_HOTKEY = 0x0312;
    public const uint PM_REMOVE = 0x0001;
    public const int SW_HIDE = 0;
    public const int SW_SHOW = 5;
    public const uint PROCESS_SUSPEND_RESUME = 0x0800;

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public UIntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
    }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool PeekMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax, uint wRemoveMsg);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(uint processAccess, bool bInheritHandle, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("ntdll.dll")]
    public static extern int NtSuspendProcess(IntPtr processHandle);

    [DllImport("ntdll.dll")]
    public static extern int NtResumeProcess(IntPtr processHandle);

    public static IntPtr[] GetMozillaWindows(int[] pids)
    {
        HashSet<int> allowed = new HashSet<int>(pids ?? new int[0]);
        List<IntPtr> result = new List<IntPtr>();
        EnumWindows(delegate (IntPtr hWnd, IntPtr lParam)
        {
            uint windowPid;
            GetWindowThreadProcessId(hWnd, out windowPid);
            if (!allowed.Contains((int)windowPid))
                return true;

            StringBuilder className = new StringBuilder(256);
            GetClassName(hWnd, className, className.Capacity);
            if (String.Equals(className.ToString(), "MozillaWindowClass", StringComparison.Ordinal))
                result.Add(hWnd);

            return true;
        }, IntPtr.Zero);
        return result.ToArray();
    }

    public static bool SuspendProcess(int pid)
    {
        IntPtr handle = OpenProcess(PROCESS_SUSPEND_RESUME, false, pid);
        if (handle == IntPtr.Zero)
            return false;
        try
        {
            return NtSuspendProcess(handle) >= 0;
        }
        finally
        {
            CloseHandle(handle);
        }
    }

    public static bool ResumeProcess(int pid)
    {
        IntPtr handle = OpenProcess(PROCESS_SUSPEND_RESUME, false, pid);
        if (handle == IntPtr.Zero)
            return false;
        try
        {
            return NtResumeProcess(handle) >= 0;
        }
        finally
        {
            CloseHandle(handle);
        }
    }
}
'@

try {
    Add-Type -TypeDefinition $nativeCode -Language CSharp
}
catch {
    Write-SecretLog "Add-Type error: $($_.Exception.Message)"
    try { $mutex.ReleaseMutex() } catch {}
    $mutex.Dispose()
    exit 5
}

$toggleEvent = $null
$hotkeyRegistered = $false
$hotkeyId = 0x5346
$vkSpace = 0x20
$secretRootPid = 0
$hidden = $false
$suspendedPids = @()
$knownWindows = @()
$selfPid = [System.Diagnostics.Process]::GetCurrentProcess().Id

function Test-ProcessAlive([int]$PidToTest) {
    if ($PidToTest -le 0) { return $false }
    try { return $null -ne (Get-Process -Id $PidToTest -ErrorAction SilentlyContinue) }
    catch { return $false }
}

function Initialize-SecretProfile {
    if (-not (Test-Path -LiteralPath $secretProfileDir)) {
        New-Item -ItemType Directory -Path $secretProfileDir -Force | Out-Null
    }

    # user.js is reapplied by Firefox on every start. Besides first-run cleanup,
    # Firefox Accounts/Sync are disabled here so History/Tabs cannot accidentally
    # synchronize back into the normal profile even if the user later tries to
    # sign this profile into the same Firefox account.
    $userJs = @'
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage", "about:blank");
user_pref("browser.startup.page", 0);
user_pref("identity.fxaccounts.enabled", false);
user_pref("services.sync.engine.history", false);
user_pref("services.sync.engine.tabs", false);
'@
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $secretProfileDir 'user.js'), $userJs, $utf8)
}

function Find-SecretRootPid {
    try {
        $needle = $secretProfileDir.ToLowerInvariant()
        $items = Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" -ErrorAction Stop
        foreach ($item in $items) {
            $cmd = [string]$item.CommandLine
            if ($cmd -and $cmd.ToLowerInvariant().Contains($needle)) {
                return [int]$item.ProcessId
            }
        }
    }
    catch {
        Write-SecretLog "Find-SecretRootPid error: $($_.Exception.Message)"
    }
    return 0
}

function Get-ProcessTreePids([int]$RootPid) {
    if ($RootPid -le 0) { return @() }
    try {
        $all = @(Get-CimInstance Win32_Process -ErrorAction Stop | Select-Object ProcessId, ParentProcessId)
        $result = New-Object System.Collections.Generic.List[int]
        $queue = New-Object System.Collections.Generic.Queue[int]
        $seen = New-Object 'System.Collections.Generic.HashSet[int]'
        $queue.Enqueue($RootPid)
        while ($queue.Count -gt 0) {
            $pid = $queue.Dequeue()
            if (-not $seen.Add($pid)) { continue }
            if (Test-ProcessAlive $pid) { $result.Add($pid) }
            foreach ($p in $all) {
                if ([int]$p.ParentProcessId -eq $pid) {
                    $queue.Enqueue([int]$p.ProcessId)
                }
            }
        }
        return @($result.ToArray())
    }
    catch {
        Write-SecretLog "Get-ProcessTreePids error: $($_.Exception.Message)"
        if (Test-ProcessAlive $RootPid) { return @($RootPid) }
        return @()
    }
}

function Get-SecretWindows {
    if (-not (Test-ProcessAlive $script:secretRootPid)) { return @() }
    $pids = Get-ProcessTreePids $script:secretRootPid
    if ($pids.Count -eq 0) { return @() }
    return @([FirefoxSecretNative]::GetMozillaWindows([int[]]$pids))
}

function Save-State {
    try {
        if (-not (Test-Path -LiteralPath $secretProfileDir)) { return }
        $obj = [ordered]@{
            rootPid = $script:secretRootPid
            hidden = [bool]$script:hidden
            suspendedPids = @($script:suspendedPids)
        }
        $obj | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $stateFile -Encoding UTF8
    }
    catch {}
}

function Load-State {
    try {
        if (-not (Test-Path -LiteralPath $stateFile)) { return }
        $obj = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($obj.rootPid -and (Test-ProcessAlive ([int]$obj.rootPid))) {
            $script:secretRootPid = [int]$obj.rootPid
            $script:hidden = [bool]$obj.hidden
            $script:suspendedPids = @($obj.suspendedPids | ForEach-Object { [int]$_ })
            Write-SecretLog "Odtworzono stan helpera: PID=$($script:secretRootPid), hidden=$($script:hidden)."
        }
    }
    catch {
        Write-SecretLog "Load-State error: $($_.Exception.Message)"
    }
}

function Set-HiddenRequest([bool]$Value) {
    try {
        if ($Value) {
            if (-not (Test-Path -LiteralPath $hiddenRequestFile)) {
                New-Item -ItemType File -Path $hiddenRequestFile -Force | Out-Null
            }
        }
        else {
            Remove-Item -LiteralPath $hiddenRequestFile -Force -ErrorAction SilentlyContinue
            Remove-Item -LiteralPath $hiddenAckFile -Force -ErrorAction SilentlyContinue
        }
    }
    catch {
        Write-SecretLog "Set-HiddenRequest error: $($_.Exception.Message)"
    }
}

function Wait-MuteAck {
    # AutoConfig in the secret profile mutes every tab and writes this ACK.
    # If it cannot respond, process suspension below still guarantees silence.
    for ($i = 0; $i -lt 12; $i++) {
        if (Test-Path -LiteralPath $hiddenAckFile) { return $true }
        Start-Sleep -Milliseconds 25
    }
    return $false
}

function New-SecretInstance {
    if (-not (Test-Path -LiteralPath $FirefoxExe)) {
        Write-SecretLog "Nie znaleziono firefox.exe: $FirefoxExe"
        return $false
    }

    Initialize-SecretProfile
    Set-HiddenRequest $false

    try {
        # -no-remote implies a new independent Firefox instance. -profile points
        # it at a dedicated directory, so history, cookies, sessions, logins,
        # extensions and site storage are isolated from the normal Firefox profile.
        $quotedProfile = '"' + $secretProfileDir + '"'
        $proc = Start-Process -FilePath $FirefoxExe -ArgumentList @(
            '-no-remote',
            '-profile',
            $quotedProfile,
            '-new-window',
            'about:blank'
        ) -PassThru
        $script:secretRootPid = [int]$proc.Id
        Write-SecretLog "Uruchomiono osobny profil Secret, PID=$($script:secretRootPid), path=$secretProfileDir"
    }
    catch {
        Write-SecretLog "Nie udalo sie uruchomic osobnego profilu: $($_.Exception.Message)"
        return $false
    }

    # Wait until Firefox creates at least one real top-level browser window.
    for ($i = 0; $i -lt 160; $i++) {
        Start-Sleep -Milliseconds 75
        if (-not (Test-ProcessAlive $script:secretRootPid)) {
            $found = Find-SecretRootPid
            if ($found -gt 0) { $script:secretRootPid = $found }
        }
        $wins = Get-SecretWindows
        if ($wins.Count -gt 0) {
            $script:knownWindows = @($wins)
            $script:hidden = $false
            Save-State
            return $true
        }
    }

    Write-SecretLog 'Timeout podczas oczekiwania na okno osobnego profilu.'
    return $false
}

function Ensure-SecretInstance {
    if (Test-ProcessAlive $script:secretRootPid) { return $true }
    $found = Find-SecretRootPid
    if ($found -gt 0) {
        $script:secretRootPid = $found
        $script:hidden = Test-Path -LiteralPath $hiddenRequestFile
        Write-SecretLog "Wykryto juz uruchomiony osobny profil, PID=$found."
        return $true
    }
    return New-SecretInstance
}

function Suspend-SecretTree {
    $pids = @(Get-ProcessTreePids $script:secretRootPid)
    if ($pids.Count -eq 0) { return }

    # Children first, root process last. This freezes web content, media decoders,
    # timers and the browser itself. Nothing in this profile can keep playing while hidden.
    # Never suspend this helper process itself. This is a recovery guard against
    # any launch topology in which the helper could accidentally appear below the
    # Secret Firefox process tree. If the helper froze itself, the hotkey could no
    # longer resume the hidden profile.
    $ordered = @($pids | Where-Object { $_ -ne $script:secretRootPid -and $_ -ne $script:selfPid }) + @($script:secretRootPid)
    $ordered = @($ordered | Where-Object { $_ -ne $script:selfPid })
    $done = New-Object System.Collections.Generic.List[int]
    foreach ($pid in $ordered) {
        try {
            if ([FirefoxSecretNative]::SuspendProcess([int]$pid)) {
                $done.Add([int]$pid)
            }
        }
        catch {
            Write-SecretLog "Suspend PID $pid error: $($_.Exception.Message)"
        }
    }
    $script:suspendedPids = @($done.ToArray())
}

function Resume-SecretTree {
    if ($script:suspendedPids.Count -eq 0) {
        # Recovery path after helper restart: use the current process tree.
        $script:suspendedPids = @(Get-ProcessTreePids $script:secretRootPid)
    }

    # Root first so Firefox can immediately service its child processes.
    $ordered = @($script:secretRootPid) + @($script:suspendedPids | Where-Object { $_ -ne $script:secretRootPid })
    foreach ($pid in ($ordered | Select-Object -Unique)) {
        if (-not (Test-ProcessAlive ([int]$pid))) { continue }
        try { [void][FirefoxSecretNative]::ResumeProcess([int]$pid) }
        catch { Write-SecretLog "Resume PID $pid error: $($_.Exception.Message)" }
    }
    $script:suspendedPids = @()
}

function Show-SecretInstance {
    if (-not (Ensure-SecretInstance)) { return }

    # Make windows visible while the process tree is still frozen and browser tabs
    # are still muted. Only then resume. This prevents even a short hidden playback gap.
    $wins = if ($script:knownWindows.Count -gt 0) { @($script:knownWindows) } else { @(Get-SecretWindows) }
    foreach ($h in $wins) {
        try {
            if ([FirefoxSecretNative]::IsWindow($h)) {
                [void][FirefoxSecretNative]::ShowWindow($h, [FirefoxSecretNative]::SW_SHOW)
            }
        } catch {}
    }

    if ($script:hidden) {
        Resume-SecretTree
    }

    Set-HiddenRequest $false
    $script:hidden = $false
    Save-State

    # Prefer the first browser window as the foreground target.
    $wins = @(Get-SecretWindows)
    $script:knownWindows = @($wins)
    if ($wins.Count -gt 0) {
        try {
            [void][FirefoxSecretNative]::BringWindowToTop($wins[0])
            [void][FirefoxSecretNative]::SetForegroundWindow($wins[0])
        } catch {}
    }
    Write-SecretLog 'Tajny profil pokazany; procesy wznowione, blokada audio zdjeta.'
}

function Hide-SecretInstance {
    if (-not (Ensure-SecretInstance)) { return }

    # First ask Firefox itself to mute every tab in the Secret profile and wait for ACK.
    Set-HiddenRequest $true
    $ack = Wait-MuteAck
    if ($ack) { Write-SecretLog 'Firefox potwierdzil wyciszenie wszystkich kart.' }
    else { Write-SecretLog 'Brak ACK wyciszenia; kontynuuje, bo zawieszenie procesu gwarantuje cisze.' }

    $wins = @(Get-SecretWindows)
    $script:knownWindows = @($wins)
    foreach ($h in $wins) {
        try {
            if ([FirefoxSecretNative]::IsWindow($h)) {
                [void][FirefoxSecretNative]::ShowWindow($h, [FirefoxSecretNative]::SW_HIDE)
            }
        } catch {}
    }

    Suspend-SecretTree
    $script:hidden = $true
    Save-State
    Write-SecretLog "Tajny profil ukryty; zawieszono $($script:suspendedPids.Count) procesow. Media sa zamrozone."
}

function Toggle-SecretWindow {
    try {
        # First invocation must create and SHOW the Secret profile. In v0.1.6 the
        # generic Ensure + toggle sequence could create the window and immediately
        # hide it, which was especially confusing when invoked from the menu.
        $exists = Test-ProcessAlive $script:secretRootPid
        if (-not $exists) {
            $found = Find-SecretRootPid
            if ($found -gt 0) {
                $script:secretRootPid = $found
                $script:hidden = Test-Path -LiteralPath $hiddenRequestFile
                $exists = $true
            }
        }

        if (-not $exists) {
            if (New-SecretInstance) {
                Show-SecretInstance
            }
            return
        }

        if ($script:hidden) { Show-SecretInstance }
        else { Hide-SecretInstance }
    }
    catch {
        Write-SecretLog "Toggle error: $($_.Exception.Message)"
    }
}

try {
    Initialize-SecretProfile
    Load-State

    if (-not (Test-ProcessAlive $script:secretRootPid)) {
        $script:secretRootPid = Find-SecretRootPid
        if ($script:secretRootPid -gt 0) {
            $script:hidden = Test-Path -LiteralPath $hiddenRequestFile
        }
    }

    $toggleEvent = [System.Threading.EventWaitHandle]::new(
        $false,
        [System.Threading.EventResetMode]::AutoReset,
        $eventName
    )

    $hotkeyRegistered = [FirefoxSecretNative]::RegisterHotKey(
        [IntPtr]::Zero,
        $hotkeyId,
        ([FirefoxSecretNative]::MOD_CONTROL -bor [FirefoxSecretNative]::MOD_ALT),
        $vkSpace
    )

    if ($hotkeyRegistered) {
        Write-SecretLog 'Zarejestrowano globalny skrot Ctrl+Alt+Space.'
    }
    else {
        Write-SecretLog 'UWAGA: Ctrl+Alt+Space jest juz zajety i RegisterHotKey zwrocil false.'
    }

    $lastCallerCheck = Get-Date
    while ($true) {
        $msg = New-Object FirefoxSecretNative+MSG
        while ([FirefoxSecretNative]::PeekMessage([ref]$msg, [IntPtr]::Zero, 0, 0, [FirefoxSecretNative]::PM_REMOVE)) {
            if ($msg.message -eq [FirefoxSecretNative]::WM_HOTKEY -and $msg.wParam.ToUInt64() -eq [uint64]$hotkeyId) {
                Toggle-SecretWindow
            }
        }

        if ($toggleEvent.WaitOne(0)) {
            Toggle-SecretWindow
        }

        if ($script:secretRootPid -gt 0 -and -not (Test-ProcessAlive $script:secretRootPid)) {
            Write-SecretLog 'Proces tajnego profilu zostal zamkniety.'
            $script:secretRootPid = 0
            $script:hidden = $false
            $script:suspendedPids = @()
            $script:knownWindows = @()
            Set-HiddenRequest $false
            Save-State
        }

        # Keep the global helper alive as long as either the Firefox that started it
        # or the Secret profile is alive. This avoids trapping a hidden/suspended
        # Secret profile if the normal Firefox window is closed first.
        if (((Get-Date) - $lastCallerCheck).TotalMilliseconds -ge 750) {
            $callerAlive = Test-ProcessAlive $ParentPid
            $secretAlive = Test-ProcessAlive $script:secretRootPid
            if (-not $callerAlive -and -not $secretAlive) { break }
            $lastCallerCheck = Get-Date
        }

        Start-Sleep -Milliseconds 35
    }
}
catch {
    Write-SecretLog "Helper error: $($_.Exception.Message)"
}
finally {
    if ($hotkeyRegistered) {
        try { [void][FirefoxSecretNative]::UnregisterHotKey([IntPtr]::Zero, $hotkeyId) } catch {}
    }
    if ($toggleEvent) {
        try { $toggleEvent.Dispose() } catch {}
    }
    try { $mutex.ReleaseMutex() } catch {}
    try { $mutex.Dispose() } catch {}
}
