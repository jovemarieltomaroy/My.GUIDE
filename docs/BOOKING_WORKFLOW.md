# Counseling intake and booking workflow

Walk-in and scheduled students use the same `/booking` page. During local development, counselors open it using **Open student booking form** in Intakes & Bookings. The QR and invitation controls are currently hidden. Existing pending private pre-counseling links still open the new booking form; those links expire after seven days and are consumed on submission.

Each submission creates a distinct intake, even when the student ID is the same. Self-reported student information remains in the intake until the handling counselor verifies it and confirms case creation. Existing student profiles are never overwritten from a public form. A mismatched saved email or archived student blocks conversion for staff review.

## Routing and review

- College is the default slot filter, using counselors' existing default colleges. Students may show all colleges or submit to the shared queue.
- Shared requests show college, entry type, requested time, reference, and status. Confidential responses and student identifiers are only visible after assignment.
- An accepting counselor chooses an available slot from their own calendar. Only one counselor can accept a request.
- A published slot booked directly assigns its counselor. The intake remains **Pending Review** until that counselor explicitly chooses **Accept and Create Case**.
- The review panel ends with one **Confirm and create case** button. The button opens `/cases/new?intakeId=...`, prefilling student information, consent, and background from that exact intake. No case or new student record is created at this stage. The counselor completes and reviews the form, then selects **Create case** to save and link it atomically. Presenting concern and assessment are required. If the submitted email differs from the saved student profile, the counselor must explicitly verify identity; the saved profile is preserved.
- If the student already has an active case, the handling counselor can explicitly link the intake to an active case they own. Previous case notes and background are preserved; the submitted intake remains separately accessible.
- Walk-in and scheduled cases use this workflow. **New Case** retains direct creation for referrals.

Intake statuses: Awaiting Submission, Pending Review, Converted to Case, Declined, Cancelled.
Appointment statuses: Unassigned, Booked, Completed, Cancelled, Needs Rescheduling.

## Availability and calendars

Counselors manage their own dated availability, bookable slots, blocked times, and monthly calendar. Counselor Admin can manage every counselor through **Counselor Availability**, without account administration permissions. Times are entered and displayed in Asia/Manila (UTC+08:00).

Counselors receive automatic one-hour weekday slots for the next 90 days: 8 AM–5 PM, Philippine time, including noon. Counselors without an unavailable status are available by default. The calendar shows available times in green and blocked or unavailable times in red. No manual setup is required. Existing custom or blocked intervals are preserved; new default slots never overlap them. Extra slots can be added outside existing calendar intervals. The system rejects overlapping slots and concurrent reservations. Leave and blocked time flag existing bookings as **Needs Rescheduling** instead of cancelling them. Reservations remain held until explicitly moved, cancelled, or completed.

Counselor Admin can reassign a pending appointment to another counselor's free slot. Once an intake has become a case, transfer the official case through **Case assignments**, then schedule it with the new handler. A case transfer also transfers its intake access, releases old appointment reservations, revokes temporary grants, and records the transfer. The former counselor loses access.

The student directory spans colleges. Clinical case lists and details follow permanent case assignment. Counselor Admin's assignment view exposes only routing metadata. System Admin retains account management.

## Database and local setup

Booking and conversion use MongoDB transactions and partial unique indexes. **MongoDB must be a replica set or a sharded deployment**, including local development. A standalone MongoDB cannot safely run this workflow. MongoDB Atlas works; a local development server needs a configured replica set. This change does not alter your MongoDB service, credentials, `.env`, or existing database.

At startup the backend waits for the User, CaseRecord, CounselingIntake, and CounselorSlot indexes before accepting requests. Deployments with automatic index creation disabled must create these model indexes during deployment. New collections are `counselingintakes` and `counselorslots`.

For access from other devices, configure a frontend URL reachable from those devices. A localhost URL only works on the same device.

Previously submitted, unused forms can be added to the intake queue with the additive, idempotent migration. Run from `backend`:

```sh
node scripts/migratePreCounselingIntakes.js          # dry run
node scripts/migratePreCounselingIntakes.js --apply  # creates intake records; preserves original forms
```

The migration skips archived/missing students and profiles without a college. Existing forms already linked to cases are left untouched. Old student-based import and send endpoints return instructions to use Intakes & Bookings.

## Verification

```sh
cd backend
node --test tests/defaultBookingSlots.test.js tests/bookingWorkflow.test.js tests/preCounselingImport.test.js tests/caseFormulation.test.js tests/cleanAdministration.test.js
cd ../frontend
npm run build
```

