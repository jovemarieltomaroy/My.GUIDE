# Fresh local installation (manual runbook)

No commands below have been run against MongoDB. Do not run legacy seed, clearing,
migration, or worksheet scripts during this setup. Keep `myguide-mongodb` and its
volumes. Keep `backend/.env` unchanged. Stop the running backend before choosing a
different database so users cannot accidentally write to the wrong installation.

## Implementation and relationships

The actual connection setting is `MONGO_URI` (`backend/config/db.js`). Authentication
uses bcryptjs with cost 10 and an HTTP-only JWT cookie; there is no public signup.
Account creation is authenticated. New accounts are Counselor-User; promotion to
Counselor-Admin uses the existing administrator-password confirmation endpoint.
Super-Admin is seeded only by the manual initializer. A partial unique role index
limits Super-Admin to one. Regular account endpoints cannot target that account.

Mongoose collection names: `users`, `students`, `caserecords`, `precounselingforms`,
`knowledgeresources`, `knowledgechunks`, plus new `auditevents` and
`systemconfigurations`. The initializer derives names from the models at runtime.
Cases reference students and counselors and embed progress notes, intervention
plans, recommendations, follow-ups, and timeline entries. Intake forms reference
students, counselors, and now the correct `CaseRecord` model. Resources reference
uploaders/reviewers and replacement records. Chunks link to resources through the
string `metadata.resourceId`; MongoDB does not enforce foreign keys.

Counselor roles retain existing clinical guards and case ownership checks.
User Management is exclusively Super Admin: counselor roles cannot list, create,
edit, reset passwords for, change roles of, or activate/deactivate other accounts.
Their own profile/password endpoints and the active-counselor lookup remain available.
Dashboard, analytics, and reports use that lookup for counselor workload data.
Super-Admin gets counselor account management, organization name configuration,
read-only database/vector-index readiness, and the latest 100 administrative audit
events. It gets no clinical API or upload access. Configuration deliberately accepts
only organizationName, not arbitrary environment variables or executable commands.
Audit records contain actor, action, target ID, outcome, and timestamps, never
passwords or request bodies. Audit attempts are persisted before privileged writes;
response outcomes are updated afterward. Audit storage must be available for guarded
operations. This is an application audit trail, not tamper-proof external logging.

The PDF extraction, cleaning, chunking, embedding, evidence review, and prompt
pipeline is preserved. Defaults remain `gemma3:4b` and `embeddinggemma`; existing
`OLLAMA_MODEL`, `OLLAMA_EMBEDDING_MODEL`, `OLLAMA_BASE_URL`, and `EMBEDDING_PROVIDER`
settings still apply. Retrieval uses the active Mongoose database. Empty chunks
return no evidence before embedding/search. Existing generation gates reject missing
or insufficient support and resolve citations against actual retrieved passages.
Similarity alone is not clinical evidence; counselor approval remains necessary.

Failed ingestion keeps a Failed parent and its PDF for inspection and removes
partial chunks. Replacement activation uses the existing database transaction.
Deletion first disables the parent, then removes chunks and the PDF, then removes
the parent; failures retain a disabled record for retry instead of false success.
These filesystem/database operations are recoverable, not a cross-store transaction.

## 1. Backup and export the actual vector definition

Use a terminal with MongoDB Database Tools (`mongodump`) and `mongosh` installed.
Run from the project root in zsh. Enter the current working database URI from your
existing configuration; do not paste secrets into shell history.

```zsh
cd /Users/ladyantoniatugahan/Downloads/My.GUIDE-LLM
umask 077
read -rs 'SOURCE_MONGO_URI?Current working database URI: '; echo
export SOURCE_MONGO_URI
mkdir -p backups
BACKUP_STAMP=$(date +%Y%m%d-%H%M%S)
mongodump --uri="$SOURCE_MONGO_URI" --archive="backups/original-$BACKUP_STAMP.archive.gz" --gzip
tar -czf "backups/uploads-$BACKUP_STAMP.tar.gz" -C backend uploads
```

If uploads do not exist, skip only the tar command. Back up any custom external
upload root separately. Archives contain confidential information; protect them.
Verify mongodump exits successfully before continuing; inspect archive size and
perform any restore verification only into a separate disposable environment.

Capture the original database logical content hashes before initialization:

```zsh
mongosh "$SOURCE_MONGO_URI" --quiet --eval 'const r=db.runCommand({dbHash:1}); if(!r.ok) throw Error("dbHash failed"); print(EJSON.stringify(r.collections));' > backups/original-hashes-before.json
cd backend
node scripts/prepareCleanDatabase.js export-indexes
cat vector-index-manifest.json
```

