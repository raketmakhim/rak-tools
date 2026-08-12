# Lists AWS profiles, SSO-logs into the one you pick, and sets AWS_PROFILE.
#
# Windows/PowerShell only. Requires the AWS CLI on PATH.
#
# Run it as `rak aws` (or `raws`) with scripts/profile.ps1 loaded from your
# $PROFILE, so it runs in your session and AWS_PROFILE sticks. Via the bare `rak`
# binary it is a child process and cannot set anything in your shell.

param([string]$Name)

# cli.mjs sets RAK_CHILD when it spawns us as a child process, where an $env:
# assignment dies with the process. Via the shell integration it is unset and we
# are running in the caller's own session, so the assignment sticks.
$inSession = -not $env:RAK_CHILD

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "AWS CLI not found on PATH"
    return
}

$profiles = @(aws configure list-profiles | Sort-Object)

if (-not $profiles) {
    Write-Host "No AWS profiles configured. Run 'aws configure sso' first."
    return
}

if ($Name) {
    $selected = $profiles | Where-Object { $_ -eq $Name }
    if (-not $selected) {
        Write-Host "No such profile: $Name"
        Write-Host "Available: $($profiles -join ', ')"
        return
    }
} else {
    for ($i = 0; $i -lt $profiles.Count; $i++) {
        Write-Host "[$i] $($profiles[$i])"
    }

    $choice = Read-Host "Pick a profile number"

    if ($choice -notmatch '^\d+$' -or [int]$choice -ge $profiles.Count) {
        Write-Host "Invalid selection"
        return
    }
    $selected = $profiles[[int]$choice]
}

# Skip the SSO round-trip when the profile already has a working cached token.
# Profiles sharing an sso-session share the token, so switching between them
# usually needs no login at all.
aws sts get-caller-identity --profile $selected --output text 1>$null 2>$null
$loggedIn = $LASTEXITCODE -eq 0

if ($loggedIn) {
    Write-Host "$selected already has valid credentials, skipping login"
} else {
    aws sso login --profile $selected
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Login failed for $selected, AWS_PROFILE unchanged"
        return
    }
}

$env:AWS_PROFILE = $selected

if ($inSession) {
    Write-Host "AWS_PROFILE set to $selected"
} else {
    # The SSO token cache on disk still benefits from this run, the env var does not.
    Write-Host "$selected is logged in, but AWS_PROFILE was set in a child process only."
    Write-Host "Use 'raws' instead of 'rak aws' to set it in this shell."
}
