# Localend Project Packaging Script
# This creates a clean ZIP file excluding node_modules and .next

$destination = "..\localend-clean.zip"

if (Test-Path $destination) {
    Remove-Item $destination -Force
    Write-Host "Removed existing $destination"
}

$items = @(
    "app",
    "components",
    "contexts",
    "data",
    "lib",
    "public",
    "services",
    "types",
    ".env.example",
    ".gitignore",
    "firestore.rules",
    "next.config.ts",
    "package.json",
    "package-lock.json",
    "postcss.config.mjs",
    "tsconfig.json",
    "README.md",
    "PROJECT_DOCUMENTATION.md"
)

Write-Host "Zipping project files (excluding node_modules, .next)..."
Compress-Archive -Path $items -DestinationPath $destination

Write-Host "Done! Created $destination"
Write-Host "File size: $((Get-Item $destination).Length / 1MB) MB"
