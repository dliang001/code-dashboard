# Sends a graceful shutdown request to a running Code Dashboard.
# Used by the optional "Stop Dashboard" desktop shortcut for cases when
# the UI is unresponsive and the user can't click the in-app close button.
#
# Idempotent: if nothing is listening, prints a friendly note and exits 0.

param(
    [int]$Port = 7420
)

$ErrorActionPreference = "Stop"

# Bypass any system HTTP proxy for localhost calls — corporate proxy settings
# can otherwise hang every Invoke-WebRequest for the full timeout.
[System.Net.WebRequest]::DefaultWebProxy = New-Object System.Net.WebProxy

function Test-DashboardAlive {
    param([int]$P)
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$P/api/projects" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

if (-not (Test-DashboardAlive -P $Port)) {
    Add-Type -AssemblyName PresentationFramework | Out-Null
    [System.Windows.MessageBox]::Show(
        "Dashboard is not running on port $Port.",
        "Stop Code Dashboard",
        "OK",
        "Information"
    ) | Out-Null
    exit 0
}

try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/admin/shutdown" `
                      -Method Post -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop | Out-Null
} catch {
    # Connection drop is expected — the server kills itself before fully replying.
}

# Give the OS a beat to release the port; not strictly needed but makes the
# follow-up "did it really stop?" check meaningful.
Start-Sleep -Milliseconds 800

if (Test-DashboardAlive -P $Port) {
    Add-Type -AssemblyName PresentationFramework | Out-Null
    [System.Windows.MessageBox]::Show(
        "Shutdown request sent but the dashboard is still responding on port $Port. Check Task Manager.",
        "Stop Code Dashboard",
        "OK",
        "Warning"
    ) | Out-Null
    exit 1
}
