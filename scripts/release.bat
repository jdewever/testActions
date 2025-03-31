@echo off
setlocal enabledelayedexpansion

:: Check for version bump type
if "%1"=="" (
    echo Usage: release.bat [patch^|minor^|major^|prepatch] [--dry-run]
    exit /b 1
)

set BUMP_TYPE=%1
set DRY_RUN=0

:: Check for --dry-run
if "%2"=="--dry-run" (
    set DRY_RUN=1
)

:: Ensure we're on develop
echo Checking out develop branch...
git checkout develop || exit /b 1
git pull origin develop
git fetch origin --tags

:: Show commits since last tag
for /f %%i in ('git describe --tags --abbrev=0') do set "LAST_TAG=%%i"
echo.
echo Showing commits since last tag: %LAST_TAG%
echo ----------------------------------------
git log %LAST_TAG%^..HEAD --pretty=format:"- %%h %%s (%%an)" --no-merges
echo ----------------------------------------

:: Confirm
if "%DRY_RUN%"=="1" (
    echo.
    echo ⚠️ Dry run mode enabled. No files will be changed or pushed.
    exit /b 0
)

set /p CONTINUE=Do you want to continue with "npm version %BUMP_TYPE%"? (y/n): 
if /i not "%CONTINUE%"=="y" (
    echo Aborted.
    exit /b 1
)

:: Run npm version
npm version %BUMP_TYPE% || exit /b 1

:: Get new version
for /f %%v in ('node -p "require('./package.json').version"') do set NEW_VERSION=%%v

:: Push
git push origin develop
git push origin --tags

echo.
echo ✅ Tagged and pushed version v%NEW_VERSION%!
