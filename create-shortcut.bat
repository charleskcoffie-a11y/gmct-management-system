@echo off
REM Create GMCT Management System Desktop Shortcut
REM This script creates a desktop shortcut for other users

setlocal enabledelayedexpansion

REM Create VBScript to handle shortcut creation
set "vbsfile=%temp%\create_shortcut.vbs"

(
echo Set oWS = WScript.CreateObject("WScript.Shell"^)
echo sLinkFile = oWS.SpecialFolders("Desktop"^) ^& "\GMCT Management.lnk"
echo Set oLink = oWS.CreateShortcut(sLinkFile^)
echo oLink.TargetPath = "https://management.gmct-ca.org"
echo oLink.Description = "GMCT Management System"
echo oLink.Save
) > !vbsfile!

cscript.exe !vbsfile!
del !vbsfile!

echo.
echo Desktop shortcut created successfully!
pause
