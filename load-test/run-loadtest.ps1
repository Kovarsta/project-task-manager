param(
	[Parameter(Mandatory)][string]$RunId,
	[Parameter(Mandatory)][int]$Port,
	[string]$BuildDir,
	[switch]$UseRedis,
	[string]$RedisUrl = 'redis://localhost:6379',
	[int]$RateLimitMax = -1,
	[switch]$UseProxyHeader,
	[string[]]$Scenarios = @('browse', 'search', 'abuse')
)
$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
if (-not $BuildDir) { $BuildDir = $root }
$results = Join-Path $PSScriptRoot 'results'
New-Item -ItemType Directory -Force -Path $results | Out-Null

$k6Cmd = Get-Command k6 -ErrorAction SilentlyContinue
$k6Path = if ($k6Cmd) { $k6Cmd.Source } else {
	$candidates = @("$env:ProgramFiles\k6\k6.exe", "$env:LOCALAPPDATA\Microsoft\WinGet\Links\k6.exe")
	$candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $k6Path) { Write-Host 'k6 not found. Install: winget install GrafanaLabs.k6'; exit 1 }

Push-Location $root

# Session JWTs are generated (not committed); mint them if missing
$tokensFile = Join-Path $PSScriptRoot 'tokens.js'
if (-not (Test-Path -LiteralPath $tokensFile)) {
	Write-Host 'tokens.js missing — minting session tokens...'
	node 'load-test/mint-tokens.mjs' 'user1000@demo.local,user1001@demo.local,user2000@demo.local,user2500@demo.local'
}

# Free port 3000 if the dockerized app is squatting on it
docker compose stop app *> $null

# Stop only app node processes (never blanket-kill node — opencode runs on node)
function Stop-AppNodes {
	Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
		Where-Object { $_.CommandLine -match '(^| )build( |$)' -and $_.CommandLine -notmatch 'opencode' } |
		ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
Stop-AppNodes
Start-Sleep 2

# --- build env ---
Get-Content (Join-Path $root '.env') | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
	$kv = $_ -split '=', 2
	[Environment]::SetEnvironmentVariable($kv[0].Trim(), $kv[1].Trim().Trim('"'), 'Process')
}
$env:PORT = "$Port"
$env:ORIGIN = "http://localhost:$Port"
$env:AUTH_URL = "http://localhost:$Port"
$env:AUTH_TRUST_HOST = 'true'
$env:USE_MOCK_SSO = 'true'
$env:HOST = '127.0.0.1'
$env:RATE_LIMIT_MAX = "$RateLimitMax"
if ($UseProxyHeader) {
	$env:ADDRESS_HEADER = 'x-forwarded-for'
	$env:XFF_DEPTH = '1'
} else {
	$env:ADDRESS_HEADER = ''
	$env:XFF_DEPTH = '1'
}
if ($UseRedis) { $env:REDIS_URL = $RedisUrl; $env:REDIS_ENABLED = 'true' }
else { $env:REDIS_URL = ''; $env:REDIS_ENABLED = 'false' }
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/projectmanager'
$env:DIRECT_URL = 'postgresql://postgres:postgres@localhost:5432/projectmanager'

# --- start app ---
$appOut = Join-Path $results "app-$RunId.log"
$appErr = Join-Path $results "app-$RunId.err.log"
$app = Start-Process -FilePath 'node' -ArgumentList 'build' -WorkingDirectory $BuildDir -RedirectStandardOutput $appOut -RedirectStandardError $appErr -WindowStyle Hidden -PassThru
Start-Sleep 5

$ready = $false
for ($i = 0; $i -lt 25; $i++) {
	try {
		Invoke-WebRequest -Uri "http://localhost:$Port/" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 5 -SkipHttpErrorCheck -ErrorAction SilentlyContinue | Out-Null
		$ready = $true
		break
	} catch { Start-Sleep 2 }
}
if (-not $ready) {
	Write-Host "FAILED to start app for $RunId on port $Port"
	Get-Content $appErr -Tail 30 -ErrorAction SilentlyContinue
	Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
	Pop-Location
	exit 1
}
Write-Host "App $RunId ready on :$Port (pid $($app.Id))"

# --- captures ---
npx tsx 'load-test/capture.mjs' "$RunId-pre"

# --- k6 ---
$env:RUN_ID = $RunId
$env:BASE_URL = "http://localhost:$Port"
foreach ($sc in $Scenarios) {
	$rawJson = Join-Path $results "$sc-$RunId.raw.json"
	$log = Join-Path $results "$sc-$RunId.log"
	Write-Host "k6 $sc ($RunId) ..."
	& $k6Path run --quiet --out json="$rawJson" "load-test/$sc.js" *> $log
	node 'load-test/summarize.mjs' $rawJson $RunId
	Remove-Item $rawJson -Force -ErrorAction SilentlyContinue
}

# --- captures ---
npx tsx 'load-test/capture.mjs' "$RunId-post"

# --- stop app ---
Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
Stop-AppNodes
Pop-Location
Write-Host "Done: $RunId"
