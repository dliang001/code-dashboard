# Create a "Code Dashboard" shortcut on the desktop and (optionally) in
# the Start Menu. The shortcut runs dashboard.ps1 with a hidden window so
# clicking it never flashes a console.

param(
    [string]$Name = "Code Dashboard",
    [int]$Port = 7420,
    [string]$Root = "",
    [switch]$StartMenu,
    [switch]$Autostart,
    [switch]$InstallStop
)

$ErrorActionPreference = "Stop"
$installDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$launcher   = Join-Path $installDir "bin\dashboard.ps1"
$stopper    = Join-Path $installDir "bin\stop-dashboard.ps1"

if (-not (Test-Path $launcher)) {
    throw "Cannot find launcher at $launcher"
}

# Args we pass to powershell.exe each time the user clicks the shortcut.
$psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`" -Port $Port"
if ($Root -ne "") {
    $psArgs += " -Root `"$Root`""
}
$stopArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$stopper`" -Port $Port"

function New-Shortcut {
    param(
        [string]$Path,
        [string]$Arguments,
        [int]$IconIndex,
        [string]$Description
    )
    $wsh = New-Object -ComObject WScript.Shell
    $sc = $wsh.CreateShortcut($Path)
    $sc.TargetPath       = "powershell.exe"
    $sc.Arguments        = $Arguments
    $sc.WorkingDirectory = $installDir
    $sc.IconLocation     = "$env:SystemRoot\System32\SHELL32.dll,$IconIndex"
    $sc.WindowStyle      = 7
    $sc.Description      = $Description
    $sc.Save()
}

function New-DashboardShortcut {
    param([string]$Path)
    New-Shortcut -Path $Path -Arguments $psArgs -IconIndex 138 -Description "Open Code Dashboard (port $Port)"
}

function New-StopShortcut {
    param([string]$Path)
    New-Shortcut -Path $Path -Arguments $stopArgs -IconIndex 131 -Description "Stop Code Dashboard (port $Port)"
}

# Desktop is always installed.
$desktop = [Environment]::GetFolderPath("Desktop")
$desktopLnk = Join-Path $desktop "$Name.lnk"
New-DashboardShortcut -Path $desktopLnk
Write-Host "Created desktop shortcut: $desktopLnk"

if ($StartMenu) {
    $startMenuDir = Join-Path ([Environment]::GetFolderPath("Programs")) "Code Dashboard"
    if (-not (Test-Path $startMenuDir)) { New-Item -ItemType Directory -Path $startMenuDir | Out-Null }
    $startMenuLnk = Join-Path $startMenuDir "$Name.lnk"
    New-DashboardShortcut -Path $startMenuLnk
    Write-Host "Created Start Menu shortcut: $startMenuLnk"
}

if ($Autostart) {
    $startupDir = [Environment]::GetFolderPath("Startup")
    $autostartLnk = Join-Path $startupDir "$Name.lnk"
    New-DashboardShortcut -Path $autostartLnk
    Write-Host "Created autostart shortcut: $autostartLnk  (dashboard will launch at login)"
}

if ($InstallStop) {
    $stopLnk = Join-Path $desktop "Stop $Name.lnk"
    New-StopShortcut -Path $stopLnk
    Write-Host "Created stop shortcut: $stopLnk"
}

Write-Host ""
Write-Host "Done. Double-click '$Name' on your desktop to open the dashboard."
Write-Host "Tip: right-click the icon -> 'Pin to taskbar' for one-click access."
Write-Host "To restart/stop: use the buttons in the dashboard top-right corner."
