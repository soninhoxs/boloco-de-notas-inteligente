# Mega Brain — expoe o servidor do notebook na internet (sem dominio)
# Uso: .\scripts\expose-megabrain-notebook.ps1
#
# Gera um link HTTPS publico (trycloudflare.com) para testes.
# Mantenha o notebook ligado e o Docker rodando enquanto compartilhar o link.

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\notebook-helpers.ps1"

Write-Host ""
Write-Host "  Mega Brain — exposicao publica para testes" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-DockerRunning)) {
    Write-Host "Docker Desktop parece parado. Abra o Docker Desktop e aguarde iniciar." -ForegroundColor Red
    exit 1
}

try {
    Start-NotebookStack

    if (-not (Wait-NotebookHealth)) {
        Write-Host "O app nao respondeu em $NotebookLocalUrl/health" -ForegroundColor Red
        Write-Host "Verifique: docker compose -f backend\docker\docker-compose.notebook.yml ps" -ForegroundColor Yellow
        exit 1
    }

    $publicUrl = Start-NotebookTunnel
    if (-not $publicUrl) {
        exit 1
    }

    $allowedOrigins = "$publicUrl,$NotebookLocalUrl"
    Set-NotebookPublicUrls -PublicUrl $publicUrl -AllowedOrigins $allowedOrigins

    Write-Host "Reiniciando API com URL publica (CORS / cookies)..." -ForegroundColor Yellow
    Invoke-NotebookCompose @("up", "-d", "--force-recreate", "api")

    if (-not (Wait-NotebookHealth)) {
        Write-Host "API reiniciada, aguardando health..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }

    Write-Host ""
    Write-Host "  Mega Brain publico para testes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Neste computador:  $NotebookLocalUrl"
    Write-Host "  Link publico:      $publicUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Compartilhe o link publico com quem for testar (celular, outra rede, etc.)."
    Write-Host "  A URL muda cada vez que voce roda este script de novo."
    Write-Host ""
    Write-Host "  Parar tudo:  .\scripts\stop-megabrain-notebook.ps1"
    Write-Host ""

    try {
        Set-Clipboard -Value $publicUrl
        Write-Host "  (Link copiado para a area de transferencia)" -ForegroundColor DarkGray
        Write-Host ""
    } catch { }

    Start-Process $publicUrl
} catch {
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
