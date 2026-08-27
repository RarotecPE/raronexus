param(
  [Parameter(Position = 0)]
  [string]$Path
)

if ([string]::IsNullOrWhiteSpace($Path)) {
  Write-Host "Uso: .\tools\summarize_file.ps1 <caminho-do-arquivo>"
  Write-Host "Mostra as primeiras 40 linhas, ultimas 20 linhas e total de linhas."
  exit 1
}

if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
  Write-Host "Arquivo nao encontrado: $Path"
  exit 1
}

$lines = Get-Content -LiteralPath $Path
$total = $lines.Count

Write-Host ("Arquivo: {0}" -f $Path)
Write-Host ("Total de linhas: {0}" -f $total)
Write-Host ""
Write-Host "===== TOPO: primeiras 40 linhas ====="
$lines | Select-Object -First 40

Write-Host ""
Write-Host "===== FIM: ultimas 20 linhas ====="
if ($total -gt 40) {
  $lines | Select-Object -Last 20
} else {
  Write-Host "(arquivo ja exibido integralmente acima)"
}
