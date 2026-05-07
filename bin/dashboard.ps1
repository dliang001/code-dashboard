# Code Dashboard launcher.
# Idempotent: if the dashboard is already up on $Port, just open the browser.
# Otherwise, spawn a hidden node process and wait for it to bind, then open.
#
# This is the script that the desktop shortcut runs. Keep side effects minimal
# and never throw a visible window — the user clicked once and expects a tab,
# not a console flash.

param(
    [int]$Port = 7420,
    [string]$Root = ""
)

$ErrorActionPreference = "Stop"
$installDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$entry      = Join-Path $installDir "dist\index.js"

# Bypass any system HTTP proxy for our localhost calls; otherwise corporate
# proxy settings make every Invoke-WebRequest hang for the full timeout.
[System.Net.WebRequest]::DefaultWebProxy = New-Object System.Net.WebProxy

function Test-DashboardAlive {
    param([int]$P)
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$P/api/projects" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

if (-not (Test-Path $entry)) {
    # Friendly error path: pop a single message box rather than a console wall of red.
    Add-Type -AssemblyName PresentationFramework | Out-Null
    [System.Windows.MessageBox]::Show(
        "Dashboard not built yet. Open a terminal in $installDir and run: npm run build",
        "Code Dashboard",
        "OK",
        "Warning"
    ) | Out-Null
    exit 1
}

if (-not (Test-DashboardAlive -P $Port)) {
    # Build the argument list. The PS array is what we hand to Start-Process.
    $args = @($entry, "--port", "$Port")
    if ($Root -ne "") {
        $args += "--root"
        $args += $Root
    }
    Start-Process -FilePath "node" `
                  -ArgumentList $args `
                  -WindowStyle Hidden `
                  -WorkingDirectory $installDir | Out-Null

    # Poll until the API answers, but don't hang forever.
    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $deadline) {
        if (Test-DashboardAlive -P $Port) { break }
        Start-Sleep -Milliseconds 200
    }
    if (-not (Test-DashboardAlive -P $Port)) {
        Add-Type -AssemblyName PresentationFramework | Out-Null
        [System.Windows.MessageBox]::Show(
            "Dashboard failed to start on port $Port within 15s. Check $installDir manually.",
            "Code Dashboard",
            "OK",
            "Error"
        ) | Out-Null
        exit 1
    }
}

# Default browser handles ws:// and serves the SPA fine.
Start-Process "http://localhost:$Port/" | Out-Null
