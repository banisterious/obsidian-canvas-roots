#!/bin/bash
# Upload wiki content to GitHub wiki

set -e

echo "📚 Canvas Roots Wiki Upload Script"
echo "==================================="
echo ""

# Check if wiki-content directory exists
if [ ! -d "wiki-content" ]; then
    echo "❌ Error: wiki-content directory not found"
    exit 1
fi

# Clone the wiki repository
echo "📥 Cloning wiki repository..."
cd /tmp
rm -rf obsidian-canvas-roots.wiki
git clone git@github.com:banisterious/obsidian-canvas-roots.wiki.git

# Check if clone was successful
if [ ! -d "obsidian-canvas-roots.wiki" ]; then
    echo "❌ Error: Failed to clone wiki repository"
    echo "   Make sure the wiki has been initialized on GitHub"
    echo "   (Create at least one page via the GitHub web interface first)"
    exit 1
fi

# Copy all wiki content
echo "📝 Copying wiki content..."
cd obsidian-canvas-roots.wiki
cp -r /home/fitz/projects/obsidian-plugins/canvas-roots/wiki-content/* .

# Commit and push
echo "🚀 Uploading to GitHub..."
git add .
git commit -m "Update wiki content"
git push origin master

echo ""
echo "✅ Wiki upload complete!"
echo "📖 View at: https://github.com/banisterious/obsidian-canvas-roots/wiki"
echo ""

# Cleanup
cd /home/fitz/projects/obsidian-plugins/canvas-roots
echo "🧹 Cleanup complete"
