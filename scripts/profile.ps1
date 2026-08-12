# PowerShell integration. From your clone, run this once to wire it into $PROFILE
# with the right absolute path:
#
#   Add-Content $PROFILE ". `"$(Resolve-Path .\scripts\profile.ps1)`""
#
# This shadows the npm-linked `rak` binary with a function, so scripts/<cmd>.ps1
# runs in your current session rather than a child process. Env vars are
# process-wide, so that is what lets `rak aws` set AWS_PROFILE for real: the
# binary spawns node, which spawns powershell, and a child can never modify its
# parent's environment.
#
# Scripts are invoked with & rather than dot-sourced: env changes still stick,
# but `exit` inside a script cannot take your session down with it, and script
# variables do not leak into your shell.
#
# Commands without a matching .ps1 are forwarded to Node as normal.

$global:RakRoot = Split-Path $PSScriptRoot -Parent

function rak {
    if ($args.Count) {
        $script = Join-Path $global:RakRoot "scripts\$($args[0]).ps1"
        if (Test-Path $script) {
            $rest = @($args | Select-Object -Skip 1)
            & $script @rest
            return
        }
    }
    node (Join-Path $global:RakRoot "cli.mjs") @args
}

function raws { rak aws @args }
