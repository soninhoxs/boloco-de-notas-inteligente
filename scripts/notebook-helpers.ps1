# Funções compartilhadas — servidor Mega Brain no notebook (Windows)

$script:NotebookRoot = Split-Path -Parent $PSScriptRoot
$script:NotebookComposeDir = Join-Path $NotebookRoot "backend\docker"
$script:NotebookEnvFile = Join-Path $NotebookRoot "backend\.env.notebook.local"
$script:BackendEnvFile = Join-Path $NotebookRoot "backend\.env"
$script:NotebookTunnelPidFile = Join-Path $NotebookRoot "backend\.notebook-tunnel.pid"
$script:NotebookTunnelUrlFile = Join-Path $NotebookRoot "backend\.notebook-tunnel.url"
$script:NotebookTunnelLogFile = Join-Path $NotebookRoot "backend\.notebook-tunnel.log"
$script:NotebookLocalUrl = "http://localhost:3080"

function Test-DockerRunning {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "Docker nao encontrado. Instale o Docker Desktop." -ForegroundColor Red
        return $false
    }
    try {
        docker info 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Import-DotEnvFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        if ($val.StartsWith('"') -and $val.EndsWith('"')) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        Set-Item -Path "Env:$key" -Value $val
    }
}

function Write-NotebookEnvFile {
    param([hashtable]$Vars)
    $lines = @(
        "# Gerado automaticamente — nao commitar",
        "POSTGRES_PASSWORD=$($Vars.POSTGRES_PASSWORD)",
        "JWT_SECRET=$($Vars.JWT_SECRET)",
        "MINIO_ROOT_USER=$($Vars.MINIO_ROOT_USER)",
        "MINIO_ROOT_PASSWORD=$($Vars.MINIO_ROOT_PASSWORD)",
        "NOTEBOOK_URL=$($Vars.NOTEBOOK_URL)",
        "ALLOWED_ORIGINS=$($Vars.ALLOWED_ORIGINS)"
    )
    Set-Content -Path $script:NotebookEnvFile -Value ($lines -join "`n") -Encoding UTF8
}

function Initialize-NotebookSecrets {
    Import-DotEnvFile $script:NotebookEnvFile
    Import-DotEnvFile $script:BackendEnvFile

    if (-not $env:JWT_SECRET) {
        $env:JWT_SECRET = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
    }
    if (-not $env:POSTGRES_PASSWORD) {
        $env:POSTGRES_PASSWORD = [Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Maximum 256 }))
    }
    if (-not $env:MINIO_ROOT_PASSWORD) {
        $env:MINIO_ROOT_PASSWORD = [Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Maximum 256 }))
    }
    if (-not $env:MINIO_ROOT_USER) {
        $env:MINIO_ROOT_USER = "megabrain_minio"
    }
}

function Get-NotebookComposeArgs {
    $args = @(
        "compose",
        "-f", "docker-compose.notebook.yml",
        "--env-file", $script:NotebookEnvFile
    )
    if (Test-Path $script:BackendEnvFile) {
        $args += @("--env-file", $script:BackendEnvFile)
    }
    return $args
}

function Set-NotebookPublicUrls {
    param(
        [string]$PublicUrl,
        [string]$AllowedOrigins
    )

    $env:NOTEBOOK_URL = $PublicUrl
    $env:ALLOWED_ORIGINS = $AllowedOrigins

    Write-NotebookEnvFile @{
        POSTGRES_PASSWORD   = $env:POSTGRES_PASSWORD
        JWT_SECRET          = $env:JWT_SECRET
        MINIO_ROOT_USER     = $env:MINIO_ROOT_USER
        MINIO_ROOT_PASSWORD = $env:MINIO_ROOT_PASSWORD
        NOTEBOOK_URL        = $PublicUrl
        ALLOWED_ORIGINS     = $AllowedOrigins
    }
}

function Invoke-NotebookCompose {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$ComposeCommand
    )

    Push-Location $script:NotebookComposeDir
    try {
        $baseArgs = Get-NotebookComposeArgs
        & docker @baseArgs @ComposeCommand
        if ($LASTEXITCODE -ne 0) {
            throw "docker compose falhou (codigo $LASTEXITCODE)"
        }
    } finally {
        Pop-Location
    }
}

