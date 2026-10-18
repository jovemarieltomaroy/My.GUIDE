# Knowledge Base classification and lifecycle

## Final resource types

Database values are exactly `reference`, `worksheet`, and `handout` for new or reviewed resources.

| Label | Purpose | RAG when Active and Ready | Student PDF attachment |
| --- | --- | --- | --- |
| Reference (RAG) | Literature, books, guides and supporting evidence | Yes | Never |
| Worksheet | Student activities, written answers and reflection tasks | Yes | Explicit selection and approved plan required |
| Handout | Information for students to read | Yes | Explicit selection and approved plan required |

The lifecycle (`Active`, `Under Review`, `Obsolete`) remains separate from PDF processing (`Pending`, `Processing`, `Ready`, `Failed`). Missing lifecycle status defaults to Active for compatibility without overriding `isActive: false`, processing failures, replacement history, or resource-type restrictions.

The UI offers only the three final types. Legacy values remain readable and can be retained without rewriting historical documents. They are excluded from retrieval and student attachments until reviewed and classified; their PDFs are not deleted. New records and new ingestion reject unsupported types.

## Backend attachment protection

`knowledgeAttachments.js` extracts IDs from protected Knowledge Base URLs, checks authenticated counselor roles, reads each authoritative resource, and rejects anything except Active, Ready, otherwise enabled Worksheets and Handouts. Client-provided type or Link labels cannot authorize Reference PDFs. Malformed IDs, direct Knowledge Base upload paths, and forged resource IDs are rejected.

Validation runs on case/plan resource submissions, recommendation edits/acceptance, plan approval, attachment preparation, and immediately before SMTP. The existing assigned-counselor and approved-plan send checks remain; case assignment and approval are checked again before SMTP. New plans require review; changed attachment selections require review again. A previously attached resource becoming Obsolete blocks a new email until replaced explicitly.

Case-uploaded resources remain supported. The file resolver accepts existing case-linked files only under `uploads/intervention-resources`; it cannot resolve a Knowledge Base PDF through the local-upload path. Follow-up and pre-counseling email workflows do not send Knowledge Base attachments.

AI retrieval or a supporting-resource suggestion no longer automatically adds a PDF to a recommendation or plan. Counselors explicitly choose a material through the intervention plan editor's Knowledge Base selector. The selector API returns only eligible Worksheets and Handouts. Selection still requires plan approval before sending.

## RAG and lifecycle behavior

Vector search retrieves extra candidates, then queries their parent resources. Only approved passages belonging to Ready, Active, enabled resources of the three final types pass. Metadata given to the model is refreshed from the parent title, type and topic. Missing parents, invalid legacy IDs, unsupported types, replaced records, Under Review and Obsolete resources are excluded.

No eligibility cache is used. Status changes therefore take effect without deleting passages or regenerating vectors. Eligibility is rechecked before prompt creation and after generation. If a resource becomes ineligible during generation, the result is discarded. Fewer usable candidates are returned instead of filling gaps with ineligible documents.

The configured Gemma model, EmbeddingGemma model, 768-dimensional vectors, similarity scoring and Atlas vector index remain unchanged. Prompt changes only clarify the final classification and the need for explicit counselor attachment selection.

## Schema and migration

The lifecycle update adds status, publication details, review timestamps/actors, status history and replacement relationships to `KnowledgeResource`. This classification update adds conditional type validation and `typeHistory` (previous/new types, review date, optional reviewer and reason). Existing legacy documents can still be saved unchanged. No destructive enum migration or vector-index change is needed.

The configured database was inspected before migration: three Handouts, one Worksheet, and one Exercise. The legacy Exercise, **Calm Down Stress Practice**, was reviewed through its stored passages: stress ratings, skills practice, written answers and closing reflection identify it as a Worksheet.

`scripts/migrateReviewedResourceType.js --apply` transactionally changed that one resource (`6ac3466de5d5ed9369f3c069`) from `exercise` to `worksheet` and updated its seven passage type labels. It preserved its PDF, lifecycle/approval state and embedding vectors, and recorded the implementation content-review reason in type history. It did not impersonate a counselor: the migration reviewer reference is null. No other resources were reclassified. The script is scoped to the reviewed identity, checks concurrent processing, and is idempotent. Unknown future legacy records require individual review.

## Verification actually performed

