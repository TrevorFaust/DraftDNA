# Installs a pre-commit hook that runs gitleaks on staged files only.
# Usage (from repo root): powershell -ExecutionPolicy Bypass -File scripts/install-gitleaks-hook.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$hooksDir = Join-Path $repoRoot '.git\hooks'
$hookPath = Join-Path $hooksDir 'pre-commit'

if (-not (Test-Path $hooksDir)) {
  throw "Not a git repo (missing .git/hooks). Run from the project root."
}

# LF + UTF-8 without BOM — BOM breaks #!/bin/sh on Windows Git.
$hookContent = @"
#!/bin/sh
gitleaks protect --staged -v --redact
status=`$?
if [ `$status -ne 0 ]; then
  echo "gitleaks blocked the commit. Remove secrets or use placeholders in .env.example only."
fi
exit `$status
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($hookPath, $hookContent, $utf8NoBom)
Write-Host "Installed: $hookPath"
Write-Host "Requires Git for Windows (sh.exe). Test: git add <file> && git commit -m test"
