@echo off
REM Build script for Android on Windows
REM This script temporarily removes the API route for static export, then restores it

echo === Building for Android ===

REM Backup API route
echo Backing up API route...
if exist "app\api" (
    if not exist "app_api_backup" mkdir app_api_backup
    xcopy "app\api" "app_api_backup\" /E /I /Y
    rmdir /S /Q "app\api"
    echo API route backed up
)

REM Build with static export
echo Building with static export...
set BUILD_TARGET=android
call npm run build:android
if errorlevel 1 (
    echo Build failed!
    goto restore
)

REM Sync with Capacitor
echo Syncing with Capacitor...
call npx cap sync android

REM Restore API route
:restore
echo Restoring API route...
if exist "app_api_backup" (
    if not exist "app\api" mkdir app\api
    xcopy "app_api_backup" "app\api\" /E /I /Y
    rmdir /S /Q "app_api_backup"
    echo API route restored
)

REM Open Android Studio
echo Opening Android Studio...
call npx cap open android

echo === Android build complete ===