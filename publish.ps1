# One-time setup: makes this folder a git repo, creates the GitHub repo, and turns on GitHub Pages.
# Run from this folder in PowerShell:   powershell -ExecutionPolicy Bypass -File .\publish.ps1
# Needs Git (https://git-scm.com) and the GitHub CLI (winget install GitHub.cli).
# 'Continue' on purpose: Windows PowerShell 5 treats a tool's error text as fatal under 'Stop',
# and the 'does the repo exist yet?' check is expected to print an error the first time.
$ErrorActionPreference = 'Continue'
function Fail($msg) { Write-Host $msg -ForegroundColor Red; exit 1 }
Set-Location $PSScriptRoot
$repo = 'emberwake'

foreach ($tool in 'git', 'gh') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Write-Host "Missing '$tool'. Install it, open a new terminal, and run this again." -ForegroundColor Red; exit 1 }
}
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'Signing in to GitHub...'; gh auth login --web --git-protocol https }

if (-not (Test-Path .git)) { git init -b main | Out-Null }
git config core.autocrlf false
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m 'Emberwake: first-person adventure with co-op' | Out-Null }

$owner = (gh api user --jq .login).Trim()
gh repo view "$owner/$repo" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  gh repo create $repo --public --source . --remote origin --push --description 'First-person retro adventure with 1-4 player co-op'
  if ($LASTEXITCODE -ne 0) { Fail 'Could not create the GitHub repo. See the message above.' }
} else {
  if (-not (git remote 2>$null | Select-String -Quiet '^origin$')) { git remote add origin "https://github.com/$owner/$repo.git" }
  git push -u origin main
  if ($LASTEXITCODE -ne 0) { Fail 'Could not push to GitHub. See the message above.' }
}

gh api "repos/$owner/$repo/pages" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  gh api -X POST "repos/$owner/$repo/pages" -f 'source[branch]=main' -f 'source[path]=/' | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "Repo is up, but turning on Pages failed. Do it by hand: https://github.com/$owner/$repo/settings/pages (Branch: main, folder: / root)." }
}

$url = "https://$owner.github.io/$repo/"
Write-Host ''
Write-Host "Repo:  https://github.com/$owner/$repo" -ForegroundColor Green
Write-Host "Game:  $url   (first deploy takes about a minute)" -ForegroundColor Green
Write-Host 'To publish later changes: python build.py, then git add -A; git commit -m "update"; git push'