The booking tests validate real Mongoose models and exercise handlers with mocked persistence. They check ownership, explicit consent, field allowlisting, slot conflicts, exact intake conversion, and idempotent conversion. The opt-in replica-set test creates a unique temporary local test database and removes it afterward:

```sh
cd backend
BOOKING_INTEGRATION=1 node --test tests/bookingIntegration.test.js
```

This verifies competing acceptance, duplicate slot reservation, conversion, absence flags, and case ownership transfer using real transactions. It does not send emails or exercise a browser. The configured local MongoDB was confirmed to support replica-set transactions during implementation.

For a connected acceptance check: open the calendar to populate default weekday slots; submit a walk-in through `/booking`; accept it from a second college; verify that another counselor cannot read its responses; create a case; retry conversion; mark the handler on leave and reschedule; transfer the case and confirm that the former handler loses access.

## Permanent transfers

The handling counselor or Counselor Admin can permanently transfer a case to another active counselor using **Transfer case**. There are no expiration dates and no automatic return to the original counselor. The previous counselor immediately loses case, attachment, and intake access. Ownership transfer and intake updates occur in one transaction; the transfer is recorded in case history. Appointment reservations are released and flagged for rescheduling with the receiving counselor.

Temporary grants are retired: the old grant/revoke endpoints return HTTP 410, the old temporary list returns no cases, and legacy grants no longer authorize access. Historical grant records are preserved for audit purposes.

## Shared queue when a counselor is unavailable

Marking a counselor Absent, On Leave, or Unavailable returns affected reserved, pending intakes without a linked case to the shared queue. Blocking a booked calendar slot does the same. The release clears the assigned counselor and reservation, retains the original slot for its appointment time, and records the change in intake history. Availability must be recorded in the system for this to happen.

Any active counselor, regardless of college, can accept the request into a free, available slot on their own calendar. The existing transactional acceptance prevents two counselors from claiming the same request. Only the accepting counselor can then read the confidential intake responses. Returning the original counselor to Available does not reclaim released requests.

Bookings already linked to official cases retain their assignment and are flagged for rescheduling; use the existing case transfer controls to change their handling counselor.


## Optional student-identity autofill on the public booking form

On `/booking`, enter a student ID and press Enter or **Find my details**. A six-digit verification code is sent to the active student record's saved email. The response does not disclose whether the ID exists or reveal the destination email. Students without an accessible saved email can continue entering their details manually.

Enter the code, confirm the displayed first/last name, then choose **Yes, fill in my details**. Only student ID, first name, last name, email, college, program, contact number and year level are copied. Every copied field remains editable. Entry type, slot selection, preferred time, the all-colleges checkbox, consent and intake answers are not filled or reset. Rejecting the name does not overwrite manually entered fields. Autofill is read-only and does not update the master Student document; normal intake submission and counselor review remain unchanged. Existing private invitation links retain their existing behavior.

Backend endpoints under `/api/bookings/public/student-identity`: `POST /request`, `/verify`, `/confirm`. Requests use `studentIdNumber`; verification additionally uses the opaque `challenge` and six-digit `code`; confirmation uses the opaque `confirmationToken`. Saved contact fields are returned only by the final confirmation endpoint after email verification. Codes expire after ten minutes, permit five guesses per challenge, and cannot be reused. Confirmation grants are single-use. Expiry is enforced in database queries, even before MongoDB TTL cleanup. The `BookingIdentityChallenge` collection stores keyed code hashes, opaque token hashes, a student reference and short-lived request metadata. Quotas are three requests per student ID and ten per IP in ten minutes. The request quotas use database counts and are best-effort under simultaneous requests; a deployment-level request limiter may additionally be used for larger public deployments.

Uses the existing `JWT_SECRET`, `EMAIL_USER`, and `EMAIL_APP_PASSWORD` configuration and email transporter. Restart the backend after deployment so the new route/model are loaded. Working outbound SMTP is required; no new environment variables or dependencies. Delivery failures are logged without revealing student details in public responses. No actual student email was sent during implementation testing.

Validation: 19 backend verification/booking tests pass, targeted frontend lint passes and production frontend build passes. An isolated Chrome test with synthetic endpoint responses verified Enter lookup, no autofill before either verification or name confirmation, editable copied fields, unchanged Entry type/all-colleges selection and rejection preserving current entries. Live SMTP delivery and persistent MongoDB verification should be checked with a designated test student in the deployed environment.
