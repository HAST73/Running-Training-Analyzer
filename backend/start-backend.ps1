$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "Initializing environment..." -ForegroundColor Cyan

# Force SQLite by default so a stale USE_POSTGRES=1 in the current shell
# cannot accidentally enable PostgreSQL.
$env:USE_POSTGRES = "0"

if (-not $env:FRONTEND_REDIRECT_URL) {
    $env:FRONTEND_REDIRECT_URL = "http://127.0.0.1:3000/#home"
}

$localConfig = Join-Path $PSScriptRoot "start-backend.local.ps1"
if (Test-Path $localConfig) {
    Write-Host "Additional file $localConfig found - loading overridden values..." -ForegroundColor Yellow
    . $localConfig
}

if ($env:USE_POSTGRES -eq "1") {
    if (-not $env:POSTGRES_HOST) { $env:POSTGRES_HOST = "localhost" }
    if (-not $env:POSTGRES_PORT) { $env:POSTGRES_PORT = "5432" }
    if (-not $env:POSTGRES_DB) { $env:POSTGRES_DB = "running_db" }
    if (-not $env:POSTGRES_USER) { $env:POSTGRES_USER = "postgres" }
}

function Set-LocalEnvVar {
    param(
        [string]$Path,
        [string]$Name,
        [string]$Value
    )

    if (-not (Test-Path $Path)) {
        New-Item -Path $Path -ItemType File -Force | Out-Null
    }

    $content = Get-Content -Path $Path -Raw
    $escaped = $Value.Replace('"', '`"')
    $line = '$env:' + $Name + ' = "' + $escaped + '"'
    $pattern = '(?m)^\s*\$env:' + [regex]::Escape($Name) + '\s*=.*$'

    if ([regex]::IsMatch($content, $pattern)) {
        $content = [regex]::Replace($content, $pattern, $line, 1)
    } else {
        if ($content -and -not $content.EndsWith("`n")) {
            $content += "`r`n"
        }
        $content += $line + "`r`n"
    }

    Set-Content -Path $Path -Value $content -Encoding UTF8
}

if (-not $env:STRAVA_CLIENT_ID -or -not $env:STRAVA_CLIENT_SECRET) {
    Write-Host "Strava credentials are not set." -ForegroundColor Yellow
    $answer = Read-Host "Configure STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET now and save to start-backend.local.ps1? (y/N)"
    if ($answer -match '^(y|yes|t|tak)$') {
        $enteredClientId = Read-Host "STRAVA_CLIENT_ID"
        $enteredClientSecret = Read-Host "STRAVA_CLIENT_SECRET"

        if ($enteredClientId -and $enteredClientSecret) {
            $env:STRAVA_CLIENT_ID = $enteredClientId
            $env:STRAVA_CLIENT_SECRET = $enteredClientSecret
            Set-LocalEnvVar -Path $localConfig -Name "STRAVA_CLIENT_ID" -Value $enteredClientId
            Set-LocalEnvVar -Path $localConfig -Name "STRAVA_CLIENT_SECRET" -Value $enteredClientSecret
            Write-Host "Strava credentials saved to start-backend.local.ps1." -ForegroundColor Green
        } else {
            Write-Host "Strava credentials not provided - Strava login will return STRAVA_CLIENT_ID not set." -ForegroundColor Yellow
        }
    }
}

if ($env:USE_POSTGRES -eq "1" -and -not $env:POSTGRES_PASSWORD) {
    Write-Host "PostgreSQL password is not set." -ForegroundColor Yellow
    $enteredPgPassword = Read-Host "Enter POSTGRES_PASSWORD now (leave empty to skip)"
    if ($enteredPgPassword) {
        $env:POSTGRES_PASSWORD = $enteredPgPassword
        Set-LocalEnvVar -Path $localConfig -Name "POSTGRES_PASSWORD" -Value $enteredPgPassword
        Write-Host "POSTGRES_PASSWORD saved to start-backend.local.ps1." -ForegroundColor Green
    } else {
        Write-Host "POSTGRES_PASSWORD not provided - PostgreSQL connection will fail." -ForegroundColor Yellow
    }
}

if (-not (Get-Command python.exe -ErrorAction SilentlyContinue)) {
    $fallbackPython = "C:/Users/Konrad/AppData/Local/Programs/Python/Python313/python.exe"
    if (Test-Path $fallbackPython) {
        $pythonCmd = $fallbackPython
    } else {
        Write-Error "Python not found in PATH or fallback path."
    }
} else {
    $pythonCmd = "python.exe"
}

Write-Host "Applying migrations..." -ForegroundColor Cyan
if ($env:USE_POSTGRES -eq "1") {
    Write-Host "Database mode: PostgreSQL ($($env:POSTGRES_USER)@$($env:POSTGRES_HOST):$($env:POSTGRES_PORT)/$($env:POSTGRES_DB))" -ForegroundColor Cyan

    # Ensure target PostgreSQL database exists before running Django migrations.
    $ensureDbCode = @'
import os
import psycopg
from psycopg import sql

host = os.environ.get("POSTGRES_HOST", "localhost")
port = os.environ.get("POSTGRES_PORT", "5432")
user = os.environ.get("POSTGRES_USER", "postgres")
password = os.environ.get("POSTGRES_PASSWORD", "")
target_db = os.environ.get("POSTGRES_DB", "running_db")

conn = psycopg.connect(
    dbname="postgres",
    user=user,
    password=password,
    host=host,
    port=port,
)
conn.autocommit = True

with conn.cursor() as cur:
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target_db,))
    exists = cur.fetchone() is not None
    if exists:
        print(f"Database already exists: {target_db}")
    else:
        cur.execute(sql.SQL("CREATE DATABASE {}" ).format(sql.Identifier(target_db)))
        print(f"Created database: {target_db}")

conn.close()
'@

    $ensureDbScriptPath = Join-Path $env:TEMP "ensure_pg_db.py"
    Set-Content -Path $ensureDbScriptPath -Value $ensureDbCode -Encoding UTF8
    & $pythonCmd $ensureDbScriptPath
    Remove-Item -Path $ensureDbScriptPath -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to verify/create PostgreSQL database '$($env:POSTGRES_DB)'. Check PostgreSQL credentials and privileges in start-backend.local.ps1."
    }
} else {
    Write-Host "Database mode: SQLite" -ForegroundColor Cyan
}
& $pythonCmd manage.py migrate --noinput
if ($LASTEXITCODE -ne 0) {
    Write-Error "Migrations failed. Backend not started. Check PostgreSQL credentials in start-backend.local.ps1."
}

Write-Host "Starting Django server..." -ForegroundColor Green

& $pythonCmd manage.py runserver 8000