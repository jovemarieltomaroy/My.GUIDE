import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "react-router-dom";

import myGuideLogo from "../assets/myguide-logo.png";
import ConsentFormModal from "../components/ConsentFormModal";

import { apiRequest } from "../config/api";

const EMPTY_MEMBER = {
  name: "",
  age: "",
  relationship: "",
  parentType: "Not Applicable",
  isSignificantPerson: false,
  remarks: "",
};

const EMPTY_HISTORY = {
  hasHistory: false,
  description: "",
};

const INITIAL_FORM = {
  consent: {
    hasConsent: false,
    confidentialityAgreementAccepted: false,
    dataPrivacyNoticeAccepted: false,
  },

  backgroundAndPsychosocialHistory: {
    familyContext: "",

    familyConstellation: [
      { ...EMPTY_MEMBER },
    ],

    familyConstellationComments: "",

    academicContext: "",

    peerSocialContext: "",

    psychiatricCareHistory: {
      ...EMPTY_HISTORY,
    },

    psychologicalTherapyHistory: {
      ...EMPTY_HISTORY,
    },

    previousCounselingHistory: {
      ...EMPTY_HISTORY,
    },

    medicalHistory: {
      ...EMPTY_HISTORY,
    },

    familyMentalHealthHistory: {
      ...EMPTY_HISTORY,
    },

    substanceUseHistory: {
      ...EMPTY_HISTORY,
    },

    legalHistory: {
      ...EMPTY_HISTORY,
    },
  },
};

const HISTORY_FIELDS = [
  [
    "psychiatricCareHistory",
    "Psychiatric care history",
  ],
  [
    "psychologicalTherapyHistory",
    "Psychological therapy history",
  ],
  [
    "previousCounselingHistory",
    "Previous counseling history",
  ],
  [
    "medicalHistory",
    "Medical history",
  ],
  [
    "familyMentalHealthHistory",
    "Family mental-health history",
  ],
  [
    "substanceUseHistory",
    "Substance-use history",
  ],
  [
    "legalHistory",
    "Legal history",
  ],
];

const PARENT_TYPES = [
  "Biological",
  "Adoptive",
  "Step-parent",
  "Foster",
  "Guardian",
  "Not Applicable",
];

