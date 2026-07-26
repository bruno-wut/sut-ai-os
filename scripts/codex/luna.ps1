$launchScript = Join-Path $PSScriptRoot 'launch.mjs'
& node $launchScript --route luna @args
exit $LASTEXITCODE
