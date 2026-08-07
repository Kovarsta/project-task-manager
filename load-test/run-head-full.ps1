$base = Join-Path $PSScriptRoot 'run-loadtest.ps1'
& $base -RunId head-full -Port 3000 -BuildDir (Split-Path -Parent $PSScriptRoot) -UseRedis -RateLimitMax 20000 -UseProxyHeader
exit $LASTEXITCODE
