$base = Join-Path $PSScriptRoot 'run-loadtest.ps1'
& $base -RunId head-nocache -Port 3001 -BuildDir (Split-Path -Parent $PSScriptRoot) -RateLimitMax 0
exit $LASTEXITCODE
