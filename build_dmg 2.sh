#!/bin/bash

# Script to package serveMyAPI into a DMG for easy distribution
# This creates a proper macOS app bundle with menu bar integration

# Configuration
APP_NAME="serveMyAPI"
VERSION="1.0.0"
BUILD_DIR="build"
RELEASE_DIR="$BUILD_DIR/release"
APP_DIR="$RELEASE_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

# Ensure script exits on error
set -e

echo "Building $APP_NAME v$VERSION DMG..."

# Create necessary directories
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# Create Info.plist file for the app
cat > "$CONTENTS_DIR/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>run.sh</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.newmodel.$APP_NAME</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.utilities</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2025 James King. All rights reserved.</string>
</dict>
</plist>
EOF

# Create launcher script
cat > "$MACOS_DIR/run.sh" << EOF
#!/bin/bash
cd "\$(dirname "\$0")/../Resources"
./node main.js
EOF

# Make it executable
chmod +x "$MACOS_DIR/run.sh"

# Copy Node.js executable
cp "$(which node)" "$RESOURCES_DIR/"

# Copy application files
cp -R *.js package.json package-lock.json "$RESOURCES_DIR/"
mkdir -p "$RESOURCES_DIR/node_modules"
cp -R node_modules/* "$RESOURCES_DIR/node_modules/"

# Create README for installation
cat > "$RESOURCES_DIR/README.txt" << EOF
serveMyAPI
==========

This application provides system services for myKYCpal.
It runs in the background as a menu bar application.

For more information, visit: https://newmodel.vc
EOF

# Create DMG
DMG_PATH="$RELEASE_DIR/$APP_NAME-$VERSION.dmg"
echo "Creating DMG at $DMG_PATH..."

# Create temporary directory for DMG contents
DMG_TEMP="$RELEASE_DIR/dmg_temp"
mkdir -p "$DMG_TEMP"

# Copy app to DMG temp folder
cp -R "$APP_DIR" "$DMG_TEMP/"

# Create symlink to Applications folder
ln -s /Applications "$DMG_TEMP/Applications"

# Create DMG
hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_TEMP" -ov -format UDZO "$DMG_PATH"

# Clean up
rm -rf "$DMG_TEMP"

echo "Build completed successfully!"
echo "DMG file created at: $DMG_PATH"