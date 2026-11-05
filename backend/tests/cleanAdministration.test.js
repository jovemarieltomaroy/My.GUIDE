const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateTarget, validateManifest } = require('../scripts/prepareCleanDatabase');
const { roleGuard } = require('../middleware/roleGuard');
const AuditEvent = require('../models/auditEvent');
const User = require('../models/user');
test('initializer accepts only confirmed local clean database', () => {
  validateTarget('mongodb://localhost:27017/myguide_clean?directConnection=true', 'myguide_clean');
  for (const uri of ['mongodb://localhost:27017/working', 'mongodb://remote/myguide_clean', 'mongodb://localhost:27017/'])
    assert.throws(() => validateTarget(uri, 'myguide_clean'));
  assert.throws(() => validateTarget('mongodb://localhost/myguide_clean', ''));
});
test('index manifest requires actual EmbeddingGemma vector field', () => {
  const entry = { name: 'knowledge_vector_index', type: 'vectorSearch', definition: { fields: [{ type: 'vector', path: 'embedding', numDimensions: 768, similarity: 'cosine' }] } };
  validateManifest([entry]);
  assert.throws(() => validateManifest([]));
  assert.throws(() => validateManifest([{ ...entry, definition: { fields: [] } }]));
});
test('only one Super Admin is indexed, counselor role remains default', () => {
  assert.equal(new User({ email: 'test@example.invalid', password: 'hash' }).role, 'Counselor-User');
  const index = User.schema.indexes().find(([, options]) => options.name === 'one_super_admin');
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, { role: 'Super-Admin' });
});
test('clinical role guard denies Super Admin and records no narrative', async () => {
  const original = AuditEvent.create;
  let record;
  AuditEvent.create = async event => { record = event; };
  try {
    let status;
    await roleGuard(['Counselor-Admin', 'Counselor-User'])({ user: { role: 'Super-Admin' }, baseUrl: '/api/cases', body: { narrative: 'private' } },
      { status(code) { status = code; return this; }, json() {} }, () => assert.fail('must deny'));
    assert.equal(status, 403);
    assert.equal(JSON.stringify(record).includes('private'), false);
    for (const role of ['Counselor-Admin', 'Counselor-User']) {
      let passed = false;
      await roleGuard(['Counselor-Admin', 'Counselor-User'])({ user: { role } }, {}, () => { passed = true; });
      assert.equal(passed, true);
    }
  } finally { AuditEvent.create = original; }
});
test('empty knowledge base avoids Ollama and vector search', async () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const context = { module: { exports: {} }, process, require(name) {
    if (name === '../../models/knowledgeChunk') return {
      exists: async () => null, aggregate: () => assert.fail('must not search an empty collection'),
    };
    if (name === '../../models/knowledgeResource') return {};
    if (name === '../resourceEligibility') return require('../services/resourceEligibility');
    if (name === './embeddingService') return { generateEmbedding: () => assert.fail('must not call Ollama') };
    throw Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../services/rag/retrievalService'), 'utf8'), context);
  assert.equal((await context.module.exports.retrieveRelevantChunks('stress')).length, 0);
  assert.equal((await context.module.exports.retrieveInterventionMaterials('stress')).length, 0);
});
test('counselor creation rejects requested Super Admin before querying or hashing', async () => {
  const { createUser } = require('../controllers/userController');
  let status;
  let response;
  await createUser({ body: { email: 'new@example.invalid', password: 'irrelevant', role: 'Super-Admin' } }, {
    status(code) { status = code; return this; }, json(data) { response = data; },
  });
  assert.equal(status, 400);
  assert.match(response.message, /Counselor-User/);
});
test('account guard blocks every management method targeting Super Admin', async () => {
  const guard = require('../middleware/accountAdministration');
  const originalFind = User.findById;
  const originalAudit = AuditEvent.create;
  User.findById = () => ({ select: async () => ({ role: 'Super-Admin' }) });
  AuditEvent.create = async () => ({});
  try {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      let status;
      await guard({ path: '/012345678901234567890123/reset-password', method, user: { _id: 'actor' } }, {
        status(code) { status = code; return this; }, json() {},
      }, () => assert.fail('protected account must not reach controller'));
      assert.equal(status, 403);
    }
  } finally { User.findById = originalFind; AuditEvent.create = originalAudit; }
});
test('all account management routes are Super Admin-only; self-service and counselor lookup remain available', async () => {
  const { accountAdminOnly } = require('../middleware/authValidator');
  const router = require('../routes/userRoutes');
  const routes = router.stack.filter(layer => layer.route).map(layer => layer.route);
  const expected = [ ['/', 'get'], ['/', 'post'], ['/:id', 'get'], ['/:id', 'put'],
    ['/:id/role', 'patch'], ['/:id/reactivate', 'patch'], ['/:id/deactivate', 'patch'], ['/:id/reset-password', 'put'] ];
  for (const [path, method] of expected) {
    const route = routes.find(item => item.path === path && item.methods[method]);
    assert.ok(route, `${method} ${path} exists`);
    assert.ok(route.stack.some(layer => layer.method === method && layer.handle === accountAdminOnly), `${method} ${path} enforces account guard`);
  }
  for (const path of ['/me', '/me/change-password', '/me/complete-profile', '/counselors/active']) {
    const route = routes.find(item => item.path === path);
    assert.ok(route);
    assert.equal(route.stack.some(layer => layer.handle === accountAdminOnly), false);
  }
  const original = AuditEvent.create;
  const denied = [];
  AuditEvent.create = async record => { denied.push(record); };
  try {
    for (const role of ['Counselor-Admin', 'Counselor-User']) {
      let code;
      await accountAdminOnly({ user: { role }, baseUrl: '/api/users' }, {
        status(value) { code = value; return this; }, json() {},
      }, () => assert.fail('counselor must not manage accounts'));
      assert.equal(code, 403);
    }
    let passed = false;
    await accountAdminOnly({ user: { role: 'Super-Admin' } }, {}, () => { passed = true; });
    assert.equal(passed, true);
    assert.equal(denied.length, 2);
  } finally { AuditEvent.create = original; }
});
