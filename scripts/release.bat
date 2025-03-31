@echo off
setlocal enabledelayedexpansion

:: Check args
if "%1"=="" (
    echo Usage: release.bat [patch^|minor^|major^|prepatch] [--dry-run]
    exit /b 1
)

set BUMP_TYPE=%1
set DRY_RUN=0

if "%2"=="--dry-run" (
    set DRY_RUN=1
)

:: Set colors
set "COLOR_RESET=\e[0m"
set "COLOR_BOLD=\e[1m"
set "COLOR_YELLOW=\e[33m"
set "COLOR_GREEN=\e[32m"
set "COLOR_BLUE=\e[36m"

:: Ensure develop is up to date
echo Checking out %COLOR_BOLD%develop%COLOR_RESET% branch...
git checkout develop >nul || exit /b 1
git pull origin develop >nul
git fetch origin --tags >nul

:: Get latest tag
set LAST_TAG=
for /f %%i in ('git tag --sort=-creatordate') do (
    if not defined LAST_TAG set "LAST_TAG=%%i"
)

echo.
if not defined LAST_TAG (
    echo No tags found. Showing full commit history.
    set "LOG_RANGE=--all"
) else (
    echo Showing commits since last tag: %COLOR_YELLOW%%LAST_TAG%%COLOR_RESET%
    set "LOG_RANGE=%LAST_TAG%^..HEAD"
)

echo ----------------------------------------
git log %LOG_RANGE% --pretty=format:"- %%C(auto)%%h%%Creset %%s %%C(dim)(%%cd by %%an)%%Creset" --no-merges --date=short
echo ----------------------------------------

:: Dry-run preview of new version
if "%DRY_RUN%"=="1" (
    echo.
    echo Would run: %COLOR_GREEN%npm version %BUMP_TYPE%%COLOR_RESET%
    for /f %%v in ('node -p "require('./package.json').version"') do set CUR_VERSION=%%v
    echo Current version: v%CUR_VERSION%
    echo.
    echo ⚠️  %COLOR_YELLOW%Dry run%COLOR_RESET% mode enabled. No files will be changed or pushed.
    exit /b 0
)

:: Confirm before tagging
set /p CONTINUE=Do you want to continue with "npm version %BUMP_TYPE%"? (y/n): 
if /i not "%CONTINUE%"=="y" (
    echo Aborted.
    exit /b 1
)

npm version %BUMP_TYPE% || exit /b 1

for /f %%v in ('node -p "require('./package.json').version"') do set NEW_VERSION=%%v

git push origin develop
git push origin --tags

echo.
echo %COLOR_GREEN%✅ Tagged and pushed version v%NEW_VERSION%!%COLOR_RESET%