The export only calls listSearchIndexes on the source KnowledgeChunk collection.
It uses exclusive file creation so it cannot overwrite an earlier manifest. Set
`VECTOR_INDEX_MANIFEST` to a new filename for a new export. Review the exported
name, vector dimensions, similarity, and optional filter fields in Compass.
The expected name is `VECTOR_INDEX_NAME` or `knowledge_vector_index`; the embedding
field must have 768 dimensions. Export preserves every search definition from that
collection, including the live similarity setting. No definition is guessed here.
If export fails or there is no suitable live index, stop and inspect the current
Compass index; do not claim vector compatibility from a schema comment alone.

## 2. Initialize only myguide_clean

The clean URI must explicitly name `/myguide_clean` on localhost, 127.0.0.1, or ::1.
Use the host port already mapped by your Docker container, with its existing
replica/auth connection options. Inspect ports without changing Docker:

```zsh
docker port myguide-mongodb
read -rs 'CLEAN_MONGO_URI?Local URI explicitly ending in /myguide_clean (plus existing connection options): '; echo
export CLEAN_MONGO_URI
export CONFIRM_CLEAN_DATABASE=myguide_clean
read -r 'SUPER_ADMIN_EMAIL?Initial Super Admin email: '
read -rs 'SUPER_ADMIN_PASSWORD?Initial password (16+ characters, <=72 UTF-8 bytes): '; echo
export SUPER_ADMIN_EMAIL SUPER_ADMIN_PASSWORD
node scripts/prepareCleanDatabase.js initialize
unset SUPER_ADMIN_PASSWORD
```

The script does not load `.env`, does not use `MONGO_URI`, and never drops anything.
It refuses unknown target collections or clinical/knowledge/audit documents, extra
users, or a different initial email. It creates model collections and additive
indexes, exports no source records, creates default configuration, and bcrypt-hashes
one password. An immediate rerun with the same email and valid credential inputs
preserves the existing password. A rerun after evaluation has begun intentionally
fails because the database is no longer a clean initialization target. If interrupted,
correct the reported issue and rerun; it never automatically removes partial work.
Search index creation is asynchronous. Wait for READY/queryable in Compass.

## 3. Inspect before starting the application

```zsh
mongosh "$CLEAN_MONGO_URI" --quiet --eval 'printjson(db.getCollectionNames().sort().map(name=>({name,count:db.getCollection(name).countDocuments({})}))); printjson(db.users.find({}, {email:1,role:1,isActive:1}).toArray()); printjson(db.knowledgechunks.aggregate([{$listSearchIndexes:{}}]).toArray());'
mongosh "$SOURCE_MONGO_URI" --quiet --eval 'const r=db.runCommand({dbHash:1}); if(!r.ok) throw Error("dbHash failed"); print(EJSON.stringify(r.collections));' > ../backups/original-hashes-after.json
diff -u ../backups/original-hashes-before.json ../backups/original-hashes-after.json
```

Expect exactly one users document (Super-Admin), one systemconfigurations document,
and zero in every other collection, including audit. Hash comparison requires the
original application and all other writers to remain stopped. Search definitions
are backed up separately because mongodump does not recreate Atlas Search indexes.

Only after review, start a separate backend process with shell overrides. This is
the manual switch; it does not edit `.env`. Retain your existing JWT, Ollama, email,
and Cloudinary settings. Use a new absolute uploads directory, not the old one:

```zsh
npm run start:clean
```

In another terminal:

```zsh
cd /Users/ladyantoniatugahan/Downloads/My.GUIDE-LLM/frontend
npm run dev
```

Use the configured frontend origin/port (`FRONTEND_URL`, default localhost:5174)
and `VITE_API_BASE_URL` matching the backend. For client-server deployment use the
actual server host, HTTPS, a separate JWT secret and database credentials, and
appropriately configured cookie/CORS origins; localhost on a client means that
client itself. Existing profile photo completion still requires Cloudinary and
email features still require the existing transporter configuration.

## 4. Automated checks (no MongoDB/Ollama connection)

```zsh
cd /Users/ladyantoniatugahan/Downloads/My.GUIDE-LLM
node --test backend/tests/cleanAdministration.test.js backend/tests/resourceLifecycle.test.js
node --test backend/tests/*.test.js
npm --prefix frontend run build
```

The administration tests cover clean URI refusal, index manifest validation,
single-admin schema, backend clinical denial with audit privacy, and empty-KB
retrieval without Ollama. Lifecycle tests cover parent eligibility and replacement
safety. The full suite has an existing recommendation presentation failure caused
by a missing `evidenceSupportPresentation` helper; it is unrelated to initialization.

## 5. Evaluation checklist (manual integration)

Do the empty counts and source hash comparison BEFORE adding evaluation records.
Use synthetic student details and disposable counselor accounts during evaluation.

