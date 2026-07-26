$launchScript = Join-Path $PSScriptRoot 'launch.mjs'
& node $launchScript --route qwen-local @args
exit $LASTEXITCODE
