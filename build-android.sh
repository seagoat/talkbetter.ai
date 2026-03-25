#!/bin/bash
# Build script for Android
# This script temporarily removes the API route for static export, then restores it

set -e

echo "=== Building for Android ==="

# Save the API route content
echo "Backing up API route..."
if [ -d "app/api" ]; then
  cp -r app/api app_api_backup
  rm -rf app/api
  echo "API route backed up"
fi

# Build with static export
echo "Building with static export..."
export BUILD_TARGET=android
npm run build:android

# Restore the API route
echo "Restoring API route..."
if [ -d "app_api_backup" ]; then
  mkdir -p app/api
  cp -r app_api_backup/* app/api/
  rm -rf app_api_backup
  echo "API route restored"
fi

# Sync with Capacitor
echo "Syncing with Capacitor..."
npx cap sync android

# Open Android Studio
echo "Opening Android Studio..."
npx cap open android

echo "=== Android build complete ==="