function Start-NotebookStack {
    param(
        [switch]$SkipBuild
    )

    Initialize-NotebookSecrets

    if (-not $env:NOTEBOOK_URL) { $env:NOTEBOOK_URL = $script:NotebookLocalUrl }
    if (-not $env:ALLOWED_ORIGINS) { $env:ALLOWED_ORIGINS = $script:NotebookLocalUrl }

    Set-NotebookPublicUrls -PublicUrl $env:NOTEBOOK_URL -AllowedOrigins $env:ALLOWED_ORIGINS

    if (Test-Path $script:BackendEnvFile) {
        Write-Host "Usando backend\.env (OAuth / chaves de IA)" -ForegroundColor DarkGray
    }

    Write-Host "Build e start (primeira vez pode levar alguns minutos)..." -ForegroundColor Yellow
    if ($SkipBuild) {
        Invoke-NotebookCompose @("up", "-d")
    } else {
        Invoke-NotebookCompose @("up", "-d", "--build")
    }

    Write-Host "Aplicando migrations pendentes..." -ForegroundColor Yellow
    & "$script:NotebookRoot\scripts\run-migrations.ps1"
}

function Wait-NotebookHealth {
    param([int]$TimeoutSeconds = 120)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri "$($script:NotebookLocalUrl)/health" -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Get-CloudflaredPath {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $wingetPaths = @(
        "$env:ProgramFiles\Cloudflare\cloudflared\cloudflared.exe",
        "${env:ProgramFiles(x86)}\Cloudflare\cloudflared\cloudflared.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"
    )
    foreach ($path in $wingetPaths) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

function Stop-NotebookTunnel {
    if (-not (Test-Path $script:NotebookTunnelPidFile)) { return }

    $pidText = (Get-Content $script:NotebookTunnelPidFile -Raw).Trim()
    if ($pidText -match '^\d+$') {
        $tunnelPid = [int]$pidText
        $proc = Get-Process -Id $tunnelPid -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $tunnelPid -Force -ErrorAction SilentlyContinue
            Write-Host "Tunel publico encerrado (PID $tunnelPid)." -ForegroundColor DarkGray
        }
    }

    Remove-Item $script:NotebookTunnelPidFile -Force -ErrorAction SilentlyContinue
    Remove-Item $script:NotebookTunnelUrlFile -Force -ErrorAction SilentlyContinue
    Remove-Item $script:NotebookTunnelLogFile -Force -ErrorAction SilentlyContinue
}

function Start-NotebookTunnel {
    param([int]$TimeoutSeconds = 90)

    Stop-NotebookTunnel

    $cloudflared = Get-CloudflaredPath
    if (-not $cloudflared) {
        Write-Host ""
        Write-Host "cloudflared nao encontrado. Instale com:" -ForegroundColor Red
        Write-Host "  winget install Cloudflare.cloudflared" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Depois feche e abra o terminal e rode este script de novo." -ForegroundColor Yellow
        return $null
    }

    if (Test-Path $script:NotebookTunnelLogFile) {
        Remove-Item $script:NotebookTunnelLogFile -Force
    }

    Write-Host "Abrindo tunel publico (Cloudflare)..." -ForegroundColor Yellow

    $tunnelProc = Start-Process -FilePath $cloudflared `
        -ArgumentList @("tunnel", "--url", $script:NotebookLocalUrl) `
        -RedirectStandardError $script:NotebookTunnelLogFile `
        -PassThru `
        -WindowStyle Hidden

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $publicUrl = $null

    while ((Get-Date) -lt $deadline -and -not $publicUrl) {
        Start-Sleep -Seconds 2

        if ($tunnelProc.HasExited) {
            break
        }

        if (Test-Path $script:NotebookTunnelLogFile) {
            $log = Get-Content $script:NotebookTunnelLogFile -Raw -ErrorAction SilentlyContinue
            if ($log -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
                $publicUrl = $Matches[1].TrimEnd('/')
            }
        }
    }

    if (-not $publicUrl) {
        if (-not $tunnelProc.HasExited) {
            Stop-Process -Id $tunnelProc.Id -Force -ErrorAction SilentlyContinue
        }
        Write-Host "Nao foi possivel obter a URL publica do tunel." -ForegroundColor Red
        if (Test-Path $script:NotebookTunnelLogFile) {
            Write-Host "Log do cloudflared:" -ForegroundColor DarkGray
            Get-Content $script:NotebookTunnelLogFile | Select-Object -Last 15 | ForEach-Object { Write-Host $_ }
        }
        return $null
    }

    Set-Content -Path $script:NotebookTunnelPidFile -Value $tunnelProc.Id -Encoding ASCII
    Set-Content -Path $script:NotebookTunnelUrlFile -Value $publicUrl -Encoding UTF8

    return $publicUrl
}
