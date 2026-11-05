// Read-only database backup. Never starts the app or initializes a database.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongodb');
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} failed (exit ${code})`)));
  });
}
async function main() {
  process.umask(0o077);
  const settings = require('dotenv').parse(await fs.readFile(path.join(__dirname, '../.env')));
  const uri = settings.MONGO_URI;
  const parsed = new URL(uri);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || parsed.pathname === '/myguide_clean')
    throw new Error('Expected an existing local source database other than myguide_clean.');
  const directory = path.resolve(__dirname, '../../backups', `before-clean-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db();
    const before = await db.command({ dbHash: 1 });
    await fs.writeFile(path.join(directory, 'source-hashes-before.json'), JSON.stringify(before.collections, null, 2), { mode: 0o600, flag: 'wx' });
    const indexes = await db.collection('knowledgechunks').listSearchIndexes().toArray();
    const manifest = indexes.map(index => ({ name: index.name, type: index.type, definition: index.latestDefinition }));
    require('./prepareCleanDatabase').validateManifest(manifest);
    await fs.writeFile(path.join(directory, 'vector-index-manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600, flag: 'wx' });
    await run('mongodump', ['--uri', uri, `--archive=${path.join(directory, 'original.archive.gz')}`, '--gzip']);
    const uploadRoot = path.resolve(settings.UPLOAD_ROOT || path.join(__dirname, '../uploads'));
    try {
      await fs.access(uploadRoot);
      await run('tar', ['-czf', path.join(directory, 'uploads.tar.gz'), '-C', path.dirname(uploadRoot), path.basename(uploadRoot)]);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const after = await db.command({ dbHash: 1 });
    await fs.writeFile(path.join(directory, 'source-hashes-after.json'), JSON.stringify(after.collections, null, 2), { mode: 0o600, flag: 'wx' });
    const stable = JSON.stringify(Object.entries(before.collections).sort()) === JSON.stringify(Object.entries(after.collections).sort());
    const report = { sourceDatabase: db.databaseName, sourceUnchangedDuringBackup: stable,
      archiveBytes: (await fs.stat(path.join(directory, 'original.archive.gz'))).size,
      vectorIndexes: manifest.map(index => ({ name: index.name, type: index.type, definition: index.definition })) };
    await fs.writeFile(path.join(directory, 'backup-report.json'), JSON.stringify(report, null, 2), { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ directory, ...report }, null, 2));
    if (!stable) throw new Error('Source changed during backup. Stop writers and repeat before initialization.');
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.name === 'MongoServerSelectionError' ? 'Local MongoDB connection failed.' : error.message); process.exitCode = 1; });
