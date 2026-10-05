import LLMRecommendationsPage from "./LLMRecommendationsPage";
import {
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import ConsentFormModal from "../components/ConsentFormModal";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const CLIENT_ENTRY_TYPES = ["Walk-in", "Referred", "Scheduled"];

const COLLEGES = [
  "College of Engineering",
  "College of Science and Mathematics",
  "College of Computer Studies",
  "College of Education",
  "College of Arts and Social Sciences",
  "College of Economics, Business and Accountancy",
  "College of Health Sciences",
];

const YEAR_LEVELS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "Graduate",
  "Other",
];

const MAIN_DOMAINS = [
  "Academic-Educational",
  "Career-Vocational",
  "Personal-Social",
  "Other",
];

const INTENSITY_LEVELS = [
  "Mild",
  "Moderate",
  "Severe",
];

const EMPTY_FORM = {
  student: "",
  studentIdNumber: "",
  assignedCounselor: "",
  clientEntryType: "Walk-in",

  temporaryStudent: {
    isTemporary: false,
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    college: "",
    program: "",
    yearLevel: "",
  },

  consent: {
    hasConsent: false,
    confidentialityAgreementAccepted: false,
    dataPrivacyNoticeAccepted: false,
  },

  referralInformation: {
    referralSource: "Faculty-Referred",
    referredBy: "",
    referralQuestion: "",
  },

  currentPresentation: {
    narrativeDescription: "",
    behavioralObservations: "",
    onset: "",
    duration: "",
    frequency: "",
    intensity: "Moderate",
  },

  problemAssessment: {
    mainDomain: "Personal-Social",
    primaryProblems: [""],
    secondaryProblems: [""],
  },

  backgroundAndPsychosocialHistory: {
    familyContext: "",
    familyConstellation: [
      {
        name: "",
        age: "",
        relationship: "",
        parentType: "Not Applicable",
        isSignificantPerson: false,
        remarks: "",
      },
    ],
    familyConstellationComments: "",
    academicContext: "",
    peerSocialContext: "",
    psychiatricCareHistory: {
      hasHistory: false,
      description: "",
    },
    psychologicalTherapyHistory: {
      hasHistory: false,
      description: "",
    },
    previousCounselingHistory: {
      hasHistory: false,
      description: "",
    },
    medicalHistory: {
      hasHistory: false,
      description: "",
    },
    familyMentalHealthHistory: {
      hasHistory: false,
      description: "",
    },
    substanceUseHistory: {
      hasHistory: false,
      description: "",
    },
    legalHistory: {
      hasHistory: false,
      description: "",
    },
  },

  mentalStatus: {
    grooming: "",
    attire: "",
    physicalPresentation: "",
    eyeContact: "",
    activityLevel: "",
    speechRate: "",
    speechVolume: "",
    speechFluency: "",
    speechArticulation: "",
    speech: "",
    moodAndAffect: "",
    thoughtProcess: "",
    orientation: "",
    attentionAndConcentration: "",
    riskIndicators: "",
  },

  caseFormulation: {},

};

