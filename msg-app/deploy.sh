#!/bin/bash
# Deploy Dojo MSG App to msg.dojo.tda-intl.org
set -e

echo "Building..."
npm run build

echo "Deploying..."
rsync -az --delete dist/ \
  -e "ssh -p 2222 -i ~/.ssh/id_ed25519_dojo_deploy" \
  root@dojo.tda-intl.org:/var/www/msg-app/

echo "✓ Deployed to https://msg.dojo.tda-intl.org"
