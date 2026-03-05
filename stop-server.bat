@echo off
setlocal
TITLE Stop TalkBetter.ai Server
echo Stopping TalkBetter.ai Server on port 3000...

:: Find PID of process listening on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    set PID=%%a
)

if defined PID (
    echo Found TalkBetter.ai on port 3000 (PID: %PID%)...
    taskkill /F /PID %PID%
    echo.
    echo Server stopped successfully.
) else (
    echo.
    echo Error: No server found running on port 3000.
)

echo.
pause
