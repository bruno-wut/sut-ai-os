$launchScript = Join-Path $PSScriptRoot 'launch.mjs'
& node $launchScript --route sol @args
exit $LASTEXITCODE
