#!/bin/bash
# DojoSoftware Frontend Deployment
# Run this from the dojosoftware directory

set -e

echo "=== DojoSoftware Frontend Deployment ==="

# 1. Build frontend
echo "[1/3] Building frontend..."
cd frontend
npm run build
cd ..

# 2. Upload to server
echo "[2/3] Uploading to server..."
scp -r frontend/dist/* dojo.tda-intl.org:/root/dojosoftware/frontend/dist/

# 3. Run server-side deployment (fixes nginx symlinks!)
echo "[3/3] Running server deployment..."
ssh dojo.tda-intl.org "/root/deploy-dojo-frontend.sh"

echo ""
echo "✅ Frontend deployed successfully!"
