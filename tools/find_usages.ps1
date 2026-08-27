param(
  [Parameter(Position = 0)]
  [string]$Symbol
)

if ([string]::IsNullOrWhiteSpace($Symbol)) {
  Write-Host "Uso: .\tools\find_usages.ps1 <simbolo>"
  Write-Host "Busca referencias por palavra inteira e exibe resultados compactos por arquivo."
  exit 1
}

$ErrorActionPreference = "Stop"
$root = (Resolve-Path ".").Path
$preferredRoots = @("src", "app", "components", "lib", "hooks", "scripts", "supabase", "migrations", "docs")
$searchRoots = @()

foreach ($candidate in $preferredRoots) {
  if (Test-Path -LiteralPath (Join-Path $root $candidate)) {
    $searchRoots += $candidate
  }
}

if ($searchRoots.Count -eq 0) {
  $searchRoots = @(".")
}

$globs = @(
  "--glob", "*.ts",
  "--glob", "*.tsx",
  "--glob", "*.js",
  "--glob", "*.mjs",
  "--glob", "*.css",
  "--glob", "*.json",
  "--glob", "*.sql",
  "--glob", "*.md",
  "--glob", "!**/.git/**",
  "--glob", "!**/.next/**",
  "--glob", "!**/node_modules/**",
  "--glob", "!**/dist/**",
  "--glob", "!**/build/**",
  "--glob", "!**/coverage/**",
  "--glob", "!**/*.tsbuildinfo"
)

$results = rg --line-number --word-regexp --color never @globs -- $Symbol @searchRoots
$currentFile = $null

foreach ($line in $results) {
  if ($line -notmatch "^(.*?):(\d+):(.*)$") {
    continue
  }

  $file = $Matches[1]
  $lineNumber = $Matches[2]
  $snippet = $Matches[3].Trim()

  if ($file -ne $currentFile) {
    if ($null -ne $currentFile) {
      Write-Host ""
    }
    Write-Host $file
    $currentFile = $file
  }

  Write-Host ("  {0}: {1}" -f $lineNumber, $snippet)
}
