import { Link } from "react-router-dom";

const histories = [
  ["psychiatricCareHistory", "Psychiatric care"],
  ["psychologicalTherapyHistory", "Psychological therapy"],
  ["previousCounselingHistory", "Previous counseling"],
  ["medicalHistory", "Medical history"],
  ["familyMentalHealthHistory", "Family mental health"],
  ["substanceUseHistory", "Substance use"],
  ["legalHistory", "Legal history"],
];
const time = (value) =>
  value
    ? new Date(value).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not recorded";
const text = (value) => value?.trim() || "Not supplied";

function IntakeText({ value, className = "" }) {
  const paragraphs = text(value).split(/\r?\n[\t ]*\r?\n/);
  return (
    <div className={`w-full max-w-none space-y-4 ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className="w-full max-w-none whitespace-normal break-words text-sm leading-7 text-stone-600"
        >
          {paragraph.replace(/\r?\n/g, " ")}
        </p>
      ))}
    </div>
  );
}

function Narrative({ title, children }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h3 className="text-base font-semibold text-stone-800">{title}</h3>
      <IntakeText value={children} className="mt-3" />
    </section>
  );
}

export default function IntakeReview({ intake, busy, onClose, onConfirm }) {
  const student = intake.identity;
  const background = intake.backgroundAndPsychosocialHistory || {};
  const family = background.familyConstellation || [];
  const caseId = intake.linkedCase?._id || intake.linkedCase;
  return (
    <section
      aria-labelledby="intake-review-title"
      className="w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
    >
      <header className="border-b border-stone-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8C1518]">
              Confidential
            </p>
            <h2 id="intake-review-title" className="text-xl font-semibold sm:text-2xl">
              Intake review
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              Review the submitted information before confirming the case.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium hover:bg-stone-50"
          >
            Close
          </button>
        </div>
        <div className="mt-6 rounded-xl bg-stone-50 p-5">
          <h3 className="text-lg font-semibold">
            {student.firstName} {student.lastName}
          </h3>
          <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Student ID", student.studentIdNumber],
              ["College", student.college],
              ["Email", student.email],
              ["Entry type", intake.entryType],
              ["Status", intake.status],
              ["Consent accepted", time(intake.consent?.consentDate)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-medium text-stone-500">{label}</dt>
                <dd className="mt-1 break-words font-medium text-stone-800">
                  {value || "Not supplied"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </header>
      <div className="space-y-5 bg-stone-50/60 p-5">
        <Narrative title="Family context">{background.familyContext}</Narrative>
        <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="p-5">
            <h3 className="text-base font-semibold">Family constellation</h3>
          </div>
          {family.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-stone-200 bg-stone-50 text-xs text-stone-500">
                  <tr>
                    {[
                      "Name",
                      "Relationship",
                      "Age",
                      "Parent type",
                      "Significant person",
                      "Remarks",
                    ].map((label) => (
                      <th key={label} className="p-5 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {family.map((member, index) => (
                    <tr key={member._id || index} className="align-top">
                      <td className="p-5 font-medium">{member.name}</td>
                      <td className="p-5">{member.relationship}</td>
                      <td className="p-5">{member.age ?? "—"}</td>
                      <td className="p-5">{member.parentType || "—"}</td>
                      <td className="p-5">{member.isSignificantPerson ? "Yes" : "No"}</td>
                      <td className="min-w-40 whitespace-pre-wrap p-5 text-stone-600">
                        {member.remarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 pb-5 text-sm text-stone-500">No family members supplied.</p>
          )}
          <div className="border-t border-stone-200 p-5">
            <h4 className="text-sm font-semibold">Additional family comments</h4>
            <IntakeText value={background.familyConstellationComments} className="mt-2" />
          </div>
        </section>
        <Narrative title="Academic context">{background.academicContext}</Narrative>
        <Narrative title="Peer and social context">{background.peerSocialContext}</Narrative>
        <section aria-labelledby="intake-history-title">
          <h3 id="intake-history-title" className="mb-3 text-base font-semibold">
            Relevant history
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {histories.map(([key, label]) => {
              const history = background[key];
              return (
                <section key={key} className="rounded-xl border border-stone-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-semibold">{label}</h4>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${history?.hasHistory ? "bg-amber-50 text-amber-800" : "bg-stone-100 text-stone-600"}`}
                    >
                      {history
                        ? history.hasHistory
                          ? "Reported"
                          : "Not reported"
                        : "Not supplied"}
                    </span>
                  </div>
                  {history?.description?.trim() && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-stone-600">
                      {history.description}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </div>
      {(caseId || intake.status === "Pending Review") && (
        <footer className="flex justify-end border-t border-stone-200 p-5">
          {caseId ? (
            <Link
              to={`/cases/${caseId}`}
              className="rounded-lg bg-[#8C1518] px-5 py-3 text-sm font-semibold text-white"
            >
              Open linked case
            </Link>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="w-full rounded-lg bg-[#8C1518] px-5 py-3 text-sm font-semibold text-white hover:bg-[#701013] disabled:opacity-50 sm:w-auto"
            >
              {busy ? "Creating case…" : "Confirm and create case"}
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
