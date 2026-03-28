#!/bin/bash
# Upload all media files to Cloudflare R2 bucket
# Usage: CLOUDFLARE_API_TOKEN=xxx VAULT_ROOT=path/to/vault ./upload-media.sh
#
# Reads R2 config from site-config.json in the vault root.
# Override with env vars: R2_BUCKET, CLOUDFLARE_ACCOUNT_ID

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Resolve vault root: VAULT_ROOT env var, or fall back to ../../ from script dir
if [ -n "$VAULT_ROOT" ]; then
  VAULT_DIR="$(cd "$VAULT_ROOT" && pwd)"
else
  VAULT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

CONFIG_FILE="$VAULT_DIR/site-config.json"
MEDIA_DIR="$VAULT_DIR/media"

# Read config from site-config.json if present
if [ -f "$CONFIG_FILE" ]; then
  CONFIG_BUCKET=$(python3 -c "import json; c=json.load(open('$CONFIG_FILE')); print(c.get('media',{}).get('r2Bucket',''))" 2>/dev/null)
  CONFIG_ACCOUNT=$(python3 -c "import json; c=json.load(open('$CONFIG_FILE')); print(c.get('media',{}).get('cloudflareAccountId',''))" 2>/dev/null)
fi

BUCKET="${R2_BUCKET:-${CONFIG_BUCKET}}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CONFIG_ACCOUNT}}"
API_TOKEN="${CLOUDFLARE_API_TOKEN}"

if [ -z "$BUCKET" ]; then
  echo "Error: R2 bucket not configured. Set R2_BUCKET env var or add media.r2Bucket to site-config.json"
  exit 1
fi

if [ -z "$ACCOUNT_ID" ]; then
  echo "Error: Cloudflare account ID not configured. Set CLOUDFLARE_ACCOUNT_ID env var or add media.cloudflareAccountId to site-config.json"
  exit 1
fi

if [ -z "$API_TOKEN" ]; then
  echo "Error: CLOUDFLARE_API_TOKEN not set"
  exit 1
fi

echo "Vault: $VAULT_DIR"
echo "Bucket: $BUCKET"
echo ""

count=0
errors=0

find "$MEDIA_DIR" -type f ! -name '_Media_Index.md' ! -name '.DS_Store' | while read -r file; do
  # Get path relative to media dir (e.g., "gravestones/CEM_Coenen_Roger.jpg")
  key="${file#$MEDIA_DIR/}"

  # Determine content type
  ext="${file##*.}"
  case "$ext" in
    jpg|jpeg) ct="image/jpeg" ;;
    png) ct="image/png" ;;
    gif) ct="image/gif" ;;
    webp) ct="image/webp" ;;
    pdf) ct="application/pdf" ;;
    *) ct="application/octet-stream" ;;
  esac

  echo "Uploading: $key"

  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/r2/buckets/$BUCKET/objects/$key" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: $ct" \
    --data-binary "@$file")

  if [ "$http_code" = "200" ]; then
    count=$((count + 1))
  else
    echo "  ERROR: HTTP $http_code for $key"
    errors=$((errors + 1))
  fi
done

echo ""
echo "Done. Uploaded files. Check output above for any errors."
