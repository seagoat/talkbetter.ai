@echo off
echo [*] Starting Next.js Static Export...
call npm run build --silent

echo [*] Syncing Capacitor Assets...
call npx cap sync

echo [*] Compiling Android APK...
cd android
call gradlew.bat assembleDebug

echo.
echo [SUCCESS] APK generated at:
echo %~dp0android\app\build\outputs\apk\debug\app-debug.apk
pause