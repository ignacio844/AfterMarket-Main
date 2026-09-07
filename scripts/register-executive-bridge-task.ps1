$ErrorActionPreference = 'Stop'

$taskName = 'Grupo Aftermarket - Executive Bridge'
$projectRoot = Split-Path -Parent $PSScriptRoot
$supervisorScript = Join-Path $PSScriptRoot 'start-executive-bridge.ps1'
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.env.bridge'))) {
  throw 'Falta el archivo .env.bridge en la raíz del proyecto.'
}

$actionArguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$supervisorScript`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $actionArguments -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'Mantiene disponible el bridge SQL de indicadores ejecutivos en 127.0.0.1:8788.' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Output "Tarea '$taskName' registrada e iniciada para $currentUser."
