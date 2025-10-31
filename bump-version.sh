#!/bin/bash

# Get current timestamp as version
VERSION=$(date +%s)

# Update CSS and JS versions in index.html
sed -i "s/style\.css?v=[0-9]*/style.css?v=$VERSION/" index.html
sed -i "s/app\.js?v=[0-9]*/app.js?v=$VERSION/" index.html

echo "✓ Updated versions to v=$VERSION"
