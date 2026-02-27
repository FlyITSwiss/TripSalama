@echo off
REM ============================================
REM TripSalama - Generate Android Release Keystore
REM ============================================

echo.
echo Generating Android release keystore for TripSalama...
echo.

cd /d "%~dp0..\android\app"

REM Check if keystore already exists
if exist release.keystore (
    echo [WARNING] release.keystore already exists!
    set /p OVERWRITE="Do you want to overwrite it? (y/N): "
    if /i not "%OVERWRITE%"=="y" (
        echo Aborted.
        exit /b 1
    )
    del release.keystore
)

REM Generate keystore
keytool -genkey -v ^
    -keystore release.keystore ^
    -alias tripsalama ^
    -keyalg RSA ^
    -keysize 2048 ^
    -validity 10000 ^
    -storepass tripsalama2026 ^
    -keypass tripsalama2026 ^
    -dname "CN=TripSalama, OU=Mobile, O=Stabilis IT, L=Geneva, ST=Geneva, C=CH"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Keystore generated successfully!
    echo Location: android\app\release.keystore
    echo.
    echo IMPORTANT:
    echo - Keep this file safe and backed up
    echo - Do NOT commit to git
    echo - You need this exact keystore to update the app on Play Store
    echo.
) else (
    echo.
    echo [ERROR] Failed to generate keystore.
    echo Make sure Java JDK is installed and keytool is in your PATH.
    echo.
)

pause
