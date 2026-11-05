# Optional counselor notes

In New Case, the **Counselor’s notes (optional)** button below Case summary expands a free-text field. It is optional, accepts up to 20,000 characters, and does not count toward the required section progress. Closing the disclosure keeps entered notes. Notes are saved only when the counselor creates the case, for both referred cases and cases prepared from an intake.

The case stores the original text in `counselorNotes`. Existing cases default to an empty string; no database migration is needed. Notes remain under the existing permanent case-ownership controls, and are not added to the shared intake queue.

The Formulation tab displays saved notes. **Generate AI drafts** produces a separate `caseFormulation.counselorNotesSummary` draft when notes exist. Counselors review and choose whether to save that summary. Without notes, the existing three-field formulation flow is unchanged. Updating the raw notes clears the previous notes summary to prevent reuse of stale summaries.

Initial and updated intervention recommendations receive the original notes as separately labeled case context. They also inform retrieval queries. Notes are treated as data, preserve uncertainty, and do not replace retrieved evidence for proposed interventions. Student narrative and mental-status summaries remain separate.

Checks:

```sh
cd backend
node --test tests/counselorNotes.test.js tests/formulationSummary.test.js tests/bookingWorkflow.test.js tests/caseFormulation.test.js tests/caseRecommendationLogic.test.js tests/progressGenerationFlow.test.js
BOOKING_INTEGRATION=1 node --test tests/bookingIntegration.test.js
```

The opt-in integration test uses an isolated temporary database on the configured local MongoDB and removes it afterward. It verifies notes persistence through intake conversion, saving a reviewed notes summary, and clearing a stale summary after notes change. AI tests use fixture responses; they do not call the live model.
