# Mega Brain - servidor temporario no notebook (Windows)
# Abre o app em http://localhost:3080

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\notebook-helpers.ps1"

Write-Host ""
Write-Host "  Mega Brain - subindo servidor no notebook..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-DockerRunning)) {
    Write-Host "Docker Desktop parece parado. Abra o Docker Desktop e aguarde iniciar." -ForegroundColor Red
    exit 1
}

try {
    Start-NotebookStack

    Write-Host ""
    Write-Host "  Mega Brain no ar!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Neste computador:  $NotebookLocalUrl"
    Write-Host ""
    Write-Host "  Expor na internet (testes):  .\scripts\expose-megabrain-notebook.ps1"
    Write-Host "  Parar:                         .\scripts\stop-megabrain-notebook.ps1"
    Write-Host ""

    Start-Process $NotebookLocalUrl
} catch {
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
