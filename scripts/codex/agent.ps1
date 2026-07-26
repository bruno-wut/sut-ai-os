$launchScript = Join-Path $PSScriptRoot 'launch.mjs'
& node $launchScript --route auto @args
exit $LASTEXITCODE
