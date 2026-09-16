$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$auditRoot = 'C:\Users\Auditoria\Desktop\AUDITORIAS\GRUPO AFTERMARKET\REACT\AUDITORIA.BESTIA\sistema-auditoria'
$runtimeDirectory = Join-Path $projectRoot '.runtime'
$bridgeEnvironment = Join-Path $projectRoot '.env.bridge'
$portalEnvironment = Join-Path $projectRoot '.env.local'
$auditBridgeEnvironment = Join-Path $auditRoot '.env.bridge'
$supervisorLog = Join-Path $runtimeDirectory 'shared-bridge-supervisor.log'
$ngrokPublicUrl = 'https://surgical-dean-overtime.ngrok-free.dev'

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null

function Write-SupervisorLog {
  param([string]$Message)
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -LiteralPath $supervisorLog -Value "[$timestamp] $Message"
}

function Test-Endpoint {
  param([string]$Uri)
  try {
    $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-NodeProcess {
  param(
    [string]$WorkingDirectory,
    [string[]]$Arguments,
    [string]$LogPrefix
  )

  $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
  Start-Process `
    -FilePath $nodePath `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $runtimeDirectory "$LogPrefix.out.log") `
    -RedirectStandardError (Join-Path $runtimeDirectory "$LogPrefix.error.log")
}

function Start-AuditBridge {
  if (-not (Test-Path -LiteralPath $auditBridgeEnvironment)) {
    throw "No se encontró $auditBridgeEnvironment"
  }
  Start-NodeProcess -WorkingDirectory $auditRoot -Arguments @('--env-file=.env.bridge', 'bridge/server.mjs') -LogPrefix 'audit-bridge'
  Write-SupervisorLog 'Bridge de Auditoría iniciado en 8787.'
}

function Start-ExecutiveBridge {
  if (-not (Test-Path -LiteralPath $bridgeEnvironment)) {
    throw "No se encontró $bridgeEnvironment"
  }
  Start-NodeProcess -WorkingDirectory $projectRoot -Arguments @('--env-file=.env.bridge', 'bridge/server.mjs') -LogPrefix 'executive-bridge'
  Write-SupervisorLog 'Bridge Ejecutivo iniciado en 8788.'
}

function Start-VentasBridge {
  if (-not (Test-Path -LiteralPath $bridgeEnvironment)) {
    throw "No se encontró $bridgeEnvironment"
  }
  Start-NodeProcess -WorkingDirectory $projectRoot -Arguments @('--env-file=.env.local', '--env-file=.env.bridge', 'bridge/ventas-sync.mjs') -LogPrefix 'ventas-bridge'
  Write-SupervisorLog 'Worker de Ventas iniciado en 8789.'
}

function Start-EscobarBridge {
  if (-not (Test-Path -LiteralPath $portalEnvironment)) {
    throw "No se encontró $portalEnvironment"
  }
  Start-NodeProcess -WorkingDirectory $projectRoot -Arguments @('--env-file=.env.local', 'bridge/escobar-sync.mjs') -LogPrefix 'escobar-bridge'
  Write-SupervisorLog 'Worker de Escobar iniciado en 8791.'
}

function Test-VentasConfigured {
  if (-not (Test-Path -LiteralPath $portalEnvironment)) { return $false }
  $content = Get-Content -LiteralPath $portalEnvironment
  $hasUrl = $content | Where-Object { $_ -match '^\s*SUPABASE_URL\s*=\s*\S+' } | Select-Object -First 1
  $hasKey = $content | Where-Object { $_ -match '^\s*SUPABASE_SECRET_KEY\s*=\s*\S+' } | Select-Object -First 1
  return [bool]($hasUrl -and $hasKey)
}

function Test-EscobarConfigured {
  if (-not (Test-VentasConfigured)) { return $false }
  $content = Get-Content -LiteralPath $portalEnvironment
  $hasEmail = $content | Where-Object { $_ -match '^\s*GOOGLE_SERVICE_ACCOUNT_EMAIL\s*=\s*\S+' } | Select-Object -First 1
  $hasKey = $content | Where-Object { $_ -match '^\s*GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY\s*=\s*\S+' } | Select-Object -First 1
  return [bool]($hasEmail -and $hasKey)
}

function Start-Gateway {
  Start-NodeProcess -WorkingDirectory $projectRoot -Arguments @('bridge/gateway.mjs') -LogPrefix 'bridge-gateway'
  Write-SupervisorLog 'Gateway compartido iniciado en 8790.'
}

function Get-NgrokTunnel {
  try {
    $response = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 5
    return $response.tunnels | Select-Object -First 1
  } catch {
    return $null
  }
}

function Start-Ngrok {
  $ngrokPath = (Get-Command ngrok.exe -ErrorAction Stop).Source
  Start-Process `
    -FilePath $ngrokPath `
    -ArgumentList @('http', '8790', '--url', $ngrokPublicUrl, '--log', 'stdout', '--log-format', 'json') `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $runtimeDirectory 'ngrok.out.log') `
    -RedirectStandardError (Join-Path $runtimeDirectory 'ngrok.error.log')
  Write-SupervisorLog "ngrok iniciado: $ngrokPublicUrl -> 8790."
}

function Ensure-Service {
  param(
    [string]$HealthUri,
    [scriptblock]$StartAction,
    [string]$ServiceName
  )

  if (Test-Endpoint $HealthUri) { return }
  try {
    & $StartAction
    Start-Sleep -Seconds 5
    if (-not (Test-Endpoint $HealthUri)) {
      Write-SupervisorLog "$ServiceName se inició, pero aún no responde."
    }
  } catch {
    Write-SupervisorLog "No se pudo iniciar ${ServiceName}: $($_.Exception.Message)"
  }
}

Write-SupervisorLog 'Supervisor compartido iniciado.'

while ($true) {
  Ensure-Service -HealthUri 'http://127.0.0.1:8787/health' -StartAction ${function:Start-AuditBridge} -ServiceName 'bridge de Auditoría'
  Ensure-Service -HealthUri 'http://127.0.0.1:8788/health' -StartAction ${function:Start-ExecutiveBridge} -ServiceName 'bridge Ejecutivo'
  if (Test-VentasConfigured) {
    Ensure-Service -HealthUri 'http://127.0.0.1:8789/health' -StartAction ${function:Start-VentasBridge} -ServiceName 'worker de Ventas'
  }
  if (Test-EscobarConfigured) {
    Ensure-Service -HealthUri 'http://127.0.0.1:8791/health' -StartAction ${function:Start-EscobarBridge} -ServiceName 'worker de Escobar'
  }
  Ensure-Service -HealthUri 'http://127.0.0.1:8790/health' -StartAction ${function:Start-Gateway} -ServiceName 'gateway compartido'

  $tunnel = Get-NgrokTunnel
  if (-not $tunnel) {
    try {
      Start-Ngrok
      Start-Sleep -Seconds 5
    } catch {
      Write-SupervisorLog "No se pudo iniciar ngrok: $($_.Exception.Message)"
    }
  } elseif ($tunnel.config.addr -notmatch ':8790$') {
    Write-SupervisorLog "Advertencia: ngrok está activo pero apunta a $($tunnel.config.addr), no a 8790."
  }

  # Los controles HTTP no realizan consultas SQL.
  Start-Sleep -Seconds 60
}