| Check | Procedure and expected result |
|---|---|
| 1. Super Admin login | Sign in using initialization inputs; land on `/system`, see administration-only navigation. |
| 2. No counselor can create Super Admin | As either counselor role, all account-management requests return 403, including attempts to create or promote a Super Admin. As Super Admin, requests to create/promote another Super Admin return 400; targeting the seeded admin through account-management endpoints returns 403. No public signup route exists. |
| 3. Role boundaries | Super Admin GET `/api/cases`, `/api/students`, `/api/knowledge-base`, private intake endpoints and `/uploads/...`: 403. Counselor roles GET `/api/system/configuration`, `/maintenance`, `/audit`: 403. Counselor-User cannot upload/edit/delete KB resources or manage accounts. Counselor-Admin retains Knowledge Base management, clinical administration, workload analytics, and reports; account management is Super Admin-only. Existing assigned-case/temporary-access restrictions still apply. |
| 4. No history | Compass counts match the pre-start expectations above. There are no embedded notes/plans because there are no cases. No old uploaded file directory is mounted as the clean upload root. |
| 5. Counselor creation | Super Admin creates a Counselor-User in `/users`, promotes a selected counselor to Counselor-Admin with own password confirmation. New counselors complete password/profile setup. Audit shows attempts and outcomes without secrets. |
| 6. Case creation | As counselor create a fresh student, consent/intake, case, then progress note; verify ownership and counselor access. Super Admin remains denied even with a known case ID. |
| 7. PDF upload | As Counselor-Admin upload an approved reference PDF in Knowledge Base with title/topic/type. Expect Ready, matching parent totalChunks and `metadata.resourceId` counts, and a protected PDF preview. |
| 8. Embeddings | Check `ollama list` for your existing Gemma 3 and embeddinggemma. Upload creates finite 768-dimensional embedding arrays in clean knowledgechunks. Do not pull or replace models for this setup. |
| 9. Vector retrieval | Confirm index queryable in Compass. With ONLY clean URI overrides, run the read-only retrieval command below; results must correspond to the newly uploaded reference. |
| 10. Grounded generation | Before upload, case generation reports insufficient_reference_material and saves no unsupported draft. After upload, generate against a concern directly covered by the PDF; check actual title/page/passages for each citation, then counselor approval. Irrelevant or inadequate passages must yield no supported plan. |
| 11. Source preservation | Original logical hashes unchanged through initialization; original PDF archive and container volumes retained. No original URI is used to run scripts that mutate records. |
| Files and lifecycle | Mark a reference Under Review/Obsolete and verify it stops retrieval. Replace it successfully and check old/new PDF history. Delete a disposable unlinked reference: parent, chunks and file disappear together on success. A file deletion failure must return an error and keep a disabled parent for retry. |
| Administration | Change organization name, refresh configuration and inspect audit. Try supplying MONGO_URI or model keys: 400. Inspect maintenance readiness. No destructive maintenance endpoint exists. |

Read-only live retrieval test, from backend after uploading a reference:

```zsh
MONGO_URI="$CLEAN_MONGO_URI" node -r dotenv/config -e 'const m=require("mongoose"); (async()=>{await m.connect(process.env.MONGO_URI); try { const r=await require("./services/rag/retrievalService").retrieveRelevantChunks("academic stress and coping"); console.log(JSON.stringify(r.map(x=>({title:x.metadata.title,page:x.metadata.pageNumber,score:x.score})),null,2)); if(!r.length) process.exitCode=1; } finally {await m.disconnect();}})().catch(e=>{console.error(e.message);process.exitCode=1;});'
```

Replace the query with a topic actually covered by the evaluation PDF. Existing
scripts named testKnowledgeIngestion/testVectorStore can write documents and must
not be used as read-only checks. To return to the original installation, stop the
clean backend and start with your unchanged original environment; do not copy data
back or change/drop either database automatically.


## Local preparation completed October 27, 2026 (Asia/Manila)

Created a new backup at `backups/before-clean-2026-10-27T04-25-01-055Z/`.
The database archive is 39,313,680 bytes; gzip integrity and upload tar listing
checks passed. Source `myguide_db` collection hashes matched before and after backup.
The live `knowledge_vector_index` definition was exported: embedding, 768 dimensions,
cosine similarity. `myguide_clean` had no collections at inspection. No initialization
or active connection switch was performed during preparation. These checks do not
constitute a test restore. Existing 23-byte archive was not used or overwritten.

A terminal helper now accepts secure password input without echoing or saving it.
It derives the separate local clean URI from the existing config and invokes only
the guarded initializer. It does not change `.env` or start the application:

```zsh
cd /Users/ladyantoniatugahan/Downloads/My.GUIDE-LLM
SUPER_ADMIN_EMAIL=superadmin@myguide.com zsh backend/scripts/initializeCleanLocal.zsh "$PWD/backups/before-clean-2026-10-27T04-25-01-055Z/vector-index-manifest.json"
```

Enter and confirm a fresh password when prompted. Do not send it in chat.
After successful initialization, follow the collection counts, index readiness,
and source preservation checks above before manually switching the backend.

The `start:clean` launcher preserves credentials and authSource from backend/.env,
sets directConnection=true for Docker, and selects myguide_clean plus uploads-clean
for that process only. It ignores stale shell MONGO_URI overrides.