export default function NewCasePage() {
  const navigate = useNavigate();
  const {
    user,
    clearUser,
  } = useAuth();

  const studentSelectionVersion = useRef(0);
  const [createdCaseId, setCreatedCaseId] = useState(null);
  const [isCheckingExistingCase, setIsCheckingExistingCase] = useState(false);
  const [existingCaseCheck, setExistingCaseCheck] = useState(null);
  const [existingCaseError, setExistingCaseError] = useState("");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [consentModalOpen, setConsentModalOpen] =
    useState(false);

  const [formData, setFormData] =
    useState(EMPTY_FORM);

  const [selectedStudent, setSelectedStudent] =
    useState(null);

  const [studentInfoModalOpen, setStudentInfoModalOpen] =
    useState(false);

  const [studentNotFound, setStudentNotFound] =
    useState(false);

  const [isSearchingStudent, setIsSearchingStudent] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errors, setErrors] =
    useState({});

  const [pageError, setPageError] =
    useState("");

  const [preCounselingForm, setPreCounselingForm] =
    useState(null);

  const [isCheckingPreCounseling, setIsCheckingPreCounseling] =
    useState(false);

  const [isSendingPreCounseling, setIsSendingPreCounseling] =
    useState(false);

  const [preCounselingSentStudentId, setPreCounselingSentStudentId] =
    useState(null);

  const [preCounselingMessage, setPreCounselingMessage] =
    useState("");

  const [activeSection, setActiveSection] =
    useState("student");

  useEffect(() => {
    if (createdCaseId) {
      document.getElementById("new-case-recommendations")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [createdCaseId]);

  const completedSections = useMemo(() => {
    return {
      student:
        (Boolean(formData.student) ||
          (formData.temporaryStudent.isTemporary &&
            Boolean(formData.temporaryStudent.firstName.trim()) &&
            Boolean(formData.temporaryStudent.lastName.trim()) &&
            Boolean(formData.temporaryStudent.email.trim()))) &&
        Boolean(formData.assignedCounselor),

      consent:
        formData.clientEntryType === "Scheduled" ||
        (formData.consent.hasConsent &&
          formData.consent.confidentialityAgreementAccepted &&
          formData.consent.dataPrivacyNoticeAccepted),

      assessment:
        Boolean(
          formData.problemAssessment.primaryProblems.some((item) => item.trim()),
        ),

    };
  }, [formData]);

  useEffect(() => {
    if (!user) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    if (user.mustChangePassword === true) {
      navigate("/change-password", {
        replace: true,
      });

      return;
    }

    if (user.profileCompleted === false) {
      navigate("/complete-profile", {
        replace: true,
      });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormData((current) => ({
      ...current,
      assignedCounselor:
        user._id || user.id || "",
    }));
  }, [user]);

  if (!user) {
    return null;
  }

  const updateNested = (
    section,
    field,
    value,
  ) => {
    setFormData((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));

    clearFieldError(
      `section.{field}`,
    );
  };

  const clearFieldError = (
    field,
  ) => {
    setErrors((current) => ({
      ...current,
      [field]: "",
      general: "",
    }));
  };

  const cancelStudentSelection = () => {
    studentSelectionVersion.current += 1;
    setStudentInfoModalOpen(false);
    setSelectedStudent(null);
    setStudentNotFound(false);
    setExistingCaseCheck(null);
    setExistingCaseError("");
    setIsCheckingExistingCase(false);
    setPreCounselingForm(null);
    setPreCounselingMessage("");
    setFormData((current) => ({
      ...current,
      student: "",
      studentIdNumber: "",
      temporaryStudent: { ...EMPTY_FORM.temporaryStudent },
    }));
    setActiveSection("student");
  };

  const searchStudentByIdNumber = async () => {
    setExistingCaseCheck(null);
    setExistingCaseError("");
    const normalizedStudentId =
      formData.studentIdNumber
        .replace(/[^0-9-]/g, "")
        .trim();

    if (!normalizedStudentId) {
      setErrors((current) => ({
        ...current,
        studentIdNumber:
          "Enter the student ID number.",
      }));
      return;
    }

    studentSelectionVersion.current += 1;
    setFormData((current) => ({ ...current, student: "", temporaryStudent: { ...EMPTY_FORM.temporaryStudent } }));
    setIsSearchingStudent(true);
    setSelectedStudent(null);
    setStudentNotFound(false);
    setErrors((current) => ({
      ...current,
      student: "",
      studentIdNumber: "",
      general: "",
    }));

    try {
      const data = await apiRequest(
        `/students/search/${encodeURIComponent(
          normalizedStudentId,
        )}`,
        {
          method: "GET",
        },
      );

      const student =
        data?.student || data;

      const studentMongoId =
        student?._id || student?.id;

      if (!studentMongoId) {
        throw new Error(
          "The backend did not return a valid student record.",
        );
      }

      setExistingCaseCheck(null);
      setExistingCaseError("");
      setSelectedStudent(student);
      setStudentNotFound(false);
      setStudentInfoModalOpen(true);

      setFormData((current) => ({
        ...current,
        student: "",
        studentIdNumber:
          student.studentIdNumber ||
          normalizedStudentId,
      }));

    } catch (error) {
      console.error(
        "Student lookup error:",
        error,
      );

      if (error.status === 404 || /not found/i.test(error.message || "")) {
        setStudentNotFound(true);
        setFormData((current) => ({
          ...current,
          student: "",
          temporaryStudent: {
            ...current.temporaryStudent,
            isTemporary: true,
          },
        }));
        setErrors((current) => ({
          ...current,
          student: "",
        }));
      } else {
        setErrors((current) => ({
          ...current,
          student: error.message || "Unable to search for the student record.",
        }));
      }
    } finally {
      setIsSearchingStudent(false);
    }
  };

  const checkPreCounselingForm = async (
    studentId = formData.student,
  ) => {
    if (!studentId) {
      setPreCounselingForm(null);
      return;
    }

    setIsCheckingPreCounseling(true);
    setPreCounselingMessage("");

    try {
      const data = await apiRequest(
        `/pre-counseling/student/${studentId}/latest`,
        { method: "GET" },
      );
      const submittedForm = data?.form;

      if (!submittedForm) {
        setPreCounselingForm(null);
        return;
      }

      setPreCounselingForm(submittedForm);
    } catch (error) {
      if (error.status === 404) {
        setPreCounselingForm(null);
        return;
      }

      console.error("Pre-counseling lookup error:", error);
      setPreCounselingMessage(
        error.message || "Unable to check the pre-counseling form.",
      );
    } finally {
      setIsCheckingPreCounseling(false);
    }
  };

  const sendPreCounselingForm = async () => {
    if (!formData.student || !selectedStudent) {
      setPreCounselingMessage("Select an existing student first.");
      return;
    }

    if (!selectedStudent.email) {
      setPreCounselingMessage(
        "This student does not have an email address.",
      );
      return;
    }

    setIsSendingPreCounseling(true);
    setPreCounselingMessage("");

    try {
      const data = await apiRequest("/pre-counseling/send", {
        method: "POST",
        body: JSON.stringify({ studentId: formData.student }),
      });

      setPreCounselingSentStudentId(formData.student);

      setPreCounselingMessage(
        data?.message || "Pre-counseling form sent successfully.",
      );
    } catch (error) {
      console.error("Send pre-counseling form error:", error);
      setPreCounselingMessage(
        error.message || "Unable to send the pre-counseling form.",
      );
    } finally {
      setIsSendingPreCounseling(false);
    }
  };

  const loadPreCounselingForm = () => {
    if (!preCounselingForm) {
      return;
    }

    const background =
      preCounselingForm.backgroundAndPsychosocialHistory;

    setFormData((current) => ({
      ...current,
      consent: {
        ...current.consent,
        ...(preCounselingForm.consent || {}),
      },
      backgroundAndPsychosocialHistory: {
        ...current.backgroundAndPsychosocialHistory,
        ...(background || {}),
        familyConstellation: background?.familyConstellation?.length
          ? background.familyConstellation.map((member) => ({
              name: member.name || "",
              age:
                member.age === undefined || member.age === null
                  ? ""
                  : String(member.age),
              relationship: member.relationship || "",
              parentType: member.parentType || "Not Applicable",
              isSignificantPerson: Boolean(member.isSignificantPerson),
              remarks: member.remarks || "",
            }))
          : current.backgroundAndPsychosocialHistory.familyConstellation,
      },
    }));

    setPreCounselingMessage(
      "Pre-counseling information loaded. You can review and edit it before creating the case.",
    );
  };

  const useSelectedStudent = async () => {
    if (!selectedStudent || isCheckingExistingCase) return;
    const selectionVersion = ++studentSelectionVersion.current;
    setIsCheckingExistingCase(true);
    setExistingCaseError("");
    try {
      const result = await apiRequest(`/cases/student/${selectedStudent._id || selectedStudent.id}/active`, { method: "GET" });
      if (selectionVersion !== studentSelectionVersion.current) return;
      if (typeof result?.exists !== "boolean") throw new Error("Unable to check existing cases.");
      setExistingCaseCheck(result);
      if (!result.exists) {
        const studentId = selectedStudent._id || selectedStudent.id;
        setFormData((current) => ({ ...current, student: studentId }));
        setStudentInfoModalOpen(false);
        setActiveSection("student");
        if (formData.clientEntryType === "Scheduled") await checkPreCounselingForm(studentId);
      }
    } catch (error) {
      if (selectionVersion !== studentSelectionVersion.current) return;
      setExistingCaseError(error.message || "Unable to check existing cases. Please try again.");
    } finally {
      if (selectionVersion === studentSelectionVersion.current) setIsCheckingExistingCase(false);
    }
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
          current.backgroundAndPsychosocialHistory.familyConstellation.map(
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
          ...current.backgroundAndPsychosocialHistory.familyConstellation,
          {
            name: "",
            relationship: "",
            age: "",
            parentType: "Not Applicable",
            isSignificantPerson: false,
            remarks: "",
          },
        ],
      },
    }));
  };

  const removeFamilyMember = (index) => {
    setFormData((current) => ({
      ...current,
      backgroundAndPsychosocialHistory: {
        ...current.backgroundAndPsychosocialHistory,
        familyConstellation:
          current.backgroundAndPsychosocialHistory.familyConstellation.filter(
            (_, memberIndex) =>
              memberIndex !== index,
          ),
      },
    }));
  };

  const validateForm = () => {
    const validationErrors = {};

    if (!formData.student && !formData.temporaryStudent.isTemporary) {
      validationErrors.student =
        "Find an existing student or enter temporary student information.";
    }

    if (formData.temporaryStudent.isTemporary) {
      if (!formData.temporaryStudent.firstName.trim())
        validationErrors["temporaryStudent.firstName"] = "First name is required.";
      if (!formData.temporaryStudent.lastName.trim())
        validationErrors["temporaryStudent.lastName"] = "Last name is required.";
      if (!formData.temporaryStudent.email.trim())
        validationErrors["temporaryStudent.email"] = "Email is required so the student can complete their profile later.";
      if (!formData.temporaryStudent.yearLevel.trim())
        validationErrors["temporaryStudent.yearLevel"] = "Year level is required.";
    }

    if (!formData.assignedCounselor) {
      validationErrors.assignedCounselor =
        "Assigned counselor is required.";
    }

    if (formData.clientEntryType !== "Scheduled") {
      if (!formData.consent.hasConsent) {
        validationErrors[
          "consent.hasConsent"
        ] =
          "Consent must be documented before creating the case.";
      }

      if (
        !formData.consent.confidentialityAgreementAccepted
      ) {
        validationErrors[
          "consent.confidentialityAgreementAccepted"
        ] =
          "The confidentiality agreement must be accepted.";
      }

      if (
        !formData.consent.dataPrivacyNoticeAccepted
      ) {
        validationErrors[
          "consent.dataPrivacyNoticeAccepted"
        ] =
          "The data privacy notice must be accepted.";
      }

    }

    if (
      !formData.problemAssessment.primaryProblems.some((item) => item.trim())
    ) {
      validationErrors[
        "problemAssessment.primaryProblems"
      ] =
        "Add at least one primary problem.";
    }


    return validationErrors;
  };

  const buildPayload = (studentId = formData.student) => {
    return {
      student: studentId || undefined,

      clientEntryType: formData.clientEntryType,

      assignedCounselor:
        formData.assignedCounselor,

      consent: {
        ...formData.consent,
      },

      referralInformation: {
        ...formData.referralInformation,
      },

      mentalStatus: { ...formData.mentalStatus },

      currentPresentation: {
        ...formData.currentPresentation,
      },

      problemAssessment: {
        mainDomain:
          formData.problemAssessment.mainDomain,
        primaryProblems:
          formData.problemAssessment.primaryProblems
            .map((item) => item.trim())
            .filter(Boolean),
        secondaryProblems:
          formData.problemAssessment.secondaryProblems
            .map((item) => item.trim())
            .filter(Boolean),
      },

      backgroundAndPsychosocialHistory: {
        ...formData.backgroundAndPsychosocialHistory,
        familyConstellation:
          formData.backgroundAndPsychosocialHistory.familyConstellation
            .filter(
              (member) =>
                member.name.trim() ||
                member.relationship.trim(),
            )
            .map((member) => ({
              ...member,
              age:
                member.age === ""
                  ? undefined
                  : Number(member.age),
            })),
      },


      caseFormulation: {
        ...formData.caseFormulation,
      },
    };
  };

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();
    if (createdCaseId || isSubmitting) return;

    if (existingCaseCheck?.exists) {
      setStudentInfoModalOpen(true);
      return;
    }

    const validationErrors =
      validateForm();

    if (
      Object.keys(validationErrors).length >
      0
    ) {
      setErrors(validationErrors);

      const firstError =
        Object.keys(validationErrors)[0];

      setActiveSection(
        getSectionFromError(firstError),
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setPageError("");

    try {
      let studentId = formData.student;

      if (!studentId && formData.temporaryStudent.isTemporary) {
        const minimumProfileData = await apiRequest(
          "/students/minimum-profile",
          {
            method: "POST",
            body: JSON.stringify({
              studentIdNumber: formData.studentIdNumber,
              firstName: formData.temporaryStudent.firstName,
              middleName: formData.temporaryStudent.middleName,
              lastName: formData.temporaryStudent.lastName,
              email: formData.temporaryStudent.email,
              contactNumber: formData.temporaryStudent.contactNumber,
              college: formData.temporaryStudent.college,
              program: formData.temporaryStudent.program,
              yearLevel: formData.temporaryStudent.yearLevel,
            }),
          },
        );

        const createdStudent = minimumProfileData?.student;
        studentId = createdStudent?._id || createdStudent?.id;

        if (!studentId) {
          throw new Error("The minimum student profile was created without a valid student record ID.");
        }
      }

      const data = await apiRequest(
        "/cases",
        {
          method: "POST",
          body: JSON.stringify(
            buildPayload(studentId),
          ),
        },
      );

      const createdCase =
        data?.case;

      const caseId =
        createdCase?._id ||
        createdCase?.id;

      if (caseId) {
        setCreatedCaseId(caseId);
        return;
      }

      navigate("/cases", {
        replace: true,
        state: {
          successMessage:
            data?.message ||
            "Case created successfully.",
        },
      });
    } catch (error) {
      console.error(
        "Create case error:",
        error,
      );

      if (
        error.status === 401 ||
        error.status === 403
      ) {
        if (error.status === 401) {
          clearUser();

          navigate("/login", {
            replace: true,
          });

          return;
        }
      }

      setErrors({
        general:
          error.message ||
          "Unable to create the case.",
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#292522]">
      <AppSidebar
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="min-h-screen lg:pl-[220px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setSidebarOpen(true)
                }
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#E4DFDC] text-[#655E59] lg:hidden"
                aria-label="Open navigation"
              >
                <Icon
                  name="menu"
                  className="h-4 w-4"
                />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(createdCaseId ? `/cases/${createdCaseId}` : "/cases")
                    }
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#817A76] hover:bg-[#F5F2F0] hover:text-[#8C1518]"
                    aria-label="Back to cases"
                  >
                    <Icon
                      name="arrowLeft"
                      className="h-3.5 w-3.5"
                    />
                  </button>

                  <h1 className="truncate text-[20px] font-semibold">
                    New Case
                  </h1>
                </div>

                <p className="ml-9 hidden text-[15px] text-[#99918C] sm:block">
                  Create a complete counseling intake case record
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  navigate(createdCaseId ? `/cases/${createdCaseId}` : "/cases")
                }
                disabled={isSubmitting}
                className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[14px] font-medium text-[#5E5753] hover:bg-[#F8F6F4] disabled:opacity-50"
              >
                {createdCaseId ? "View case" : "Cancel"}
              </button>

              <button
                type="submit"
                form="new-case-form"
                disabled={isSubmitting || Boolean(createdCaseId)}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 text-[14px] font-semibold text-white transition hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating
                  </>
                ) : (
                  <>
                    <Icon
                      name="check"
                      className="h-3.5 w-3.5"
                    />
                    {createdCaseId ? "Case created" : "Create case"}
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-7">
          {pageError && (
            <Alert
              tone="error"
              message={pageError}
            />
          )}

          {errors.general && (
            <Alert
              tone="error"
              message={errors.general}
            />
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-5">
            <form
              id="new-case-form"
              onSubmit={handleSubmit}
              className="space-y-4"
              noValidate
            >
              <fieldset disabled={Boolean(createdCaseId)} className="min-w-0 space-y-4">
              <FormSection
                id="student"
                number="1"
                title="Student ID lookup and case assignment"
                description="Type the official student ID number. The logged-in counselor is assigned automatically."
                activeSection={activeSection}
                setActiveSection={
                  setActiveSection
                }
                completed={
                  completedSections.student
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Student ID number"
                    required
                    error={
                      errors.studentIdNumber ||
                      errors.student
                    }
                  >
                    <div className="flex gap-2">
                      <input
                        value={
                          formData.studentIdNumber
                        }
                        onChange={(event) => {
                          setSelectedStudent(null);
                          setStudentNotFound(false);

                          setFormData((current) => ({
                            ...current,
                            student: "",
                            studentIdNumber:
                              event.target.value.replace(/[^0-9-]/g, ""),
                            temporaryStudent: {
                              ...current.temporaryStudent,
                              isTemporary: false,
                            },
                          }));

                          clearFieldError(
                            "student",
                          );

                          clearFieldError(
                            "studentIdNumber",
                          );
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter"
                          ) {
                            event.preventDefault();
                            searchStudentByIdNumber();
                          }
                        }}
                        inputMode="text"
                        pattern="[0-9-]*"
                        placeholder="Example: 2022-1234"
                        className={`${inputClass} !text-[15px]`}
                      />

                      <button
                        type="button"
                        onClick={
                          searchStudentByIdNumber
                        }
                        disabled={
                          isSearchingStudent
                        }
                        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 !text-[15px] font-semibold text-white hover:bg-[#701013] disabled:opacity-60"
                      >
                        {isSearchingStudent ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <Icon
                            name="search"
                            className="h-3 w-3"
                          />
                        )}

                        Find
                      </button>
                    </div>
                  </Field>

                  <Field
                    label="Assigned counselor"
                  >
                    <div className="flex h-7 items-center rounded-lg border border-[#E5E0DC] bg-[#FAF9F8] px-2.5 text-[14px] text-[#5F5854]">
                      {formatUserName(user)}
                    </div>
                  </Field>

                  {selectedStudent && formData.student && (
                    <div className="sm:col-span-2">
                      <SelectedStudent
                        student={
                          selectedStudent
                        }
                        onClear={() => {
                          setSelectedStudent(null);

                          setFormData((current) => ({
                            ...current,
                            student: "",
                          }));
                        }}
                      />
                    </div>
                  )}

                  {studentNotFound && !selectedStudent && (
                    <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-3">
                        <h4 className="text-[15px] font-semibold text-amber-900">Student record not found</h4>
                        <p className="mt-1 text-[14px] leading-4 text-amber-800">Enter the minimum information needed to continue counseling. The student can be prompted to complete the remaining profile information after counseling.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          ["firstName", "First name", true],
                          ["middleName", "Middle name", false],
                          ["lastName", "Last name", true],
                          ["email", "Email", true],
                          ["contactNumber", "Contact number", false],
                          ["college", "College", false],
                          ["program", "Program", false],
                          ["yearLevel", "Year level", true],
                        ].map(([field, label, required]) => {
                          const options = field === "college"
                            ? COLLEGES
                            : field === "yearLevel" ? YEAR_LEVELS : null;
                          const fieldProps = {
                            value: formData.temporaryStudent[field],
                            onChange: (event) => {
                              setFormData((current) => ({
                                ...current,
                                temporaryStudent: {
                                  ...current.temporaryStudent,
                                  isTemporary: true,
                                  [field]: event.target.value,
                                },
                              }));
                              clearFieldError(`temporaryStudent.${field}`);
                            },
                            className: `${inputClass} !text-[15px]`,
                          };

                          return (
                            <Field key={field} label={label} required={required} error={errors[`temporaryStudent.${field}`]}>
                              {options ? (
                                <select {...fieldProps}>
                                  <option value="">Select {label.toLowerCase()}</option>
                                  {options.map((option) => (
                                    <option key={option} value={option}>
                                      {field === "yearLevel" && /^[1-5]$/.test(option)
                                        ? `Year ${option}`
                                        : option}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  {...fieldProps}
                                  type={field === "email" ? "email" : "text"}
                                />
                              )}
                            </Field>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Field label="Client entry type" required>
                    <select
                      value={formData.clientEntryType}
                     onChange={async (event) => {
                      const nextType = event.target.value;

                      setFormData((current) => ({
                        ...current,
                        clientEntryType: nextType,

                        consent:
                          nextType !== "Scheduled"
                            ? current.consent
                            : {
                                hasConsent: false,
                                confidentialityAgreementAccepted:
                                  false,
                                dataPrivacyNoticeAccepted:
                                  false,
                              },
                      }));

                      setPreCounselingForm(null);
                      setPreCounselingMessage("");

                      if (
                        nextType === "Scheduled" &&
                        formData.student
                      ) {
                        await checkPreCounselingForm(
                          formData.student,
                        );
                      }
                    }}
                      className={`${inputClass} !text-[15px]`}
                    >
                      {CLIENT_ENTRY_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </FormSection>

              <FormSection
                id="consent"
                number="2"
                title={formData.clientEntryType !== "Scheduled" ? "Consent" : "Referral and pre-counseling information"}
                description={formData.clientEntryType !== "Scheduled" ? "Document consent manually before proceeding." : "Scheduled clients can use information collected before counseling."}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                completed={completedSections.consent}
                action={formData.clientEntryType !== "Scheduled" ? (
                  <button type="button" onClick={() => setConsentModalOpen(true)} className="!text-[15px] !font-bold text-[#8C1518] underline underline-offset-2 hover:text-[#701013]">
                    View full consent form
                  </button>
                ) : null}
              >
                {formData.clientEntryType !== "Scheduled" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ConsentCheck label="Counseling consent obtained" checked={formData.consent.hasConsent} onChange={(checked) => updateNested("consent", "hasConsent", checked)} error={errors["consent.hasConsent"]} />
                    <ConsentCheck label="Confidentiality agreement accepted" checked={formData.consent.confidentialityAgreementAccepted} onChange={(checked) => updateNested("consent", "confidentialityAgreementAccepted", checked)} error={errors["consent.confidentialityAgreementAccepted"]} />
                    <ConsentCheck label="Data privacy notice accepted" checked={formData.consent.dataPrivacyNoticeAccepted} onChange={(checked) => updateNested("consent", "dataPrivacyNoticeAccepted", checked)} error={errors["consent.dataPrivacyNoticeAccepted"]} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E5E0DC] bg-[#FCFBFA] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[15px] font-semibold text-[#514B47]">
                          Pre-counseling information
                        </p>

                        <p className="mt-1 text-[14px] leading-5 text-[#817A76]">
                          {selectedStudent
                            ? `The form will be sent to ${selectedStudent.email || "the student's registered email address"}.`
                            : "Select an existing student before sending the pre-counseling form."}
                        </p>
                      </div>

                      {formData.clientEntryType === "Scheduled" &&
                        selectedStudent && (
                          <button
                            type="button"
                            onClick={sendPreCounselingForm}
                            disabled={isSendingPreCounseling || preCounselingSentStudentId === formData.student}
                            className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#8C1518] px-3 text-[14px] font-semibold text-white hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSendingPreCounseling
                              ? "Sending..."
                              : preCounselingSentStudentId === formData.student
                                ? "Sent"
                                : "Send pre-counseling form"}
                          </button>
                        )}
                    </div>

                    {isCheckingPreCounseling && (
                      <div className="mt-4 rounded-lg border border-[#E5E0DC] bg-white px-3 py-3 text-[14px] text-[#817A76]">
                        Checking for a submitted pre-counseling form...
                      </div>
                    )}

                    {!isCheckingPreCounseling &&
                      preCounselingForm && (
                        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[14px] font-semibold text-emerald-800">
                                Pre-counseling form submitted
                              </p>

                              <p className="mt-1 text-[13px] text-emerald-700">
                                Submitted{" "}
                                {formatDate(
                                  preCounselingForm.submittedAt,
                                )}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={loadPreCounselingForm}
                              className="h-8 rounded-lg border border-emerald-300 bg-white px-3 text-[14px] font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              Load information
                            </button>
                          </div>
                        </div>
                      )}

                    {!isCheckingPreCounseling &&
                      !preCounselingForm &&
                      selectedStudent &&
                      formData.clientEntryType ===
                        "Scheduled" && (
                        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                          <p className="text-[14px] font-semibold text-amber-800">
                            No submitted form found
                          </p>

                          <p className="mt-1 text-[13px] leading-4 text-amber-700">
                            Send the pre-counseling form to the student. After they submit it, use Check submission to retrieve their information.
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              checkPreCounselingForm(
                                formData.student,
                              )
                            }
                            className="mt-3 h-7 rounded-lg border border-amber-300 bg-white px-3 text-[13px] font-semibold text-amber-800 hover:bg-amber-100"
                          >
                            Check submission
                          </button>
                        </div>
                      )}

                    {preCounselingMessage && (
                      <div className="mt-4 rounded-lg border border-[#DED8D4] bg-white px-3 py-2.5 text-[13px] leading-4 text-[#625B57]">
                        {preCounselingMessage}
                      </div>
                    )}
                  </div>
                )}

                {formData.clientEntryType === "Referred" && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Referral source" required>
                      <select value={formData.referralInformation.referralSource} onChange={(event) => updateNested("referralInformation", "referralSource", event.target.value)} className={`${inputClass} !text-[15px]`}>
                        <option value="Faculty-Referred">Faculty</option>
                        <option value="Staff-Referred">Staff</option>
                        <option value="Peer-Referred">Peer</option>
                        <option value="Other-Referred">Other</option>
                      </select>
                    </Field>
                    <Field label="Referred by">
                      <input value={formData.referralInformation.referredBy} onChange={(event) => updateNested("referralInformation", "referredBy", event.target.value)} className={`${inputClass} !text-[15px]`} />
                    </Field>
                    <Field label="Referral question / reason" className="sm:col-span-2">
                      <textarea value={formData.referralInformation.referralQuestion} onChange={(event) => updateNested("referralInformation", "referralQuestion", event.target.value)} rows={3} className={`${textareaClass} !text-[15px]`} />
                    </Field>
                  </div>
                )}
              </FormSection>

              <FormSection
                id="presentation"
                number="3"
                title="Current presentation"
                description="Document the student's reported concern and the counselor's intake observations."
                activeSection={activeSection}
                setActiveSection={setActiveSection}
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Field
                    label="Narrative description"
                    required
                    error={errors["currentPresentation.narrativeDescription"]}
                    className="sm:col-span-2 xl:col-span-3"
                  >
                    <textarea
                      value={formData.currentPresentation.narrativeDescription}
                      onChange={(event) =>
                        updateNested(
                          "currentPresentation",
                          "narrativeDescription",
                          event.target.value,
                        )
                      }
                      rows={4}
                      placeholder="Describe the presenting concern and relevant intake narrative."
                      className={`${textareaClass} !text-[15px]`}
                    />
                  </Field>

                  <section className="sm:col-span-2 xl:col-span-3 rounded-xl border border-[#E5E0DC] bg-[#FCFBFA] p-4 sm:p-5" aria-labelledby="mental-status-heading">
                    <h3 id="mental-status-heading" className="text-[17px] font-semibold text-[#3B3532]">Mental Status</h3>
                    <p className="mt-1 text-[13px] leading-5 text-[#817A76]">Record an objective description of the student's mental and emotional state based on your observations.</p>
                    <fieldset className="mt-5">
                      <legend className="text-[14px] font-semibold text-[#514B47]">1. Appearance (observed)</legend>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <Field label="Grooming">
                          <input
                            value={formData.mentalStatus.grooming}
                            onChange={(event) => updateNested("mentalStatus", "grooming", event.target.value)}
                            placeholder="Describe observed grooming."
                            className={`${inputClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Attire">
                          <input
                            value={formData.mentalStatus.attire}
                            onChange={(event) => updateNested("mentalStatus", "attire", event.target.value)}
                            placeholder="Describe observed attire."
                            className={`${inputClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Physical presentation">
                          <input
                            value={formData.mentalStatus.physicalPresentation}
                            onChange={(event) => updateNested("mentalStatus", "physicalPresentation", event.target.value)}
                            placeholder="Describe the student’s physical presentation."
                            className={`${inputClass} !text-[15px]`}
                          />
                        </Field>
                      </div>
                    </fieldset>
                    <fieldset className="mt-5">
                      <legend className="text-[14px] font-semibold text-[#514B47]">2. Behaviour (observed)</legend>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <Field label="Eye contact">
                          <input
                            value={formData.mentalStatus.eyeContact}
                            onChange={(event) => updateNested("mentalStatus", "eyeContact", event.target.value)}
                            placeholder="e.g. wandering eyes"
                            className={`${inputClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Activity level">
                          <input
                            value={formData.mentalStatus.activityLevel}
                            onChange={(event) => updateNested("mentalStatus", "activityLevel", event.target.value)}
                            placeholder="e.g. agitated"
                            className={`${inputClass} !text-[15px]`}
                          />
                        </Field>
                      </div>
                    </fieldset>
                    <fieldset className="mt-5">
                      <legend className="text-[14px] font-semibold text-[#514B47]">Speech (observed)</legend>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <Field label="Rate">
                          <input
                            value={formData.mentalStatus.speechRate}
                            onChange={(event) => updateNested("mentalStatus", "speechRate", event.target.value)}
                            placeholder="e.g. fast, slow, normal"
                            className={`${inputClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Volume">
                          <input
                            value={formData.mentalStatus.speechVolume}
                            onChange={(event) => updateNested("mentalStatus", "speechVolume", event.target.value)}
                            placeholder="e.g. loud, soft, commanding"
                            className={`${inputClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Fluency">
                          <input
                            value={formData.mentalStatus.speechFluency}
                            onChange={(event) => updateNested("mentalStatus", "speechFluency", event.target.value)}
                            placeholder="e.g. stuttering"
                            className={`${inputClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Articulation">
                          <input
                            value={formData.mentalStatus.speechArticulation}
                            onChange={(event) => updateNested("mentalStatus", "speechArticulation", event.target.value)}
                            placeholder="e.g. clear or unclear"
                            className={`${inputClass} !text-[15px]`}
                          />
                        </Field>
                      </div>
                    </fieldset>
                    <fieldset className="mt-5">
                      <legend className="text-[14px] font-semibold text-[#514B47]">Other mental-status observations</legend>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <Field label="General speech notes">
                          <textarea
                            value={formData.mentalStatus.speech}
                            onChange={(event) => updateNested("mentalStatus", "speech", event.target.value)}
                            rows={3}
                            className={`${textareaClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Mood and affect">
                          <textarea
                            value={formData.mentalStatus.moodAndAffect}
                            onChange={(event) => updateNested("mentalStatus", "moodAndAffect", event.target.value)}
                            rows={3}
                            className={`${textareaClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Thought process">
                          <textarea
                            value={formData.mentalStatus.thoughtProcess}
                            onChange={(event) => updateNested("mentalStatus", "thoughtProcess", event.target.value)}
                            rows={3}
                            className={`${textareaClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Orientation">
                          <textarea
                            value={formData.mentalStatus.orientation}
                            onChange={(event) => updateNested("mentalStatus", "orientation", event.target.value)}
                            rows={3}
                            className={`${textareaClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Attention and concentration">
                          <textarea
                            value={formData.mentalStatus.attentionAndConcentration}
                            onChange={(event) => updateNested("mentalStatus", "attentionAndConcentration", event.target.value)}
                            rows={3}
                            className={`${textareaClass} !text-[15px]`}
                          />
                        </Field>
                        <Field label="Risk indicators">
                          <textarea
                            value={formData.mentalStatus.riskIndicators}
                            onChange={(event) => updateNested("mentalStatus", "riskIndicators", event.target.value)}
                            rows={3}
                            className={`${textareaClass} !text-[15px]`}
                          />
                        </Field>
                      </div>
                    </fieldset>
                  </section>

                  <Field label="Onset">
                    <input
                      value={formData.currentPresentation.onset}
                      onChange={(event) =>
                        updateNested("currentPresentation", "onset", event.target.value)
                      }
                    className={`${inputClass} !text-[15px]`}
                    />
                  </Field>

                  <Field label="Duration">
                    <input
                      value={formData.currentPresentation.duration}
                      onChange={(event) =>
                        updateNested("currentPresentation", "duration", event.target.value)
                      }
                      className={`${inputClass} !text-[15px]`}
                    />
                  </Field>

                  <Field label="Frequency">
                    <input
                      value={formData.currentPresentation.frequency}
                      onChange={(event) =>
                        updateNested("currentPresentation", "frequency", event.target.value)
                      }
                      className={`${inputClass} !text-[15px]`}
                    />
                  </Field>

                  <Field label="Intensity">
                    <select
                      value={formData.currentPresentation.intensity}
                      onChange={(event) =>
                        updateNested("currentPresentation", "intensity", event.target.value)
                      }
                      className={`${inputClass} !text-[15px]`}
                    >
                      {INTENSITY_LEVELS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </FormSection>

              <FormSection
                id="assessment"
                number="4"
                title="Problem assessment"
                description="Classify the concern and list its primary and secondary problems."
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                completed={completedSections.assessment}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Main domain" required>
                    <select
                      value={formData.problemAssessment.mainDomain}
                      onChange={(event) =>
                        updateNested(
                          "problemAssessment",
                          "mainDomain",
                          event.target.value,
                        )
                      }
                      className={`${inputClass} !text-[15px]`}
                    >
                      {MAIN_DOMAINS.map((domain) => (
                        <option key={domain} value={domain}>{domain}</option>
                      ))}
                    </select>
                  </Field>

                  <ProblemList
                    label="Primary problems"
                    required
                    values={formData.problemAssessment.primaryProblems}
                    error={errors["problemAssessment.primaryProblems"]}
                    onChange={(values) =>
                      updateNested("problemAssessment", "primaryProblems", values)
                    }
                  />

                  <ProblemList
                    label="Secondary problems"
                    values={formData.problemAssessment.secondaryProblems}
                    onChange={(values) =>
                      updateNested("problemAssessment", "secondaryProblems", values)
                    }
                  />
                </div>
              </FormSection>

              <FormSection
                id="history"
                number="5"
                title="Background and psychosocial history"
                description="Review family constellation, academic and social context, and relevant history. Scheduled intake information remains editable."
                activeSection={activeSection}
                setActiveSection={setActiveSection}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-[15px] font-semibold text-[#3B3532]">
                          Family constellation
                        </h4>

                        <p className="mt-0.5 text-[13px] text-[#918984]">
                          Add relevant family members or significant people.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addFamilyMember}
                        className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#D9D2CE] bg-white px-2.5 !text-[15px] font-semibold text-[#625B57] hover:border-[#8C1518] hover:text-[#8C1518]"
                      >
                        <Icon name="plus" className="h-3 w-3" />
                        Add member
                      </button>
                    </div>

                    <div className="mt-3 space-y-3">
                      {formData.backgroundAndPsychosocialHistory.familyConstellation.map(
                        (member, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-[#E5E0DC] bg-[#FCFBFA] p-3"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <p className="text-[14px] font-semibold text-[#514B47]">
                                Family member {index + 1}
                              </p>

                              {formData.backgroundAndPsychosocialHistory.familyConstellation.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeFamilyMember(index)}
                                  className="grid h-6 w-6 place-items-center rounded-md text-red-500 hover:bg-red-50"
                                  aria-label="Remove family member"
                                >
                                  <Icon name="close" className="h-3 w-3" />
                                </button>
                              )}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              <Field
                                label="Name"
                                required
                                error={errors[`familyConstellation.${index}.name`]}
                              >
                                <input
                                  value={member.name}
                                  onChange={(event) =>
                                    updateFamilyMember(index, "name", event.target.value)
                                  }
                                  className={`${inputClass} !text-[15px]`}
                                />
                              </Field>

                              <Field
                                label="Relationship"
                                required
                                error={errors[`familyConstellation.${index}.relationship`]}
                              >
                                <input
                                  value={member.relationship}
                                  onChange={(event) =>
                                    updateFamilyMember(
                                      index,
                                      "relationship",
                                      event.target.value,
                                    )
                                  }
                                  className={`${inputClass} !text-[15px]`}
                                />
                              </Field>

                              <Field label="Age">
                                <input
                                  type="number"
                                  min="0"
                                  value={member.age}
                                  onChange={(event) =>
                                    updateFamilyMember(index, "age", event.target.value)
                                  }
                                  className={`${inputClass} !text-[15px]`}
                                />
                              </Field>

                              <Field label="Parent type">
                                <select
                                  value={member.parentType}
                                  onChange={(event) =>
                                    updateFamilyMember(
                                      index,
                                      "parentType",
                                      event.target.value,
                                    )
                                  }
                                  className={`${inputClass} !text-[15px]`}
                                >
                                  <option>Biological</option>
                                  <option>Adoptive</option>
                                  <option>Step-parent</option>
                                  <option>Foster</option>
                                  <option>Guardian</option>
                                  <option>Not Applicable</option>
                                </select>
                              </Field>

                              <Field label="Significant person">
                                <label className="flex h-7 items-center gap-2 rounded-lg border border-[#DDD8D4] bg-white px-2.5">
                                  <input
                                    type="checkbox"
                                    checked={member.isSignificantPerson}
                                    onChange={(event) =>
                                      updateFamilyMember(
                                        index,
                                        "isSignificantPerson",
                                        event.target.checked,
                                      )
                                    }
                                    className="h-3.5 w-3.5 accent-[#8C1518]"
                                  />
                                  <span className="text-[14px] text-[#514B47]">
                                    Mark as significant
                                  </span>
                                </label>
                              </Field>

                              <Field label="Remarks">
                                <input
                                  value={member.remarks}
                                  onChange={(event) =>
                                    updateFamilyMember(index, "remarks", event.target.value)
                                  }
                                  className={`${inputClass} !text-[15px]`}
                                />
                              </Field>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <Field
                    label="Family constellation comments"
                    className="sm:col-span-2"
                  >
                    <textarea
                      value={
                        formData.backgroundAndPsychosocialHistory.familyConstellationComments
                      }
                      onChange={(event) =>
                        updateNested(
                          "backgroundAndPsychosocialHistory",
                          "familyConstellationComments",
                          event.target.value,
                        )
                      }
                      rows={3}
                      className={`${textareaClass} !text-[15px]`}
                    />
                  </Field>

                  <Field
                    label="Family context"
                    className="sm:col-span-2"
                  >
                    <textarea
                      value={
                        formData.backgroundAndPsychosocialHistory.familyContext
                      }
                      onChange={(event) =>
                        updateNested(
                          "backgroundAndPsychosocialHistory",
                          "familyContext",
                          event.target.value,
                        )
                      }
                      rows={3}
                      className={`${textareaClass} !text-[15px]`}
                    />
                  </Field>

                  <Field label="Academic context">
                    <textarea
                      value={
                        formData.backgroundAndPsychosocialHistory.academicContext
                      }
                      onChange={(event) =>
                        updateNested(
                          "backgroundAndPsychosocialHistory",
                          "academicContext",
                          event.target.value,
                        )
                      }
                      rows={3}
                      className={`${textareaClass} !text-[15px]`}
                    />
                  </Field>

                  <Field label="Peer and social context">
                    <textarea
                      value={
                        formData.backgroundAndPsychosocialHistory.peerSocialContext
                      }
                      onChange={(event) =>
                        updateNested(
                          "backgroundAndPsychosocialHistory",
                          "peerSocialContext",
                          event.target.value,
                        )
                      }
                      rows={3}
                      className={`${textareaClass} !text-[15px]`}
                    />
                  </Field>

                  {[
                    ["psychiatricCareHistory", "Psychiatric care history"],
                    ["psychologicalTherapyHistory", "Psychological therapy history"],
                    ["previousCounselingHistory", "Previous counseling history"],
                    ["medicalHistory", "Medical history"],
                    ["familyMentalHealthHistory", "Family mental-health history"],
                    ["substanceUseHistory", "Substance-use history"],
                    ["legalHistory", "Legal history"],
                  ].map(([field, label]) => (
                    <HistoryField
                      key={field}
                      label={label}
                      value={
                        formData.backgroundAndPsychosocialHistory[field]
                      }
                      onChange={(value) =>
                        updateNested(
                          "backgroundAndPsychosocialHistory",
                          field,
                          value,
                        )
                      }
                    />
                  ))}
                </div>
              </FormSection>

              <div className="flex flex-col-reverse gap-3 rounded-2xl border border-[#E4DFDC] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] leading-4 text-[#928A85]">
                  Creating the case records the logged-in user in the case action history. The backend generates the case number and opening date.
                </p>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/cases")
                    }
                    disabled={
                      isSubmitting
                    }
                    className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 !text-[15px] font-medium text-[#5E5753] hover:bg-[#F8F6F4] disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isSubmitting
                    }
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 !text-[15px] font-semibold text-white hover:bg-[#701013] disabled:opacity-60"
                  >
                    <Icon
                      name="check"
                      className="h-3.5 w-3.5"
                    />

                    {createdCaseId ? "Case created" : "Create case"}
                  </button>
                </div>
              </div>
              </fieldset>
            </form>
            <section id="new-case-recommendations" aria-label="LLM recommendations" className="space-y-3">
              <h2 className="text-[17px] font-semibold">LLM recommendations</h2>
              {createdCaseId ? (
                <>
                  <p role="status" className="rounded-lg bg-emerald-50 p-3 text-[14px] text-emerald-800">Case created successfully. You can generate and review recommendations below.</p>
                  <LLMRecommendationsPage embedded caseId={createdCaseId} />
                </>
              ) : (
                <div className="rounded-2xl border border-[#E4DFDC] bg-white p-5 text-[14px] leading-6 text-[#817A76]">
                  Create the case first to enable recommendation generation and review here.
                </div>
              )}
            </section>
            </div>

            <CaseSummary
              formData={formData}
              selectedStudent={
                selectedStudent
              }
              user={user}
              completedSections={
                completedSections
              }
            />
          </div>
        </main>
      </div>

      <StudentInformationModal
        open={studentInfoModalOpen}
        student={selectedStudent}
        onClose={cancelStudentSelection}
        onUseStudent={useSelectedStudent}
        checking={isCheckingExistingCase}
        existingCase={existingCaseCheck}
        error={existingCaseError}
        onProgressNotes={() => navigate(`/progress-notes?caseId=${existingCaseCheck.caseId}`)}
      />

      <ConsentFormModal
        open={consentModalOpen}
        onClose={() =>
          setConsentModalOpen(false)
        }
      />
    </div>
  );
}

function FormSection({
  id,
  number,
  title,
  description,
  activeSection,
  setActiveSection,
  completed = false,
  action,
  children,
}) {
  const open =
    activeSection === id;

  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-white transition ${
        open
          ? "border-[#C9B7B4] shadow-[0_12px_35px_rgba(45,30,25,0.04)]"
          : "border-[#E4DFDC]"
      }`}
    >
      <header className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <button
          type="button"
          onClick={() =>
            setActiveSection(
              open ? "" : id,
            )
          }
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[14px] font-semibold ${
              completed
                ? "bg-emerald-50 text-emerald-700"
                : open
                  ? "bg-[#8C1518] text-white"
                  : "bg-[#F4EAEA] text-[#8C1518]"
            }`}
          >
            {completed ? (
              <Icon
                name="check"
                className="h-3.5 w-3.5"
              />
            ) : (
              number
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-semibold text-[#3B3532]">
              {title}
            </span>

            <span className="mt-0.5 hidden text-[13px] leading-4 text-[#928A85] sm:block">
              {description}
            </span>
          </span>

          <Icon
            name={
              open
                ? "chevronUp"
                : "chevronDown"
            }
            className="h-3.5 w-3.5 shrink-0 text-[#9D9590]"
          />
        </button>

        {action && (
          <div className="shrink-0">
            {action}
          </div>
        )}
      </header>

      {open && (
        <div className="border-t border-[#EEEAE7] px-4 py-5 sm:px-5">
          {children}
        </div>
      )}
    </section>
  );
}

function CaseSummary({
  formData,
  selectedStudent,
  user,
  completedSections,
}) {
  const assignedCounselor = user;

  const completedCount =
    Object.values(
      completedSections,
    ).filter(Boolean).length;

  return (
    <aside className="self-start xl:sticky xl:top-[82px]">
      <section className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
        <header className="border-b border-[#ECE8E5] px-4 py-3.5">
          <h3 className="text-[17px] font-semibold">
            Case summary
          </h3>

          <p className="mt-1 text-[13px] text-[#958D88]">
            Review before creation
          </p>
        </header>

        <div className="space-y-4 p-4">
          <SummaryRow
            label="Student"
            value={
              selectedStudent
                ? formatStudentName(
                    selectedStudent,
                  )
                : formData.temporaryStudent.isTemporary
                  ? [formData.temporaryStudent.firstName, formData.temporaryStudent.lastName].filter(Boolean).join(" ") || "Temporary student"
                  : formData.student
                    ? "Existing student ID entered"
                    : "Not selected"
            }
          />

          <SummaryRow
            label="Entry type"
            value={formData.clientEntryType}
          />

          <SummaryRow
            label="Main domain"
            value={
              formData.problemAssessment.mainDomain
            }
          />


          <SummaryRow
            label="Assigned counselor"
            value={
              formatUserName(
                assignedCounselor,
              ) || "Not assigned"
            }
          />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] text-[#918984]">
                Required progress
              </span>

              <span className="text-[14px] font-semibold text-[#8C1518]">
                {completedCount}/3
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-[#EEEAE7]">
              <div
                className="h-full rounded-full bg-[#8C1518] transition-all"
                style={{
                  width: `${
                    (completedCount /
                      3) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>

        </div>
      </section>
    </aside>
  );
}

function StudentInformationModal({ open, student, onClose, onUseStudent, checking, existingCase, error, onProgressNotes }) {
  if (!open || !student) return null;

  const address = formatStudentAddress(student);
  const rows = [
    ["Student ID", student.studentIdNumber],
    ["Full name", formatStudentName(student)],
    ["Email", student.email],
    ["Contact number", student.contactNumber],
    ["College", student.college],
    ["Program", student.program],
    ["Year level", student.yearLevel],
    ["Sex", student.sex || student.gender],
    ["Date of birth", formatDate(student.dateOfBirth)],
    ["Address", address],
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <p className="text-[17px] font-semibold text-[#3B3532]">Student information found</p>
            <p className="mt-1 text-[14px] text-[#918984]">Review the student's basic background information before continuing.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-[#918984] hover:bg-[#F7F4F2]" aria-label="Close student information">
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </header>
        <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className={label === "Address" ? "sm:col-span-2" : ""}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#9A918C]">{label}</p>
              <p className="mt-1 text-[15px] font-medium leading-4 text-[#3E3936]">{value || "Not provided"}</p>
            </div>
          ))}
        </div>
        {error && <p role="alert" className="px-5 pb-4 text-[14px] text-red-700">{error}</p>}
        {existingCase?.exists && (
          <p role="status" className="mx-5 mb-4 rounded-lg bg-amber-50 p-3 text-[14px] leading-6 text-amber-900">
            {existingCase.canAddNotes
              ? "This student already has an active case. Would you like to add progress notes instead?"
              : "This student already has an active case managed by another counselor. Contact the assigned counselor before proceeding."}
          </p>
        )}
        <footer className="flex justify-end gap-2 border-t border-[#ECE8E5] bg-[#FCFBFA] px-5 py-4">
          <button type="button" onClick={onClose} className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[15px] font-medium text-[#5E5753]">Back</button>
          {existingCase?.exists ? (
            existingCase.canAddNotes && <button type="button" onClick={onProgressNotes} className="rounded-lg bg-[#8C1518] px-4 py-2 text-[15px] font-semibold text-white">Go to progress notes</button>
          ) : (
            <button type="button" disabled={checking} onClick={onUseStudent} className="h-8 rounded-lg bg-[#8C1518] px-4 text-[15px] font-semibold text-white hover:bg-[#701013] disabled:opacity-50">{checking ? "Checking cases..." : "Use this student"}</button>
          )}
        </footer>
      </div>
    </div>
  );
}

function SelectedStudent({
  student,
  onClear,
}) {
  return (
    <div className="flex min-h-[64px] items-center gap-3 rounded-xl border border-[#D9CDCA] bg-[#FCFBFA] px-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
        <Icon
          name="student"
          className="h-4 w-4"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-[#3E3835]">
          {formatStudentName(student)}
        </p>

        <p className="mt-1 truncate text-[13px] text-[#938B86]">
          {student.studentIdNumber ||
            "No student number"}{" "}
          ·{" "}
          {student.program ||
            student.college ||
            "Student record"}
        </p>
      </div>


      <button
        type="button"
        onClick={onClear}
        className="grid h-8 w-8 place-items-center rounded-lg text-[#9A918C] hover:bg-red-50 hover:text-red-600"
        aria-label="Clear selected student"
      >
        <Icon
          name="close"
          className="h-3.5 w-3.5"
        />
      </button>
    </div>
  );
}

function ConsentCheck({
  label,
  checked,
  onChange,
  error,
}) {
  return (
    <div>
      <label className="flex min-h-[36px] cursor-pointer items-center gap-2.5 rounded-lg border border-[#E2DDDA] bg-white px-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange(event.target.checked)
          }
          className="h-3.5 w-3.5 accent-[#8C1518]"
        />

        <span className="text-[14px] font-medium text-[#514B47]">
          {label}
        </span>
      </label>

      {error && (
        <p className="mt-1.5 text-[13px] leading-4 text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function ProblemList({
  label,
  values,
  onChange,
  required = false,
  error,
}) {
  const updateItem = (
    index,
    value,
  ) => {
    onChange(
      values.map((item, itemIndex) =>
        itemIndex === index
          ? value
          : item,
      ),
    );
  };

  const addItem = () => {
    onChange([...values, ""]);
  };

  const removeItem = (index) => {
    const nextValues =
      values.filter(
        (_, itemIndex) =>
          itemIndex !== index,
      );

    onChange(
      nextValues.length
        ? nextValues
        : [""],
    );
  };

  return (
    <div className="sm:col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[#4B4541]">
          {label}

          {required && (
            <span className="ml-1 text-red-600">
              *
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={addItem}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-[#D9D2CE] px-2 text-[13px] font-semibold text-[#625B57] hover:border-[#8C1518] hover:text-[#8C1518]"
        >
          <Icon
            name="plus"
            className="h-2.5 w-2.5"
          />
          Add
        </button>
      </div>

      <div className="mt-1.5 space-y-2">
        {values.map(
          (value, index) => (
            <div
              key={index}
              className="flex gap-2"
            >
              <input
                value={value}
                onChange={(event) =>
                  updateItem(
                    index,
                    event.target.value,
                  )
                }
                className={`${inputClass} !text-[15px]`}
              />

              {values.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    removeItem(index)
                  }
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#E3DEDA] text-red-500 hover:bg-red-50"
                  aria-label={`Remove ${label.toLowerCase()} item`}
                >
                  <Icon
                    name="close"
                    className="h-3 w-3"
                  />
                </button>
              )}
            </div>
          ),
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-[13px] leading-4 text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function HistoryField({
  label,
  value,
  onChange,
}) {
  return (
    <div className="rounded-xl border border-[#E5E0DC] bg-[#FCFBFA] p-3">
      <label className="flex items-center gap-2">
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
          className="h-3.5 w-3.5 accent-[#8C1518]"
        />

        <span className="text-[14px] font-semibold text-[#4B4541]">
          {label}
        </span>
      </label>

      {value.hasHistory && (
        <textarea
          value={value.description}
          onChange={(event) =>
            onChange({
              ...value,
              description:
                event.target.value,
            })
          }
          rows={3}
          placeholder="Provide a brief description."
          className={`${textareaClass} mt-2 !text-[15px]`}
        />
      )}
    </div>
  );
}

function Field({
  label,
  required = false,
  error,
  className = "",
  children,
}) {
  return (
    <label
      className={`block ${className}`}
    >
      <span className="text-[14px] font-semibold text-[#4B4541]">
        {label}

        {required && (
          <span className="ml-1 text-red-600">
            *
          </span>
        )}
      </span>

      <div className="mt-1.5">
        {children}
      </div>

      {error && (
        <p className="mt-1.5 text-[13px] leading-4 text-red-600">
          {error}
        </p>
      )}
    </label>
  );
}

function SummaryRow({
  label,
  value,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#EEEAE7] pb-3 last:border-b-0 last:pb-0">
      <span className="text-[13px] text-[#918984]">
        {label}
      </span>

      <span className="max-w-[150px] text-right text-[14px] font-semibold leading-4 text-[#3E3936]">
        {value || "—"}
      </span>
    </div>
  );
}

function Alert({
  tone,
  message,
}) {
  const error =
    tone === "error";

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-[14px] ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {message}
    </div>
  );
}

function formatUserName(
  account,
) {
  if (!account) {
    return "";
  }

  return [
    account.firstName,
    account.lastName,
  ]
    .filter(Boolean)
    .join(" ");
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

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function formatStudentAddress(student) {
  const address = student?.temporaryAddress || student?.addresses;
  if (!address) return "";
  if (typeof address === "string") return address;
  if (Array.isArray(address)) {
    return address.map((item) => typeof item === "string" ? item : Object.values(item || {}).filter(Boolean).join(", ")).filter(Boolean).join("; ");
  }
  return Object.values(address).filter((value) => typeof value === "string" && value.trim()).join(", ");
}

function getSectionFromError(
  field,
) {
  if (
    field === "student" ||
    field.startsWith("temporaryStudent") ||
    field ===
      "assignedCounselor"
  ) {
    return "student";
  }

  if (
    field.startsWith("consent") ||
    field.startsWith(
      "referralInformation",
    )
  ) {
    return "consent";
  }

  if (
    field.startsWith(
      "currentPresentation",
    )
  ) {
    return "presentation";
  }

  if (
    field.startsWith(
      "problemAssessment",
    )
  ) {
    return "assessment";
  }

  if (
    field.startsWith(
      "familyConstellation",
    ) ||
    field.startsWith(
      "backgroundAndPsychosocialHistory",
    )
  ) {
    return "history";
  }


  return "student";
}

const inputClass =
  "h-7 w-full rounded-lg border border-[#DDD8D4] bg-white px-2.5 text-[14px] text-[#302B28] outline-none transition placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06] disabled:cursor-not-allowed disabled:bg-[#F5F2F0] disabled:text-[#918A86]";

const textareaClass =
  "min-h-[72px] w-full resize-y rounded-lg border border-[#DDD8D4] bg-white px-2.5 py-2 text-[15px] leading-4 text-[#302B28] outline-none transition placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";

