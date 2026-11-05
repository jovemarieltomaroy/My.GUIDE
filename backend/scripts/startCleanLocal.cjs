// Explicit clean startup: preserve configured credentials; never edit .env.
const fs = require('node:fs');
const path = require('node:path');
function buildCleanUri(sourceUri) {
  const uri = new URL(sourceUri);
  if (uri.protocol !== 'mongodb:' || !['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname))
    throw new Error('Clean startup requires a local MongoDB connection.');
  if (uri.username && !uri.searchParams.has('authSource'))
    uri.searchParams.set('authSource', uri.pathname.slice(1) || 'admin');
  uri.pathname = '/myguide_clean';
  uri.searchParams.set('directConnection', 'true');
  return uri.toString();
}
function configure() {
  const backendRoot = path.resolve(__dirname, '..');
  const settings = require('dotenv').parse(fs.readFileSync(path.join(backendRoot, '.env')));
  // Deliberately derive from the saved source, ignoring a stale shell URI override.
  process.env.MONGO_URI = buildCleanUri(settings.MONGO_URI);
  process.env.UPLOAD_ROOT = path.join(backendRoot, 'uploads-clean');
  process.chdir(backendRoot);
  console.log('Starting with myguide_clean and isolated uploads; existing MongoDB authentication preserved.');
}
if (require.main === module) {
  try { configure(); }
  catch { console.error('Unable to configure clean startup. Check the local MONGO_URI in backend/.env.'); process.exit(1); }
  require('../server');
}
module.exports = { buildCleanUri };
