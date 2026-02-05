$ErrorActionPreference = "Stop"

# Optional local-only configuration (ignored by git)
$localConfig = Join-Path $PSScriptRoot "start-backend.local.ps1"
if (Test-Path $localConfig) {
	. $localConfig
}

# Safe defaults (no secrets in repository)
if (-not $env:USE_POSTGRES) { $env:USE_POSTGRES = "0" }
if (-not $env:FRONTEND_REDIRECT_URL) { $env:FRONTEND_REDIRECT_URL = "http://127.0.0.1:3000/#home" }

if (-not (Get-Command python.exe -ErrorAction SilentlyContinue)) {
	# Fallback to explicit path if python not on PATH
	& "C:/Users/Konrad/AppData/Local/Programs/Python/Python313/python.exe" manage.py runserver 8000
} else {
	python.exe manage.py runserver 8000
}
