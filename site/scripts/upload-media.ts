/**
 * Smart media uploader for Cloudflare R2.
 *
 * Maintains a `.media-manifest.json` in the vault root to track SHA-256
 * hashes of uploaded files. Only uploads new or changed files.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=xxx npx tsx scripts/upload-media.ts
 *
 * Flags:
 *   --force     Re-upload every file regardless of manifest
 *   --dry-run   Show what would be uploaded/deleted without doing it
 *   --delete    Remove files from R2 that no longer exist locally
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, relative, join, extname } from 'path';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');

const MEDIA_DIR = resolve(ROOT, 'media');
const CONFIG_FILE = resolve(ROOT, 'site-config.json');
const MANIFEST_FILE = resolve(ROOT, '.media-manifest.json');

const SKIP_FILES = new Set(['_Media_Index.md', '.DS_Store']);

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const deleteRemoved = args.includes('--delete');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Manifest {
  bucket: string;
  files: Record<string, string>; // relative path → sha256
}

interface SiteConfig {
  media?: {
    r2Bucket?: string;
    r2PublicUrl?: string;
    cloudflareAccountId?: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadConfig(): { bucket: string; accountId: string; apiToken: string } {
  let configBucket = '';
  let configAccount = '';

  if (existsSync(CONFIG_FILE)) {
    const cfg: SiteConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    configBucket = cfg.media?.r2Bucket ?? '';
    configAccount = cfg.media?.cloudflareAccountId ?? '';
  }

  const bucket = process.env.R2_BUCKET || configBucket;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || configAccount;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';

  if (!bucket) {
    console.error('Error: R2 bucket not configured. Set R2_BUCKET env var or add media.r2Bucket to site-config.json');
    process.exit(1);
  }
  if (!accountId) {
    console.error('Error: Cloudflare account ID not configured. Set CLOUDFLARE_ACCOUNT_ID env var or add media.cloudflareAccountId to site-config.json');
    process.exit(1);
  }
  if (!apiToken) {
    console.error('Error: CLOUDFLARE_API_TOKEN not set');
    process.exit(1);
  }

  return { bucket, accountId, apiToken };
}

function loadManifest(): Manifest {
  if (existsSync(MANIFEST_FILE)) {
    return JSON.parse(readFileSync(MANIFEST_FILE, 'utf-8'));
  }
  return { bucket: '', files: {} };
}

function saveManifest(manifest: Manifest): void {
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
}

function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function contentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase().replace('.', '');
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  };
  return types[ext] || 'application/octet-stream';
}

/** Recursively collect all media files, returning paths relative to MEDIA_DIR. */
function collectMediaFiles(dir: string, base: string = dir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectMediaFiles(full, base));
    } else {
      files.push(relative(base, full));
    }
  }
  return files;
}

async function uploadFile(
  key: string,
  filePath: string,
  bucket: string,
  accountId: string,
  apiToken: string,
): Promise<boolean> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`;
  const body = readFileSync(filePath);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': contentType(filePath),
    },
    body,
  });

  return res.ok;
}

async function deleteFile(
  key: string,
  bucket: string,
  accountId: string,
  apiToken: string,
): Promise<boolean> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  return res.ok;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(MEDIA_DIR)) {
    console.error(`Media directory not found: ${MEDIA_DIR}`);
    process.exit(1);
  }

  const { bucket, accountId, apiToken } = loadConfig();
  const manifest = loadManifest();

  // If the bucket changed, treat everything as new
  if (manifest.bucket && manifest.bucket !== bucket) {
    console.log(`Bucket changed (${manifest.bucket} → ${bucket}), re-uploading all files.`);
    manifest.files = {};
  }

  console.log(`Vault:   ${ROOT}`);
  console.log(`Bucket:  ${bucket}`);
  if (force) console.log('Mode:    --force (re-uploading all)');
  if (dryRun) console.log('Mode:    --dry-run (no changes)');
  if (deleteRemoved) console.log('Mode:    --delete (removing orphaned R2 objects)');
  console.log();

  const localFiles = collectMediaFiles(MEDIA_DIR);
  const localSet = new Set(localFiles);

  // Determine what to upload
  const toUpload: string[] = [];
  for (const key of localFiles) {
    const filePath = resolve(MEDIA_DIR, key);
    const hash = hashFile(filePath);
    if (force || manifest.files[key] !== hash) {
      toUpload.push(key);
    }
  }

  // Determine what to delete
  const toDelete: string[] = [];
  if (deleteRemoved) {
    for (const key of Object.keys(manifest.files)) {
      if (!localSet.has(key)) {
        toDelete.push(key);
      }
    }
  }

  if (toUpload.length === 0 && toDelete.length === 0) {
    console.log('Everything up to date — nothing to do.');
    return;
  }

  console.log(`${toUpload.length} file(s) to upload, ${toDelete.length} file(s) to delete.\n`);

  // Upload
  let uploaded = 0;
  let uploadErrors = 0;

  for (const key of toUpload) {
    const filePath = resolve(MEDIA_DIR, key);
    const hash = hashFile(filePath);

    if (dryRun) {
      const reason = manifest.files[key] ? 'changed' : 'new';
      console.log(`  [dry-run] Would upload (${reason}): ${key}`);
    } else {
      process.stdout.write(`  Uploading: ${key} ... `);
      const ok = await uploadFile(key, filePath, bucket, accountId, apiToken);
      if (ok) {
        console.log('ok');
        manifest.files[key] = hash;
        uploaded++;
      } else {
        console.log('FAILED');
        uploadErrors++;
      }
    }
  }

  // Delete
  let deleted = 0;
  let deleteErrors = 0;

  for (const key of toDelete) {
    if (dryRun) {
      console.log(`  [dry-run] Would delete: ${key}`);
    } else {
      process.stdout.write(`  Deleting: ${key} ... `);
      const ok = await deleteFile(key, bucket, accountId, apiToken);
      if (ok) {
        console.log('ok');
        delete manifest.files[key];
        deleted++;
      } else {
        console.log('FAILED');
        deleteErrors++;
      }
    }
  }

  // Save manifest
  if (!dryRun) {
    manifest.bucket = bucket;
    saveManifest(manifest);
  }

  // Summary
  console.log();
  if (dryRun) {
    console.log(`Dry run complete. ${toUpload.length} upload(s), ${toDelete.length} deletion(s) would be performed.`);
  } else {
    console.log(`Done. ${uploaded} uploaded, ${deleted} deleted, ${uploadErrors + deleteErrors} error(s).`);
  }

  if (uploadErrors + deleteErrors > 0) {
    process.exit(1);
  }
}

main();