- `node --test backend/tests/*.test.js`: **26 tests passed**. Covers all three Active types, Under Review/Obsolete exclusion, Reference ID/Link/path forgery rejection, explicit Worksheet/Handout selection, later-obsolete send rejection, approval/assignment checks before SMTP, case-upload preservation, status-only edits, replacement safety and legacy validation.
- The attachment test renders actual PDF MIME output through Nodemailer's local stream transport. Controller tests use a mocked SMTP transport. **No email was sent to an actual student.**
- `npm run build --prefix frontend`: passed, with the existing bundle-size warning.
- Targeted lint for the Knowledge Base, material selector and Intervention Plans: passed. The project has previously identified unrelated lint errors in `MyCasesPage.jsx`.
- `node scripts/verifyKnowledgePipeline.js`: passed against the configured live MongoDB Atlas and Ollama services. A known synthetic PDF (`tests/fixtures/academic-stress-worksheet.pdf`) was uploaded through the existing controller for all three classifications. Actual text extraction, filtering/chunking, EmbeddingGemma generation, 768-dimensional MongoDB storage and Atlas vector retrieval passed for each type. Source title, type and page metadata were checked. The configured Gemma generated **three grounded recommendations with five source references** for a synthetic academic-stress case. Under Review and Obsolete test references were excluded from actual vector results and the assembled LLM prompt while their PDFs and embeddings remained present. All three synthetic resource records and their passages were then removed by captured ID; existing records were retained.

The live verification script creates synthetic records in the configured database, calls Ollama and cleans up only its captured test IDs. Run it deliberately against the intended environment. Browser layout, clicking through the entire authenticated UI, and delivery through a real SMTP provider were not verified automatically.

## Manual interface test

1. Restart the backend and frontend, sign in as Counselor-Admin, and open Knowledge Base.
2. Add one resource of each final type. Read the type descriptions; choose Active, upload a PDF, and wait for Ready. Check title, type, page count and original PDF preview.
3. Open View. Reference must say it is not permitted as a student attachment; an Active, Ready Worksheet/Handout must say counselor selection and plan approval are required.
4. Use Edit / Change Status to mark a resource Under Review or Obsolete. Confirm the obsolete dialog. Filter by status and verify its PDF still opens and counts update. Reactivate an eligible resource with confirmation.
5. Generate recommendations for a matching synthetic case. Active resources may appear as sources; Under Review/Obsolete resources must not. No PDF should become an attachment merely because it was retrieved or mentioned.
6. Open the intervention plan editor. In “Choose a Knowledge Base attachment,” verify only eligible Worksheets and Handouts appear. Explicitly add one; check that Reference and obsolete materials are absent. Save the plan and complete the existing counselor approval process.
7. Using a controlled test student email address, send the approved plan as its assigned counselor. Verify the selected practical PDF is attached. Repeating the send is still prohibited by the existing sent-plan rule.
8. For a separate unsent approved plan with a selected material, mark that material Obsolete. Sending must fail without emailing it. Revise the plan, remove/replace the material, and approve the revised plan before sending.
9. As Counselor-User, check permitted PDF previews and the material selector. Direct upload, metadata/status PATCH and replacement management requests must still return 403. An unassigned counselor must not send another counselor's plan.
10. Try manually submitting a Reference URL, a malformed Knowledge Base ID or a Reference disguised as a Link. The backend must reject it. Check a legitimate counselor-uploaded case PDF still works through its existing workflow.
11. Test replacement with a valid updated PDF and with an ingestion failure. Successful activation keeps both versions, makes the predecessor Obsolete and links the records. A failed replacement leaves the predecessor eligible.

## Files changed for classification finalization

Created:
- `backend/services/knowledgeAttachments.js`
- `backend/scripts/migrateReviewedResourceType.js`
- `backend/scripts/verifyKnowledgePipeline.js`
- `backend/tests/resourceClassification.test.js`
- `backend/tests/fixtures/academic-stress-worksheet.pdf`
- `frontend/src/components/KnowledgeMaterialSelector.jsx`

Updated:
- `backend/models/knowledgeResource.js`
- `backend/controllers/knowledgeBaseController.js`
- `backend/controllers/caseController.js`
- `backend/routes/knowledgeBaseRoutes.js`
- `backend/services/resourceEligibility.js`
- `backend/services/resourceLifecycle.js`
- `backend/services/interventionAttachments.js`
- `backend/services/rag/knowledgeIngestionService.js`
- `backend/services/rag/retrievalService.js`
- `backend/services/rag/interventionRecommendationService.js`
- `backend/services/rag/promptBuilderService.js`
- `backend/tests/caseRecommendationLogic.test.js`
- `backend/tests/interventionAttachments.test.js`
- `backend/tests/resourceLifecycle.test.js`
- `frontend/src/pages/KnowledgeBasePage.jsx`
- `frontend/src/pages/InterventionPlansPage.jsx`
- `docs/knowledge-resource-lifecycle.md`

## Remaining limits

Replacement activation uses MongoDB transactions. PDF uploads still run synchronously. A process crash during ingestion can leave Processing records and a replacement lock; after verifying no work is running, an operator must mark the unfinished new record Failed and clear only its predecessor's matching lock. A durable worker/automatic crash recovery is not implemented.

Vector post-filtering can return fewer results when many top candidates are ineligible. Historical recommendations remain stored. A status change cannot retract a prompt already sent to Ollama, but eligibility is rechecked after generation before accepting its result. External email delivery and browser interaction still require the manual tests above.
