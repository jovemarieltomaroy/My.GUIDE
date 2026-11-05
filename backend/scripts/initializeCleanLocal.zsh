#!/bin/zsh
# Run interactively in your terminal. Does not change .env or start the app.
set -eu
cd "${0:A:h}/.."
if [[ $# -ne 1 || ! -f "$1" ]]; then
  print -u2 'Usage: zsh scripts/initializeCleanLocal.zsh /absolute/path/to/vector-index-manifest.json'
  exit 1
fi
export VECTOR_INDEX_MANIFEST="$1"
if [[ -z ${SUPER_ADMIN_EMAIL:-} ]]; then
  read -r 'SUPER_ADMIN_EMAIL?Initial Super Admin email: '
fi
read -rs 'SUPER_ADMIN_PASSWORD?Initial password (16+ characters, <=72 UTF-8 bytes): '
print
read -rs 'password_confirmation?Confirm password: '
print
if [[ "$SUPER_ADMIN_PASSWORD" != "$password_confirmation" ]]; then
  print -u2 'Passwords do not match.'
  exit 1
fi
export SUPER_ADMIN_EMAIL SUPER_ADMIN_PASSWORD
trap 'unset SUPER_ADMIN_PASSWORD password_confirmation' EXIT
node <<'JS'
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const settings = require('dotenv').parse(fs.readFileSync('.env'));
const uri = new URL(settings.MONGO_URI);
if (!['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname) || uri.pathname === '/myguide_clean')
  throw Error('Expected a separate existing local source database.');
const source = uri.pathname.slice(1);
if (uri.username && !uri.searchParams.has('authSource')) uri.searchParams.set('authSource', source);
uri.pathname = '/myguide_clean';
const result = spawnSync(process.execPath, ['scripts/prepareCleanDatabase.js', 'initialize'], {
  stdio: 'inherit', env: { ...process.env, CLEAN_MONGO_URI: uri.toString(),
    CONFIRM_CLEAN_DATABASE: 'myguide_clean', VECTOR_INDEX_NAME: settings.VECTOR_INDEX_NAME || 'knowledge_vector_index' },
});
process.exit(result.status ?? 1);
JS
