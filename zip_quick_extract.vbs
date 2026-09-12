Option Explicit

Dim shell, fso, psScript, archivePath, psExe, cmd, rc
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

If WScript.Arguments.Count < 2 Then
  WScript.Quit 90
End If

psScript = WScript.Arguments(0)
archivePath = WScript.Arguments(1)
psExe = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"

If Not fso.FileExists(psExe) Then WScript.Quit 91
If Not fso.FileExists(psScript) Then WScript.Quit 92

cmd = Q(psExe) & _
      " -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File " & _
      Q(psScript) & " -Archive " & Q(archivePath)

' Window style 0 = hidden. True = wait, so Firefox receives the PowerShell exit code.
rc = shell.Run(cmd, 0, True)
WScript.Quit rc

Function Q(ByVal value)
  Q = Chr(34) & Replace(value, Chr(34), Chr(34) & Chr(34)) & Chr(34)
End Function
