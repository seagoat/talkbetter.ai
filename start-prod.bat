@echo off
TITLE TalkBetter.ai Production Server
echo Preparing TalkBetter.ai for production...
E:
cd "E:\worksrc	alkbetter.ai"

echo [1/2] Building project...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error: Build failed. Please check the logs above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Starting production server...
npm run start
pause
