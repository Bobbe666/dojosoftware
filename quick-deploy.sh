#!/bin/bash
# Quick Deploy - Automatisches Deployment ohne Prompts
# Verwendet automatische Commit-Message mit Timestamp

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
COMMIT_MSG="Auto-Deploy: Update vom $TIMESTAMP"

./deploy.sh "$COMMIT_MSG"
