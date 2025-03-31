#!/usr/bin/env bash
set -euo pipefail

BUMP_TYPE=${1:-patch}
DRY_RUN=${2:-false}

if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major|prepatch)$ ]]; then
  echo "Usage: ./release.sh [patch|minor|major|prepatch] [true|false]"
  exit 1
fi

# Colors
bold=$(tput bold)
green=$(tput setaf 2)
yellow=$(tput setaf 3)
red=$(tput setaf 1)
gray=$(tput setaf 7)
reset=$(tput sgr0)

# Make sure semver is available
if ! npx semver &>/dev/null; then
  echo "${red}Error:${reset} 'semver' is not installed. Run: npm install semver"
  exit 1
fi

echo "${bold}${gray}→ Checking out 'develop'...${reset}"
git checkout develop >/dev/null
git pull origin develop >/dev/null
git fetch origin --tags >/dev/null

# Get last tag
LAST_TAG=$(git tag --sort=-creatordate | head -n 1 || true)

if [[ -z "$LAST_TAG" ]]; then
  echo "${yellow}No previous tags found. Showing full history.${reset}"
  LOG_RANGE="--all"
else
  echo "${yellow}Showing commits since last tag: $LAST_TAG${reset}"
  LOG_RANGE="$LAST_TAG..HEAD"
fi

echo "${gray}----------------------------------------${reset}"
git log $LOG_RANGE --pretty=format:"- %h %s (%cd by %an)" --no-merges --date=short
echo "${gray}----------------------------------------${reset}"

# Read current version
CURRENT_VERSION=$(jq -r '.version' package.json)
echo "${bold}Current version: v$CURRENT_VERSION${reset}"
echo "${bold}Requested bump:  $BUMP_TYPE${reset}"

# Find next available version
NEXT_VERSION=$CURRENT_VERSION
while true; do
  NEXT_VERSION=$(npx semver "$NEXT_VERSION" -i "$BUMP_TYPE")
  if ! git ls-remote --tags origin | grep -q "refs/tags/v$NEXT_VERSION"; then
    break
  fi
done

echo "${green}Next available version: v$NEXT_VERSION${reset}"

if [[ "$DRY_RUN" == "true" ]]; then
  echo
  echo "${yellow}⚠️  Dry run mode — nothing will be changed or pushed.${reset}"
  exit 0
fi

read -rp "Do you want to bump to v$NEXT_VERSION and push it? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" ]]; then
  echo "${red}Aborted.${reset}"
  exit 1
fi

# Apply version bump and tag
npm version "$NEXT_VERSION" --no-git-tag-version
git commit -am "chore(release): v$NEXT_VERSION"
git tag "v$NEXT_VERSION"

# Push
git push origin develop
git push origin --tags

echo
echo "${green}✅ Tagged and pushed version v$NEXT_VERSION!${reset}"
