param(
  [Parameter(Position = 0)]
  [string]$Ref
)

$ErrorActionPreference = "Stop"

git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Este diretorio nao parece ser um repositorio git."
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Ref)) {
  $files = git diff --name-only HEAD
} else {
  $files = git diff --name-only $Ref
}

$ignored = '(^|/)(\.git|\.next|node_modules|dist|build|coverage)(/|$)|\.tsbuildinfo$'
$filtered = @($files | Where-Object { $_ -and ($_ -notmatch $ignored) })

foreach ($file in $filtered) {
  Write-Host $file
}

Write-Host ""
Write-Host ("Total: {0} arquivo(s)" -f $filtered.Count)
