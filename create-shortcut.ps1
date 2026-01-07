# Create GMCT Management System Desktop Shortcut
# Run this script as Administrator or right-click and select "Run with PowerShell"

$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\GMCT Management.lnk")
$Shortcut.TargetPath = "https://management.gmct-ca.org"
$Shortcut.Description = "GMCT Management System"
$Shortcut.Save()

Write-Host "✓ Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "You can now access GMCT Management System from your desktop."
