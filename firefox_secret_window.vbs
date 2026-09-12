Option Explicit

Dim shell, fso, psScript, parentPid, firefoxExe, mode, psExe, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

If WScript.Arguments.Count < 4 Then
  WScript.Quit 90
End If

psScript = WScript.Arguments(0)
parentPid = WScript.Arguments(1)
firefoxExe = WScript.Arguments(2)
mode = LCase(WScript.Arguments(3))
psExe = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"

If Not fso.FileExists(psExe) Then WScript.Quit 91
If Not fso.FileExists(psScript) Then WScript.Quit 92
If Not fso.FileExists(firefoxExe) Then WScript.Quit 93

cmd = Q(psExe) & _
      " -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File " & _
      Q(psScript) & " -ParentPid " & parentPid & " -FirefoxExe " & Q(firefoxExe)

If mode = "toggle" Then
  cmd = cmd & " -SignalToggle"
End If

' 0 = hidden window; False = do not wait. The listener is a persistent,
' completely background PowerShell process and the short toggle sender exits immediately.
shell.Run cmd, 0, False
WScript.Quit 0

Function Q(ByVal value)
  Q = Chr(34) & Replace(value, Chr(34), Chr(34) & Chr(34)) & Chr(34)
End Function
