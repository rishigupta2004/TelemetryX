#!/usr/bin/env bash
set -euo pipefail

# Required environment variables:
#   OCI_REGION
#   OCI_NAMESPACE
#   OCI_BUCKET
#   OCI_ACCESS_KEY_ID
#   OCI_SECRET_ACCESS_KEY
#
# Optional:
#   TARGET_DIR (default: /opt/telemetryx/data)
#   PREFIX (default: empty; example: telemetryx-prod/)

: "${OCI_REGION:?Set OCI_REGION (example: ap-mumbai-1)}"
: "${OCI_NAMESPACE:?Set OCI_NAMESPACE}"
: "${OCI_BUCKET:?Set OCI_BUCKET}"
: "${OCI_ACCESS_KEY_ID:?Set OCI_ACCESS_KEY_ID}"
: "${OCI_SECRET_ACCESS_KEY:?Set OCI_SECRET_ACCESS_KEY}"

TARGET_DIR="${TARGET_DIR:-/opt/telemetryx/data}"
PREFIX="${PREFIX:-}"
ENDPOINT="https://${OCI_NAMESPACE}.compat.objectstorage.${OCI_REGION}.oraclecloud.com"
S3_URI="s3://${OCI_BUCKET}/${PREFIX}"

export AWS_ACCESS_KEY_ID="${OCI_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${OCI_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="${OCI_REGION}"

mkdir -p "${TARGET_DIR}"

echo "[sync] endpoint: ${ENDPOINT}"
echo "[sync] source:   ${S3_URI}"
echo "[sync] target:   ${TARGET_DIR}"

# Sync bucket subtree to local filesystem.
aws --endpoint-url "${ENDPOINT}" s3 sync "${S3_URI}" "${TARGET_DIR}" --delete

echo "[sync] completed"
du -sh "${TARGET_DIR}" || true