export default function PreCounselingFormPage() {
  const { token } = useParams();
  const [consentModalOpen, setConsentModalOpen] = useState(false);

  const [student, setStudent] =
    useState(null);

  const [formData, setFormData] =
    useState(INITIAL_FORM);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [loadError, setLoadError] =
    useState("");

  const [submitError, setSubmitError] =
    useState("");

  const [submitted, setSubmitted] =
    useState(false);

  const [expiresAt, setExpiresAt] =
    useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadForm = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const data = await apiRequest(
          `/pre-counseling/public/${token}`,
          {
            method: "GET",
          },
        );

        if (cancelled) {
          return;
        }

        setStudent(data?.student || null);

        setExpiresAt(
          data?.tokenExpiresAt ||
            data?.expiresAt ||
            null,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadError(
          error.message ||
            "Unable to open this pre-counseling form.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    if (token) {
      loadForm();
    } else {
      setLoadError(
        "The pre-counseling link is invalid.",
      );

      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  const updateConsent = (
    field,
    value,
  ) => {
    setFormData((current) => ({
      ...current,

      consent: {
        ...current.consent,
        [field]: value,
      },
    }));
  };

  const updateBackground = (
    field,
    value,
  ) => {
    setFormData((current) => ({
      ...current,

      backgroundAndPsychosocialHistory: {
        ...current.backgroundAndPsychosocialHistory,
        [field]: value,
      },
    }));
  };

  const updateHistory = (
    field,
    value,
  ) => {
    setFormData((current) => ({
      ...current,

      backgroundAndPsychosocialHistory: {
        ...current.backgroundAndPsychosocialHistory,

        [field]: {
          ...current
            .backgroundAndPsychosocialHistory[
              field
            ],

          ...value,
        },
      },
    }));
  };

  const updateFamilyMember = (
    index,
    field,
    value,
  ) => {
    setFormData((current) => ({
      ...current,

      backgroundAndPsychosocialHistory: {
        ...current.backgroundAndPsychosocialHistory,

        familyConstellation:
          current.backgroundAndPsychosocialHistory
            .familyConstellation.map(
              (member, memberIndex) =>
                memberIndex === index
                  ? {
                      ...member,
                      [field]: value,
                    }
                  : member,
            ),
      },
    }));
  };

  const addFamilyMember = () => {
    setFormData((current) => ({
      ...current,

      backgroundAndPsychosocialHistory: {
        ...current.backgroundAndPsychosocialHistory,

        familyConstellation: [
          ...current
            .backgroundAndPsychosocialHistory
            .familyConstellation,

          { ...EMPTY_MEMBER },
        ],
      },
    }));
  };

  const removeFamilyMember = (
    index,
  ) => {
    setFormData((current) => {
      const currentMembers =
        current
          .backgroundAndPsychosocialHistory
          .familyConstellation;

      const nextMembers =
        currentMembers.filter(
          (_, memberIndex) =>
            memberIndex !== index,
        );

      return {
        ...current,

        backgroundAndPsychosocialHistory: {
          ...current.backgroundAndPsychosocialHistory,

          familyConstellation:
            nextMembers.length
              ? nextMembers
              : [{ ...EMPTY_MEMBER }],
        },
      };
    });
  };

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();

    setSubmitError("");

    const consent = formData.consent;

    if (
      !consent.hasConsent ||
      !consent.confidentialityAgreementAccepted ||
      !consent.dataPrivacyNoticeAccepted
    ) {
      setSubmitError(
        "Please review and accept all consent, confidentiality, and data privacy items before submitting.",
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    const familyMembers =
      formData
        .backgroundAndPsychosocialHistory
        .familyConstellation.filter(
          (member) =>
            member.name.trim() ||
            member.relationship.trim(),
        );

    for (const member of familyMembers) {
      if (
        !member.name.trim() ||
        !member.relationship.trim()
      ) {
        setSubmitError(
          "Each family member must have both a name and relationship.",
        );

        return;
      }

      if (
        member.age !== "" &&
        Number(member.age) < 0
      ) {
        setSubmitError(
          "Family member age cannot be negative.",
        );

        return;
      }
    }

    setIsSubmitting(true);

    try {
      const background =
        formData.backgroundAndPsychosocialHistory;

      await apiRequest(
        `/pre-counseling/public/${token}/submit`,
        {
          method: "POST",

          body: JSON.stringify({
            consent: {
              ...formData.consent,
            },

            backgroundAndPsychosocialHistory: {
              ...background,

              familyConstellation:
                familyMembers.map(
                  (member) => ({
                    ...member,

                    age:
                      member.age === ""
                        ? undefined
                        : Number(
                            member.age,
                          ),
                  }),
                ),
            },
          }),
        },
      );

      setSubmitted(true);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      setSubmitError(
        error.message ||
          "Unable to submit the pre-counseling form.",
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="py-20 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E6D5D5] border-t-[#8C1518]" />

          <p className="mt-4 text-[15px] text-[#756D69]">
            Opening your pre-counseling form...
          </p>
        </div>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell>
        <StatusCard
          title="Unable to open form"
          description={loadError}
        />
      </PageShell>
    );
  }

  if (submitted) {
    return (
      <PageShell>
        <div className="mx-auto max-w-2xl py-10">
          <div className="rounded-2xl border border-emerald-200 bg-white p-7 text-center shadow-sm">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl text-emerald-700">
              ✓
            </div>

            <h1 className="mt-5 text-[24px] font-semibold text-[#302B28]">
              Form submitted
            </h1>

            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-6 text-[#756D69]">
              Your pre-counseling information
              has been submitted successfully.
              Your counselor will review the
              information before or during your
              counseling session.
            </p>

            <p className="mt-5 text-[14px] text-[#918984]">
              You may now close this page.
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl py-7">
        <header className="mb-5 rounded-2xl border border-[#E5DFDB] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#8C1518]">
            MSU-IIT Office of Guidance and
            Counseling
          </p>

          <h1 className="mt-2 text-[25px] font-semibold tracking-[-0.02em] text-[#302B28]">
            Pre-Counseling Information Form
          </h1>

          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-[#756D69]">
            Please provide the information below
            before your counseling session. Your
            responses will help your counselor
            understand relevant background
            information before meeting with you.
          </p>

          {student && (
            <div className="mt-5 grid gap-3 rounded-xl border border-[#E8E2DE] bg-[#FAF9F8] p-4 sm:grid-cols-2">
              <StudentDetail
                label="Student"
                value={formatStudentName(
                  student,
                )}
              />

              <StudentDetail
                label="Student ID"
                value={
                  student.studentIdNumber
                }
              />

              <StudentDetail
                label="College"
                value={student.college}
              />

              <StudentDetail
                label="Program"
                value={student.program}
              />
            </div>
          )}

          {expiresAt && (
            <p className="mt-3 text-[12px] text-[#9A928D]">
              This secure form link expires on{" "}
              {formatDateTime(expiresAt)}.
            </p>
          )}
        </header>

        {submitError && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] leading-5 text-red-700">
            {submitError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <FormSection
            number="1"
            title="Consent and privacy"
            description="Please review and confirm each item before continuing."
          >
            <div className="mb-4">
              <button type="button" onClick={() => setConsentModalOpen(true)} className="text-[14px] font-semibold text-[#8C1518] underline underline-offset-4">
                View consent form
              </button>
              <p className="mt-2 text-[13px] text-[#817A76]">Read the full consent form before confirming the acknowledgments below.</p>
            </div>
            <div className="space-y-3">
              <ConsentItem
                checked={
                  formData.consent
                    .hasConsent
                }
                onChange={(value) =>
                  updateConsent(
                    "hasConsent",
                    value,
                  )
                }
                title="Counseling consent"
                description="I voluntarily agree to participate in counseling services provided by the Office of Guidance and Counseling."
              />

              <ConsentItem
                checked={
                  formData.consent
                    .confidentialityAgreementAccepted
                }
                onChange={(value) =>
                  updateConsent(
                    "confidentialityAgreementAccepted",
                    value,
                  )
                }
                title="Confidentiality agreement"
                description="I understand that information shared during counseling is treated confidentially, subject to applicable professional, legal, and safety limitations."
              />

              <ConsentItem
                checked={
                  formData.consent
                    .dataPrivacyNoticeAccepted
                }
                onChange={(value) =>
                  updateConsent(
                    "dataPrivacyNoticeAccepted",
                    value,
                  )
                }
                title="Data privacy notice"
                description="I acknowledge that the information I provide will be recorded and used by the Office of Guidance and Counseling for counseling and case-management purposes."
              />
            </div>
          </FormSection>

          <FormSection
            number="2"
            title="Family context"
            description="Provide relevant information about your family situation and significant people in your life."
          >
            <Field
              label="Family context"
              hint="You may briefly describe your current family situation, relationships, living arrangement, or other family circumstances that may be relevant."
            >
              <textarea
                rows={4}
                value={
                  formData
                    .backgroundAndPsychosocialHistory
                    .familyContext
                }
                onChange={(event) =>
                  updateBackground(
                    "familyContext",
                    event.target.value,
                  )
                }
                className={textareaClass}
              />
            </Field>

            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#403A36]">
                    Family constellation
                  </h3>

                  <p className="mt-1 text-[13px] text-[#8B837E]">
                    Add family members or other
                    significant people relevant to
                    your situation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addFamilyMember}
                  className="h-8 rounded-lg border border-[#D8D1CD] bg-white px-3 text-[14px] font-semibold text-[#5E5753] hover:border-[#8C1518] hover:text-[#8C1518]"
                >
                  + Add member
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {formData
                  .backgroundAndPsychosocialHistory
                  .familyConstellation.map(
                    (member, index) => (
                      <FamilyMemberCard
                        key={index}
                        index={index}
                        member={member}
                        canRemove={
                          formData
                            .backgroundAndPsychosocialHistory
                            .familyConstellation
                            .length > 1
                        }
                        onChange={(
                          field,
                          value,
                        ) =>
                          updateFamilyMember(
                            index,
                            field,
                            value,
                          )
                        }
                        onRemove={() =>
                          removeFamilyMember(
                            index,
                          )
                        }
                      />
                    ),
                  )}
              </div>
            </div>

            <div className="mt-5">
              <Field
                label="Family constellation comments"
                hint="Add any other information about your family or significant relationships that may be helpful."
              >
                <textarea
                  rows={3}
                  value={
                    formData
                      .backgroundAndPsychosocialHistory
                      .familyConstellationComments
                  }
                  onChange={(event) =>
                    updateBackground(
                      "familyConstellationComments",
                      event.target.value,
                    )
                  }
                  className={textareaClass}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            number="3"
            title="Academic and social context"
            description="Share information about your current academic and social situation."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Academic context"
                hint="You may include academic concerns, workload, performance, adjustment, or other school-related circumstances."
              >
                <textarea
                  rows={5}
                  value={
                    formData
                      .backgroundAndPsychosocialHistory
                      .academicContext
                  }
                  onChange={(event) =>
                    updateBackground(
                      "academicContext",
                      event.target.value,
                    )
                  }
                  className={textareaClass}
                />
              </Field>

              <Field
                label="Peer and social context"
                hint="You may include friendships, social support, peer concerns, or other relevant social experiences."
              >
                <textarea
                  rows={5}
                  value={
                    formData
                      .backgroundAndPsychosocialHistory
                      .peerSocialContext
                  }
                  onChange={(event) =>
                    updateBackground(
                      "peerSocialContext",
                      event.target.value,
                    )
                  }
                  className={textareaClass}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            number="4"
            title="Relevant history"
            description="Indicate whether any of the following apply to you. If yes, you may provide a brief description."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {HISTORY_FIELDS.map(
                ([field, label]) => (
                  <HistoryField
                    key={field}
                    label={label}
                    value={
                      formData
                        .backgroundAndPsychosocialHistory[
                        field
                      ]
                    }
                    onChange={(value) =>
                      updateHistory(
                        field,
                        value,
                      )
                    }
                  />
                ),
              )}
            </div>
          </FormSection>

          <section className="rounded-2xl border border-[#E5DFDB] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[15px] font-semibold text-[#403A36]">
                  Ready to submit?
                </p>

                <p className="mt-1 text-[13px] leading-5 text-[#8A827D]">
                  Please review your answers before
                  submitting. The information will
                  be made available to your
                  counselor.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 shrink-0 rounded-xl bg-[#8C1518] px-6 text-[15px] font-semibold text-white transition hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? "Submitting..."
                  : "Submit form"}
              </button>
            </div>
          </section>
        </form>

        <ConsentFormModal open={consentModalOpen} onClose={() => setConsentModalOpen(false)} />

        <footer className="py-8 text-center text-[12px] leading-5 text-[#9A928D]">
          My.GUIDE · Office of Guidance and
          Counseling
        </footer>
      </div>
    </PageShell>
  );
}

function PageShell({
  children,
}) {
  return (
    <main className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#302B28]">
      <div className="border-b border-[#E6E0DC] bg-white">
        <div className="mx-auto flex min-h-[64px] max-w-5xl items-center px-4 py-3 sm:px-6">
          <div>
            <img
              src={myGuideLogo}
              alt="My.GUIDE"
              className="h-14 w-auto object-contain sm:h-16"
            />

            <p className="text-left text-[11px] leading-4 text-[#918984]">
              Guidance, Unified Intervention,
              Documentation, and Evaluation
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6">
        {children}
      </div>
    </main>
  );
}

function FormSection({
  number,
  title,
  description,
  children,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E5DFDB] bg-white shadow-sm">
      <header className="border-b border-[#EEE9E6] px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[14px] font-semibold text-[#8C1518]">
            {number}
          </span>

          <div>
            <h2 className="text-[18px] font-semibold text-[#3B3532]">
              {title}
            </h2>

            <p className="mt-1 text-[13px] leading-5 text-[#8A827D]">
              {description}
            </p>
          </div>
        </div>
      </header>

      <div className="p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

function ConsentItem({
  checked,
  onChange,
  title,
  description,
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E5DFDB] bg-[#FCFBFA] p-4 transition hover:border-[#CDBFBA]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        className="mt-1 h-4 w-4 shrink-0 accent-[#8C1518]"
      />

      <span>
        <span className="block text-[14px] font-semibold text-[#403A36]">
          {title}
        </span>

        <span className="mt-1 block text-[13px] leading-5 text-[#817A76]">
          {description}
        </span>
      </span>
    </label>
  );
}

function FamilyMemberCard({
  index,
  member,
  canRemove,
  onChange,
  onRemove,
}) {
  return (
    <div className="rounded-xl border border-[#E5DFDB] bg-[#FCFBFA] p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[14px] font-semibold text-[#514B47]">
          Family member {index + 1}
        </p>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[13px] font-semibold text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name">
          <input
            value={member.name}
            onChange={(event) =>
              onChange(
                "name",
                event.target.value,
              )
            }
            className={inputClass}
          />
        </Field>

        <Field label="Relationship">
          <input
            value={member.relationship}
            onChange={(event) =>
              onChange(
                "relationship",
                event.target.value,
              )
            }
            placeholder="e.g. Mother"
            className={inputClass}
          />
        </Field>

        <Field label="Age">
          <input
            type="number"
            min="0"
            value={member.age}
            onChange={(event) =>
              onChange(
                "age",
                event.target.value,
              )
            }
            className={inputClass}
          />
        </Field>

        <Field label="Parent type">
          <select
            value={member.parentType}
            onChange={(event) =>
              onChange(
                "parentType",
                event.target.value,
              )
            }
            className={inputClass}
          >
            {PARENT_TYPES.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ),
            )}
          </select>
        </Field>

        <Field label="Significant person">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#DDD8D4] bg-white px-3">
            <input
              type="checkbox"
              checked={
                member.isSignificantPerson
              }
              onChange={(event) =>
                onChange(
                  "isSignificantPerson",
                  event.target.checked,
                )
              }
              className="h-4 w-4 accent-[#8C1518]"
            />

            <span className="text-[13px] text-[#514B47]">
              Mark as significant
            </span>
          </label>
        </Field>

        <Field label="Remarks">
          <input
            value={member.remarks}
            onChange={(event) =>
              onChange(
                "remarks",
                event.target.value,
              )
            }
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}

function HistoryField({
  label,
  value,
  onChange,
}) {
  return (
    <div className="rounded-xl border border-[#E5DFDB] bg-[#FCFBFA] p-4">
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={value.hasHistory}
          onChange={(event) =>
            onChange({
              ...value,
              hasHistory:
                event.target.checked,
            })
          }
          className="h-4 w-4 accent-[#8C1518]"
        />

        <span className="text-[14px] font-semibold text-[#4B4541]">
          {label}
        </span>
      </label>

      {value.hasHistory && (
        <textarea
          rows={3}
          value={value.description}
          onChange={(event) =>
            onChange({
              ...value,
              description:
                event.target.value,
            })
          }
          placeholder="Provide a brief description."
          className={`${textareaClass} mt-3`}
        />
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}) {
  return (
    <label className="block">
      <span className="text-[14px] font-semibold text-[#4B4541]">
        {label}
      </span>

      {hint && (
        <span className="mt-1 block text-[12px] leading-4 text-[#948C87]">
          {hint}
        </span>
      )}

      <div className="mt-2">
        {children}
      </div>
    </label>
  );
}

function StudentDetail({
  label,
  value,
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9A928D]">
        {label}
      </p>

      <p className="mt-1 text-[14px] font-medium text-[#403A36]">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function StatusCard({
  title,
  description,
}) {
  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="rounded-2xl border border-[#E5DFDB] bg-white p-7 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#F4EAEA] text-xl font-semibold text-[#8C1518]">
          !
        </div>

        <h1 className="mt-5 text-[22px] font-semibold text-[#302B28]">
          {title}
        </h1>

        <p className="mt-3 text-[14px] leading-6 text-[#756D69]">
          {description}
        </p>
      </div>
    </div>
  );
}

function formatStudentName(
  student,
) {
  if (!student) {
    return "";
  }

  return [
    student.firstName,
    student.middleName,
    student.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDateTime(
  value,
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(
    "en-PH",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-[#DDD8D4] bg-white px-3 text-[14px] text-[#302B28] outline-none transition placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";

const textareaClass =
  "w-full resize-y rounded-lg border border-[#DDD8D4] bg-white px-3 py-2.5 text-[14px] leading-5 text-[#302B28] outline-none transition placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";