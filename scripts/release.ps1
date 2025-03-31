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

# Ensure clean develop branch
Write-Color "Checking out 'develop'..." Cyan
git checkout develop | Out-Null
git pull origin develop | Out-Null
git fetch origin --tags | Out-Null

# Get latest tag
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

# Determine next available version
$currentVersion = (Get-Content ./package.json | ConvertFrom-Json).version
Write-Color "Current version: v$currentVersion" Cyan
Write-Color "Requested bump:  $Bump" Cyan

# Use semver bumping in a loop to find the next unused tag
$nextVersion = $currentVersion
do {
  $nextVersion = node -p "require('semver').inc('$nextVersion', '$Bump')"
  $remoteTag = git ls-remote --tags origin | Select-String "refs/tags/v$nextVersion"
} while ($remoteTag)

Write-Color "Next available version: v$nextVersion" Cyan

if ($DryRun) {
  Write-Color "`n⚠️  DRY RUN MODE — nothing will be changed or pushed." Yellow
  exit 0
}

# Confirm
$confirm = Read-Host "`nDo you want to bump to v$nextVersion and push it? (y/n)"
if ($confirm -ne "y") {
  Write-Color "Aborted." Red
  exit 1
}

# Apply the version bump
npm version $nextVersion --no-git-tag-version
git commit -am "chore(release): v$nextVersion"
git tag v$nextVersion

# Push!
git push origin develop
git push origin --tags

Write-Color "`n✅ Tagged and pushed version v$nextVersion!" Green
