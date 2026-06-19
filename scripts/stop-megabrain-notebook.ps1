$ErrorActionPreference = "Stop"
. "$PSScriptRoot\notebook-helpers.ps1"

Stop-NotebookTunnel

Push-Location $NotebookComposeDir
try {
    $composeArgs = Get-NotebookComposeArgs
    & docker @composeArgs down
} finally {
    Pop-Location
}

Write-Host "Mega Brain (notebook) parado." -ForegroundColor Yellow
