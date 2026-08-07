$base = Join-Path $PSScriptRoot 'run-loadtest.ps1'
& $base -RunId baseline -Port 3100 -BuildDir 'C:\Users\Kovarsta\Documents\GitHub\vlu-task-management-baseline' -UseProxyHeader
exit $LASTEXITCODE
