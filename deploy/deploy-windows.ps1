# Deploy do Meta BI no Windows Server 2019 (Docker com containers Windows).
# Uso (PowerShell como Administrador, na pasta do projeto):
#   .\deploy\deploy-windows.ps1 -JwtSecret "uma-chave-longa-e-aleatoria"
param(
  [Parameter(Mandatory = $true)][string]$JwtSecret,
  [int]$Port = 3789,
  [string]$Image = 'meta-bi:latest',
  [string]$Container = 'meta-bi',
  [string]$Volume = 'meta-bi-data',
  [switch]$CookieSecure  # use somente quando o site estiver atrás de HTTPS
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host '==> Build da imagem' -ForegroundColor Cyan
docker build -f Dockerfile.windows -t $Image .
if ($LASTEXITCODE -ne 0) { throw 'Falha no docker build' }

if (-not (docker volume ls -q --filter "name=^$Volume$")) {
  docker volume create $Volume | Out-Null
}

if (docker ps -aq --filter "name=^$Container$") {
  Write-Host '==> Removendo container antigo' -ForegroundColor Cyan
  docker rm -f $Container | Out-Null
}

$secure = if ($CookieSecure) { 'true' } else { 'false' }

Write-Host '==> Subindo container' -ForegroundColor Cyan
docker run -d --name $Container --restart unless-stopped `
  -p "${Port}:3789" `
  -v "${Volume}:C:\app\data" `
  -e "NUXT_JWT_SECRET=$JwtSecret" `
  -e "NUXT_COOKIE_SECURE=$secure" `
  $Image
if ($LASTEXITCODE -ne 0) { throw 'Falha no docker run' }

if (-not (Get-NetFirewallRule -DisplayName "Meta BI $Port" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "Meta BI $Port" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null
}

Write-Host "==> Pronto: http://<IP-publico-da-EC2>:$Port" -ForegroundColor Green
docker ps --filter "name=^$Container$"
