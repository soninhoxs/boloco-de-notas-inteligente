# Aplica migrations *.up.sql pendentes no Postgres do stack notebook
param(
    [string]$ComposeFile = "docker-compose.notebook.yml"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "backend\docker"
$EnvFile = Join-Path $Root "backend\.env"
$NotebookEnvFile = Join-Path $Root "backend\.env.notebook.local"

function Import-DotEnv {
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
        if (-not (Get-Item "Env:$key" -ErrorAction SilentlyContinue)) {
            Set-Item -Path "Env:$key" -Value $val
        }
    }
}

Import-DotEnv $NotebookEnvFile
Import-DotEnv $EnvFile

if (-not $env:POSTGRES_PASSWORD) {
    Write-Host "POSTGRES_PASSWORD nao definido. Rode start-megabrain-notebook.ps1 ou defina em backend\.env.notebook.local" -ForegroundColor Red
    exit 1
}

Push-Location $ComposeDir
try {
    $composeArgs = @("compose", "-f", $ComposeFile, "--env-file", $NotebookEnvFile)
    if (Test-Path $EnvFile) {
        $composeArgs += @("--env-file", $EnvFile)
    }

    Write-Host "Aguardando Postgres..." -ForegroundColor Yellow
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        & docker @composeArgs exec -T postgres pg_isready -U megabrain -d megabrain 2>$null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) {
        Write-Host "Postgres nao ficou pronto a tempo." -ForegroundColor Red
        exit 1
    }

    Write-Host "Aplicando migrations..." -ForegroundColor Cyan
    & docker @composeArgs run --rm migrate
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Migrations OK." -ForegroundColor Green
} finally {
    Pop-Location
}
