$launchScript = Join-Path $PSScriptRoot 'launch.mjs'
& node $launchScript --route terra @args
exit $LASTEXITCODE
