#!/bin/bash

echo "Generating markdown..."
./scripts/generateDeploymentMarkdown.js
echo "Cloning repo..."
git clone git@github.com:pooltogether/documentation.git gitbook
cd gitbook
cp ../Networks.md networks.md
git add networks.md
git commit -m "Updated networks.md"
echo "Pushing changes..."
git push
cd ..
rm -rf gitbook