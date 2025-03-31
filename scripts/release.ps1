param (
  [Parameter(Position = 0)]
  [ValidateSet("patch", "minor", "major", "prepatch")]
  [string]$Bump = "patch",

  [switch]$DryRun
)

function Write-Color($Text, $Color = "Gray") {
  $prev = $Host.UI.RawUI.ForegroundColor
  $Host.UI.RawUI.ForegroundColor = $Color
  Write-Output $Text
  $Host.UI.RawUI.ForegroundColor = $prev
}

# Ensure we're on develop
Write-Color "Checking out 'develop'..." "Cyan"
git checkout develop | Out-Null
git pull origin develop | Out-Null
git fetch origin --tags | Out-Null

# Get last tag (if any)
$lastTag = git tag --sort=-creatordate | Select-Object -First 1

if (-not $lastTag) {
  Write-Color "No previous tags found. Showing full commit history." Yellow
  $logRange = "--all"
} else {
  Write-Color "Showing commits since last tag: $lastTag" Yellow
  $logRange = "$lastTag..HEAD"
}

Write-Color "`n----------------------------------------" DarkGray
git log $logRange --pretty=format:"- %h %s (%cd by %an)" --no-merges --date=short
Write-Color "----------------------------------------`n" DarkGray

# Show current version and calculate next
$currentVersion = (Get-Content ./package.json | ConvertFrom-Json).version
Write-Color "Current version: v$currentVersion" "Cyan"
Write-Color "Requested bump:  $Bump" "Cyan"

if ($DryRun) {
  Write-Color "`n⚠️  DRY RUN MODE — nothing will be changed or pushed." Yellow
  exit 0
}

# Confirm release
$confirm = Read-Host "`nDo you want to continue with 'npm version $Bump'? (y/n)"
if ($confirm -ne "y") {
  Write-Color "Aborted." Red
  exit 1
}

# Bump version and tag
npm version $Bump | Out-Null
$newVersion = (Get-Content ./package.json | ConvertFrom-Json).version

# Push
git push origin develop
git push origin --tags

Write-Color "`n✅ Tagged and pushed version v$newVersion!" Green
