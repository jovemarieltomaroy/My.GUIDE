import KnowledgeMaterialSelector from "../components/KnowledgeMaterialSelector";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate, useSearchParams } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";
const TEMPORARY_CASES_ENDPOINT = "/cases/temporary-access";

const EMPTY_PLAN_FORM = {
  problem: "",
  goal: "",
  planOfAction: "",
  timeSpan: "",
  resources: [],
  followUpPlan: "",
  remarks: "",
};

export default function InterventionPlansPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedCaseId = searchParams.get("caseId");
  const isFocusedCaseMode = Boolean(requestedCaseId);
  const { user, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState("");
  const [planStatusFilter, setPlanStatusFilter] = useState("");

  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [isLoadingCase, setIsLoadingCase] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM);
  const [resourceFiles, setResourceFiles] = useState([]);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const isAdmin = user?.role === ADMIN_ROLE;

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (user.mustChangePassword === true) {
      navigate("/change-password", { replace: true });
      return;
    }

    if (user.profileCompleted === false) {
      navigate("/complete-profile", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const handleUnauthorized = useCallback(() => {
    clearUser();
    navigate("/login", { replace: true });
  }, [clearUser, navigate]);

  const fetchCases = useCallback(async () => {
    if (!user) return;

    setIsLoadingCases(true);
    setPageError("");

    try {
      let retrievedCases = [];

      if (isAdmin) {
        const adminCases = await apiRequest("/cases", {
          method: "GET",
        });

        if (!Array.isArray(adminCases)) {
          throw new Error(
            "The backend returned an invalid cases response.",
          );
        }

        retrievedCases = adminCases.map((caseRecord) => ({
          ...caseRecord,
          accessType: "Admin",
        }));
      } else {
        const [assignedResult, temporaryResult] =
          await Promise.allSettled([
            apiRequest("/cases/my-cases", {
              method: "GET",
            }),
            apiRequest(TEMPORARY_CASES_ENDPOINT, {
              method: "GET",
            }),
          ]);

        if (
          assignedResult.status === "rejected" &&
          assignedResult.reason?.status === 401
        ) {
          handleUnauthorized();
          return;
        }

        if (
          temporaryResult.status === "rejected" &&
          temporaryResult.reason?.status === 401
        ) {
          handleUnauthorized();
          return;
        }

        const assignedCases =
          assignedResult.status === "fulfilled" &&
          Array.isArray(assignedResult.value)
            ? assignedResult.value
            : [];

        const temporaryCases =
          temporaryResult.status === "fulfilled" &&
          Array.isArray(temporaryResult.value)
            ? temporaryResult.value
            : [];

        const assignedIds = new Set(
          assignedCases.map((caseRecord) =>
            String(caseRecord._id || caseRecord.id),
          ),
        );

        const uniqueTemporaryCases = temporaryCases.filter(
          (caseRecord) =>
            !assignedIds.has(
              String(caseRecord._id || caseRecord.id),
            ),
        );

        retrievedCases = [
          ...assignedCases.map((caseRecord) => ({
            ...caseRecord,
            accessType: "Assigned",
          })),
          ...uniqueTemporaryCases.map((caseRecord) => ({
            ...caseRecord,
            accessType: "Temporary",
          })),
        ];

        if (
          assignedResult.status === "rejected" &&
          temporaryResult.status === "rejected"
        ) {
          throw new Error(
            "Unable to retrieve assigned or temporary-access cases.",
          );
        }
      }

      setCases(retrievedCases);

      // Do not clear a focused case that was opened through a direct URL.
      // A temporary-access case may not exist in the assigned-cases list,
      // but GET /cases/:id can still authorize and return it.
      if (
        !isFocusedCaseMode &&
        selectedCaseId &&
        !retrievedCases.some(
          (caseRecord) =>
            String(caseRecord._id || caseRecord.id) ===
            String(selectedCaseId),
        )
      ) {
        setSelectedCaseId("");
        setSelectedCase(null);
      }
    } catch (error) {
      console.error("Unable to retrieve cases:", error);

      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(
        error.message || "Unable to retrieve cases.",
      );
    } finally {
      setIsLoadingCases(false);
    }
  }, [
    user,
    isAdmin,
    selectedCaseId,
    isFocusedCaseMode,
    handleUnauthorized,
  ]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    if (!requestedCaseId) return;

    setSelectedCaseId(requestedCaseId);
  }, [requestedCaseId]);

  const fetchCaseById = useCallback(
    async (caseId) => {
      if (!caseId) {
        setSelectedCase(null);
        return;
      }

      setIsLoadingCase(true);
      setPageError("");

      try {
        const data = await apiRequest(`/cases/${caseId}`, {
          method: "GET",
        });

        const caseRecord = data?.case || data;

        if (!caseRecord?._id) {
          throw new Error("The backend did not return the case record.");
        }

        setSelectedCase(caseRecord);
      } catch (error) {
        console.error("Unable to retrieve case:", error);

        if (error.status === 401) {
          handleUnauthorized();
          return;
        }

        setSelectedCase(null);
        setPageError(
          error.message || "Unable to retrieve the selected case.",
        );
      } finally {
        setIsLoadingCase(false);
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    if (selectedCaseId) {
      fetchCaseById(selectedCaseId);
    }
  }, [selectedCaseId, fetchCaseById]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = searchQuery.toLowerCase();

    return cases.filter((caseRecord) => {
      const studentName = formatStudentName(caseRecord.student);

      const matchesSearch =
        !normalizedSearch ||
        [
          caseRecord.caseNumber,
          studentName,
          caseRecord.student?.studentIdNumber,
          caseRecord.student?.college,
          caseRecord.student?.program,
          caseRecord.problemAssessment?.mainDomain,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearch),
          );

      const matchesCaseStatus =
        !caseStatusFilter || caseRecord.caseStatus === caseStatusFilter;

      const plans = caseRecord.interventionPlans || [];
      const matchesPlanStatus =
        !planStatusFilter ||
        plans.some(
          (plan) =>
            plan.approvalStatus === planStatusFilter ||
            plan.status === planStatusFilter,
        );

      return matchesSearch && matchesCaseStatus && matchesPlanStatus;
    });
  }, [
    cases,
    searchQuery,
    caseStatusFilter,
    planStatusFilter,
  ]);

  const interventionPlans = useMemo(() => {
    return [...(selectedCase?.interventionPlans || [])].sort(
      (a, b) =>
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );
  }, [selectedCase]);

  const assignedCounselorId =
    selectedCase?.assignedCounselor?._id ||
    selectedCase?.assignedCounselor;

  const isAssignedCounselor =
    Boolean(selectedCase && user?._id) &&
    assignedCounselorId?.toString() ===
      user._id.toString();

  const currentTemporaryAccess = useMemo(() => {
    if (!selectedCase || !user?._id) return null;

    return (
      selectedCase.temporaryCounselor || []
    ).find((access) => {
      const counselorId =
        access.counselor?._id ||
        access.counselor;

      const accessUntil =
        new Date(access.accessUntil);

      return (
        counselorId?.toString() ===
          user._id.toString() &&
        access.isActive === true &&
        !access.revokedAt &&
        !Number.isNaN(accessUntil.getTime()) &&
        accessUntil > new Date()
      );
    }) || null;
  }, [selectedCase, user]);

  const isTemporaryReadOnly =
    Boolean(currentTemporaryAccess) &&
    !isAssignedCounselor;

  const caseAllowsPlanChanges =
    Boolean(selectedCase) &&
    !selectedCase.isArchived &&
    !["Closed", "Terminated"].includes(
      selectedCase.caseStatus,
    );

  // The backend's plan review/send routes are restricted to the
  // permanently assigned counselor. Temporary access is read-only.
  const canManagePlans =
    caseAllowsPlanChanges &&
    isAssignedCounselor;

  const readOnlyReason = isTemporaryReadOnly
    ? "You have read-only temporary access. Only the assigned counselor can create, revise, approve, reject, upload, remove, or send intervention-plan content."
    : !caseAllowsPlanChanges
      ? "Intervention-plan actions are unavailable for archived, closed, or terminated cases."
      : !isAssignedCounselor
        ? "Only the assigned counselor can modify intervention plans."
        : "";

  const resetResourceForm = () => {
    setResourceFiles([]);
    setResourceTitle("");
    setResourceDescription("");
  };

  const openCreateModal = () => {
    if (!canManagePlans) {
      setPageError(
        readOnlyReason ||
          "You are not authorized to create intervention plans.",
      );
      return;
    }

    setPlanForm(EMPTY_PLAN_FORM);
    resetResourceForm();
    setModalError("");
    setPlanModalOpen(true);
  };

  const openRecommendationWorkspace = () => {
    if (!selectedCase?._id) return;

    if (!canManagePlans) {
      setPageError(
        readOnlyReason ||
          "You are not authorized to manage recommendations for this case.",
      );
      return;
    }

    navigate(
      `/llm-recommendations?caseId=${selectedCase._id}`,
    );
  };

  const uploadPlanResources = async (caseId, planId) => {
    if (resourceFiles.length === 0) return null;

    const formData = new FormData();

    resourceFiles.forEach((file) => {
      formData.append("files", file);
    });

    formData.append("title", resourceTitle.trim());
    formData.append("description", resourceDescription.trim());

    return apiRequest(
      `/cases/${caseId}/intervention-plans/${planId}/resources`,
      {
        method: "POST",
        body: formData,
      },
    );
  };

  const saveManualPlan = async (event) => {
    event.preventDefault();

    if (!selectedCase) return;

    if (!canManagePlans) {
      setModalError(
        readOnlyReason ||
          "You are not authorized to create intervention plans.",
      );
      return;
    }

    setIsSaving(true);
    setModalError("");

    try {
      const newPlan = {
        problem: planForm.problem.trim(),
        goal: planForm.goal.trim(),
        planOfAction: planForm.planOfAction.trim(),
        timeSpan: planForm.timeSpan.trim(),
        resources: planForm.resources,
        followUpPlan: planForm.followUpPlan.trim(),
        remarks: planForm.remarks.trim(),
        status: "Planned",
        approvalStatus: "Pending Review",
      };

      const existingPlans = selectedCase.interventionPlans || [];

      const data = await apiRequest(`/cases/${selectedCase._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          interventionPlans: [...existingPlans, newPlan],
        }),
      });

      let updatedCase = data?.case;

      if (!updatedCase) {
        throw new Error("The backend did not return the updated case.");
      }

      if (resourceFiles.length > 0) {
        const previousPlanIds = new Set(
          existingPlans.map((plan) => String(plan._id)),
        );

        const createdPlan = [...(updatedCase.interventionPlans || [])]
          .reverse()
          .find((plan) => !previousPlanIds.has(String(plan._id)));

        if (!createdPlan?._id) {
          throw new Error(
            "The plan was created, but its ID could not be identified for the file upload.",
          );
        }

        const uploadData = await uploadPlanResources(
          updatedCase._id,
          createdPlan._id,
        );

        updatedCase = uploadData?.case || updatedCase;
      }

      setSelectedCase(updatedCase);
      setCases((current) =>
        current.map((caseRecord) =>
          (caseRecord._id || caseRecord.id) === updatedCase._id
            ? updatedCase
            : caseRecord,
        ),
      );

      setPlanModalOpen(false);
      resetResourceForm();
      setSuccessMessage(
        data?.message || "Manual intervention plan created.",
      );
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setModalError(
        error.message || "Unable to create the intervention plan.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openReviewModal = (mode, plan) => {
    if (!canManagePlans) {
      setPageError(
        readOnlyReason ||
          "You are not authorized to modify this intervention plan.",
      );
      return;
    }

    setReviewMode(mode);
    setSelectedPlan(plan);
    setRejectionReason("");
    resetResourceForm();

    setPlanForm({
      problem: plan.problem || "",
      goal: plan.goal || "",
      planOfAction: plan.planOfAction || "",
      timeSpan: plan.timeSpan || "",
      resources: plan.resources || [],
      followUpPlan: plan.followUpPlan || "",
      remarks: plan.remarks || "",
    });

    setModalError("");
    setReviewModalOpen(true);
  };

  const handlePlanAction = async (event) => {
    event.preventDefault();

    if (!selectedCase || !selectedPlan) return;

    if (!canManagePlans) {
      setModalError(
        readOnlyReason ||
          "You are not authorized to modify this intervention plan.",
      );
      return;
    }

    setIsSaving(true);
    setModalError("");

    try {
      let endpoint = "";
      let method = "PATCH";
      let body;

      if (reviewMode === "approve") {
        endpoint = `/cases/${selectedCase._id}/intervention-plans/${selectedPlan._id}/approve`;
      } else if (reviewMode === "revise") {
        endpoint = `/cases/${selectedCase._id}/intervention-plans/${selectedPlan._id}/revise`;
        body = JSON.stringify({
          problem: planForm.problem.trim(),
          goal: planForm.goal.trim(),
          planOfAction: planForm.planOfAction.trim(),
          timeSpan: planForm.timeSpan.trim(),
          resources: planForm.resources,
          followUpPlan: planForm.followUpPlan.trim(),
          remarks: planForm.remarks.trim(),
        });
      } else if (reviewMode === "reject") {
        endpoint = `/cases/${selectedCase._id}/intervention-plans/${selectedPlan._id}/reject`;
        body = JSON.stringify({
          rejectionReason: rejectionReason.trim(),
        });
      } else if (reviewMode === "send") {
        endpoint = `/cases/${selectedCase._id}/intervention-plans/${selectedPlan._id}/send`;
        method = "POST";
      }

      const data = await apiRequest(endpoint, {
        method,
        ...(body ? { body } : {}),
      });

      let updatedCase = data?.case;

      if (!updatedCase) {
        throw new Error("The backend did not return the updated case.");
      }

      if (reviewMode === "revise" && resourceFiles.length > 0) {
        const uploadData = await uploadPlanResources(
          selectedCase._id,
          selectedPlan._id,
        );

        updatedCase = uploadData?.case || updatedCase;
      }

      setSelectedCase(updatedCase);
      setCases((current) =>
        current.map((caseRecord) =>
          (caseRecord._id || caseRecord.id) === updatedCase._id
            ? updatedCase
            : caseRecord,
        ),
      );

      setReviewModalOpen(false);
      setSuccessMessage(
        data?.message || "Intervention plan updated successfully.",
      );
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setModalError(
        error.message || "Unable to process the intervention plan.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#2F2A27]">
      <AppSidebar
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#E4DFDC] text-[#655E59] lg:hidden"
                aria-label="Open navigation"
              >
                <Icon name="menu" className="h-4 w-4" />
              </button>

              {isFocusedCaseMode && (
                <button
                  type="button"
                  onClick={() => navigate(`/cases/${requestedCaseId}`)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-[#817A76] hover:bg-[#F5F2F0] hover:text-[#8C1518]"
                  aria-label="Back to case details"
                >
                  <Icon name="arrowLeft" className="h-3.5 w-3.5" />
                </button>
              )}

              <div>
                <h1 className="text-[20px] font-semibold">
                  Intervention Plans
                </h1>
                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  Review intervention plans and manage them according to your case permissions
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <PermissionTooltip
                disabled={!canManagePlans}
                message={readOnlyReason}
              >
                <button
                  type="button"
                  onClick={openRecommendationWorkspace}
                  disabled={!canManagePlans}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#8C1518] bg-white px-3 font-semibold text-[#8C1518] hover:bg-[#F8EEEE] disabled:cursor-not-allowed disabled:border-[#D8D2CE] disabled:bg-[#F4F1EF] disabled:text-[#9C948F] disabled:opacity-100"
                  style={{ fontSize: "15px" }}
                >
                  <Icon name="sparkle" className="h-3 w-3" />
                  Generate recommendation
                </button>
              </PermissionTooltip>

              <PermissionTooltip
                disabled={!canManagePlans}
                message={readOnlyReason}
              >
                <button
                  type="button"
                  onClick={openCreateModal}
                  disabled={!canManagePlans}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013] disabled:cursor-not-allowed disabled:bg-[#D7D1CD] disabled:text-[#827A76] disabled:opacity-100"
                  style={{ fontSize: "15px" }}
                >
                  <Icon name="plus" className="h-3 w-3" />
                  Create manual plan
                </button>
              </PermissionTooltip>
            </div>
          </div>
        </header>

        <main className="page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7">
          {successMessage && (
            <Alert tone="success" message={successMessage} />
          )}

          {pageError && <Alert tone="error" message={pageError} />}

          {!isFocusedCaseMode && (
            <section>
              <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
              Intervention planning workspace
            </h2>

            <p className="mt-1 max-w-[820px] text-[14px] leading-4 text-[#89817D]">
              Counselors can create intervention plans manually or open the
              LLM Recommendations workspace to generate a counselor-reviewed
              recommendation draft for the selected case.
              </p>
            </section>
          )}

          <div
            className={`grid gap-5 ${
              isFocusedCaseMode
                ? "mt-0 grid-cols-1"
                : "mt-5 xl:grid-cols-[390px_minmax(0,1fr)]"
            }`}
          >
            {!isFocusedCaseMode && (
              <section className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
              <div className="border-b border-[#ECE8E5] p-4">
                <h3 className="text-[17px] font-semibold">
                  Accessible cases
                </h3>

                <p className="mt-1 text-[13px] text-[#938B86]">
                  {filteredCases.length} case
                  {filteredCases.length === 1 ? "" : "s"} displayed
                </p>

                <div className="mt-4 space-y-2">
                  <div className="relative">
                    <Icon
                      name="search"
                      className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#AAA29D]"
                    />

                    <input
                      type="search"
                      value={searchInput}
                      onChange={(event) =>
                        setSearchInput(event.target.value)
                      }
                      placeholder="Search case or student..."
                      className="h-8 w-full rounded-lg border border-[#E1DCD8] bg-[#FAF9F8] pl-8 pr-2.5 outline-none focus:border-[#8C1518]"
                      style={{ fontSize: "15px" }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={caseStatusFilter}
                      onChange={(event) =>
                        setCaseStatusFilter(event.target.value)
                      }
                      className={filterClass}
                      style={{ fontSize: "15px" }}
                    >
                      <option value="">All case statuses</option>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="For Follow-up">For Follow-up</option>
                      <option value="Closed">Closed</option>
                      <option value="Terminated">Terminated</option>
                    </select>

                    <select
                      value={planStatusFilter}
                      onChange={(event) =>
                        setPlanStatusFilter(event.target.value)
                      }
                      className={filterClass}
                      style={{ fontSize: "15px" }}
                    >
                      <option value="">All plan statuses</option>
                      <option value="Pending Review">Pending Review</option>
                      <option value="Approved">Approved</option>
                      <option value="Revised">Revised</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Planned">Planned</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>

              <CaseList
                cases={filteredCases}
                selectedCaseId={selectedCaseId}
                isLoading={isLoadingCases}
                onSelect={setSelectedCaseId}
                />
              </section>
            )}

            <section className="min-w-0 overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
              {!selectedCaseId ? (
                <EmptyState
                  title="Select a case"
                  message="Choose a case to view or create intervention plans."
                />
              ) : isLoadingCase ? (
                <LoadingState />
              ) : selectedCase ? (
                <>
                  <CaseHeader
                    caseRecord={selectedCase}
                    canCreate={canManagePlans}
                    isReadOnly={isTemporaryReadOnly}
                    readOnlyReason={readOnlyReason}
                    onCreate={openCreateModal}
                    onGenerate={openRecommendationWorkspace}
                  />

                  {isTemporaryReadOnly && (
                    <ReadOnlyAccessNotice
                      accessUntil={
                        currentTemporaryAccess?.accessUntil
                      }
                    />
                  )}

                  <div className="border-b border-[#ECE8E5] p-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoCard
                        label="Case status"
                        value={selectedCase.caseStatus || "—"}
                      />
                      <InfoCard
                        label="Priority"
                        value={selectedCase.priorityLevel || "—"}
                      />
                      <InfoCard
                        label="Main domain"
                        value={
                          selectedCase.problemAssessment?.mainDomain ||
                          "—"
                        }
                      />
                      <InfoCard
                        label="Plans"
                        value={String(interventionPlans.length)}
                      />
                    </div>
                  </div>

                  <div className="border-b border-[#ECE8E5] px-4 py-3">
                    <div className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700">
                          <Icon name="sparkle" className="h-3.5 w-3.5" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-violet-800">
                            Need a recommendation draft?
                          </p>

                          <p className="mt-1 max-w-[620px] text-[13px] leading-4 text-violet-700">
                            Open the LLM Recommendations workspace for this case.
                            You can revise, accept, or reject the draft
                            before it becomes an intervention plan.
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 justify-start sm:justify-end">
                        <PermissionTooltip
                          disabled={!canManagePlans}
                          message={readOnlyReason}
                        >
                          <button
                            type="button"
                            onClick={openRecommendationWorkspace}
                            disabled={!canManagePlans}
                            className="inline-flex h-8 min-w-[148px] items-center justify-center whitespace-nowrap rounded-lg bg-violet-700 px-3 font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-violet-200 disabled:text-violet-700 disabled:opacity-100"
                            style={{ fontSize: "15px" }}
                          >
                            Open recommendations
                          </button>
                        </PermissionTooltip>
                      </div>
                    </div>
                  </div>

                  <PlanList
                    plans={interventionPlans}
                    caseRecord={selectedCase}
                    canManage={canManagePlans}
                    readOnlyReason={readOnlyReason}
                    onAction={openReviewModal}
                  />
                </>
              ) : (
                <EmptyState
                  title="Unable to display case"
                  message="Select another accessible case."
                />
              )}
            </section>
          </div>
        </main>
      </div>

      <PlanEditorModal
        open={planModalOpen && canManagePlans}
        title="Create manual intervention plan"
        description={
          selectedCase
            ? `${selectedCase.caseNumber} · ${formatStudentName(
                selectedCase.student,
              )}`
            : ""
        }
        form={planForm}
        setForm={setPlanForm}
        resourceFiles={resourceFiles}
        setResourceFiles={setResourceFiles}
        resourceTitle={resourceTitle}
        setResourceTitle={setResourceTitle}
        resourceDescription={resourceDescription}
        setResourceDescription={setResourceDescription}
        error={modalError}
        saving={isSaving}
        submitLabel="Create plan"
        onClose={() => {
          setPlanModalOpen(false);
          resetResourceForm();
        }}
        onSubmit={saveManualPlan}
      />

      <ReviewModal
        open={reviewModalOpen && canManagePlans}
        mode={reviewMode}
        plan={selectedPlan}
        student={selectedCase?.student}
        form={planForm}
        setForm={setPlanForm}
        resourceFiles={resourceFiles}
        setResourceFiles={setResourceFiles}
        resourceTitle={resourceTitle}
        setResourceTitle={setResourceTitle}
        resourceDescription={resourceDescription}
        setResourceDescription={setResourceDescription}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        error={modalError}
        saving={isSaving}
        onClose={() => setReviewModalOpen(false)}
        onSubmit={handlePlanAction}
      />
    </div>
  );
}

function CaseList({
  cases,
  selectedCaseId,
  isLoading,
  onSelect,
}) {
  if (isLoading) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <div className="text-center">
          <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />
          <p className="mt-3 text-[14px] text-[#827B77]">
            Loading cases...
          </p>
        </div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <EmptyState
        title="No accessible cases"
        message="Adjust the filters or verify the case assignment or temporary-access grant."
        compact
      />
    );
  }

  return (
    <div className="max-h-[680px] divide-y divide-[#EEEAE7] overflow-y-auto">
      {cases.map((caseRecord) => {
        const caseId = caseRecord._id || caseRecord.id;
        const selected = selectedCaseId === caseId;
        const plans = caseRecord.interventionPlans || [];

        return (
          <button
            key={caseId}
            type="button"
            onClick={() => onSelect(caseId)}
            className={`block w-full px-4 py-3.5 text-left transition ${
              selected
                ? "bg-[#F6ECEC]"
                : "bg-white hover:bg-[#FCFBFA]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">
                  {formatStudentName(caseRecord.student)}
                </p>

                <p className="mt-1 text-[13px] text-[#938B86]">
                  {caseRecord.caseNumber || "No case number"} ·{" "}
                  {caseRecord.student?.studentIdNumber || "No student ID"}
                </p>
              </div>

              <CaseStatusBadge status={caseRecord.caseStatus} />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {caseRecord.accessType === "Temporary" && (
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[12px] font-semibold text-blue-700">
                    Temporary
                  </span>
                )}

                <span className="truncate text-[13px] text-[#9A928D]">
                  {caseRecord.problemAssessment?.mainDomain || "No domain"}
                </span>
              </div>

              <span className="rounded-full bg-[#F1EEEC] px-2 py-1 text-[13px] text-[#6E6763]">
                {plans.length} plan{plans.length === 1 ? "" : "s"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CaseHeader({
  caseRecord,
  canCreate,
  isReadOnly,
  readOnlyReason,
  onCreate,
  onGenerate,
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-[#ECE8E5] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-semibold">
            {formatStudentName(caseRecord.student)}
          </h3>

          <CaseStatusBadge status={caseRecord.caseStatus} />

          {isReadOnly && (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[13px] font-semibold text-blue-700">
              Read only
            </span>
          )}
        </div>

        <p className="mt-1 text-[14px] text-[#938B86]">
          {caseRecord.caseNumber} ·{" "}
          {caseRecord.student?.studentIdNumber || "No student ID"}
        </p>

        <p className="mt-1 text-[13px] text-[#AAA19C]">
          Assigned to {formatCounselorName(caseRecord.assignedCounselor)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <PermissionTooltip
          disabled={!canCreate}
          message={readOnlyReason}
        >
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canCreate}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#8C1518] bg-white px-3 font-semibold text-[#8C1518] hover:bg-[#F8EEEE] disabled:cursor-not-allowed disabled:border-[#D8D2CE] disabled:bg-[#F4F1EF] disabled:text-[#9C948F] disabled:opacity-100"
            style={{ fontSize: "15px" }}
          >
            <Icon name="sparkle" className="h-3 w-3" />
            Generate recommendation
          </button>
        </PermissionTooltip>

        <PermissionTooltip
          disabled={!canCreate}
          message={readOnlyReason}
        >
          <button
            type="button"
            onClick={onCreate}
            disabled={!canCreate}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013] disabled:cursor-not-allowed disabled:bg-[#D7D1CD] disabled:text-[#827A76] disabled:opacity-100"
            style={{ fontSize: "15px" }}
          >
            <Icon name="plus" className="h-3 w-3" />
            Create manual plan
          </button>
        </PermissionTooltip>
      </div>
    </header>
  );
}

function PlanList({
  plans,
  caseRecord,
  canManage,
  readOnlyReason,
  onAction,
}) {
  if (plans.length === 0) {
    return (
      <EmptyState
        title="No intervention plans yet"
        message={
          canManage
            ? "Create a manual plan or generate a counselor-reviewed recommendation draft for this case."
            : "The assigned counselor has not created an intervention plan for this case."
        }
      />
    );
  }

  return (
    <div className="max-h-[680px] space-y-3 overflow-y-auto p-4">
      {plans.map((plan) => (
        <article
          key={plan._id}
          className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ApprovalBadge status={plan.approvalStatus} />
                <PlanStatusBadge status={plan.status} />

                {plan.isSentToStudent && (
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[13px] font-medium text-blue-700">
                    Sent
                  </span>
                )}

                {!canManage && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[13px] font-medium text-slate-700">
                    Read only
                  </span>
                )}
              </div>

              <h4 className="mt-3 whitespace-pre-wrap break-words text-justify text-[15px] font-normal leading-6">
                {plan.problem || "Intervention plan"}
              </h4>

              <p className="mt-1 text-[13px] text-[#9A928D]">
                Created {formatDateTime(plan.createdAt)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <PlanSection label="Goal" value={plan.goal} />
            <PlanSection label="Time span" value={plan.timeSpan} />
          </div>

          <PlanSection
            label="Plan of action"
            value={plan.planOfAction}
            required
          />

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <PlanSection
              label="Follow-up plan"
              value={plan.followUpPlan}
            />
            <PlanSection label="Remarks" value={plan.remarks} />
          </div>

          <PlanResources resources={plan.resources || []} />

          {plan.rejectionReason && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-[13px] font-semibold text-red-700">
                Rejection reason
              </p>
              <p className="mt-1 text-[14px] leading-4 text-red-700">
                {plan.rejectionReason}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#ECE8E5] pt-3">
            {plan.approvalStatus !== "Rejected" && (
              <PermissionTooltip
                disabled={!canManage}
                message={readOnlyReason}
              >
                <ActionButton
                  disabled={!canManage}
                  disabledMessage={readOnlyReason}
                  onClick={() => onAction("revise", plan)}
                >
                  Revise
                </ActionButton>
              </PermissionTooltip>
            )}

            {plan.approvalStatus !== "Approved" &&
              plan.approvalStatus !== "Rejected" && (
                <PermissionTooltip
                  disabled={!canManage}
                  message={readOnlyReason}
                >
                  <ActionButton
                    disabled={!canManage}
                    disabledMessage={readOnlyReason}
                    onClick={() => onAction("approve", plan)}
                  >
                    Approve
                  </ActionButton>
                </PermissionTooltip>
              )}

            {plan.approvalStatus !== "Rejected" &&
              !plan.isSentToStudent && (
                <PermissionTooltip
                  disabled={!canManage}
                  message={readOnlyReason}
                >
                  <ActionButton
                    danger
                    disabled={!canManage}
                    disabledMessage={readOnlyReason}
                    onClick={() => onAction("reject", plan)}
                  >
                    Reject
                  </ActionButton>
                </PermissionTooltip>
              )}

            {plan.approvalStatus === "Approved" &&
              !plan.isSentToStudent &&
              !["Closed", "Terminated"].includes(
                caseRecord.caseStatus,
              ) && (
                <PermissionTooltip
                  disabled={!canManage}
                  message={readOnlyReason}
                >
                  <ActionButton
                    primary
                    disabled={!canManage}
                    disabledMessage={readOnlyReason}
                    onClick={() => onAction("send", plan)}
                  >
                    Send to student
                  </ActionButton>
                </PermissionTooltip>
              )}
          </div>
        </article>
      ))}
    </div>
  );
}

function PlanResources({ resources }) {
  return (
    <section className="mt-4">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        Attached resources
      </p>

      {resources.length > 0 ? (
        <div className="mt-2 space-y-2">
          {resources.map((resource, index) => (
            <div
              key={
                resource._id ||
                resource.url ||
                `${resource.title}-${index}`
              }
              className="flex items-center justify-between gap-3 rounded-lg border border-[#E4DFDC] bg-white px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
                  <Icon name="file" className="h-3.5 w-3.5" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#403A37]">
                    {resource.title || "Untitled resource"}
                  </p>

                  <p className="mt-0.5 text-[13px] text-[#958D88]">
                    {resource.type || "File"}
                  </p>

                  {resource.description && (
                    <p className="mt-1 line-clamp-2 text-[13px] leading-4 text-[#716A66]">
                      {resource.description}
                    </p>
                  )}
                </div>
              </div>

              {resource.url && (
                <a
                  href={getResourceUrl(resource.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg border border-[#D9D2CE] bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#8C1518] hover:border-[#8C1518]"
                >
                  Open
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[14px] text-[#958D88]">
          No files are attached to this intervention plan.
        </p>
      )}
    </section>
  );
}

function PlanEditorModal({
  open,
  title,
  description,
  form,
  setForm,
  resourceFiles,
  setResourceFiles,
  resourceTitle,
  setResourceTitle,
  resourceDescription,
  setResourceDescription,
  error,
  saving,
  submitLabel,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <Modal title={title} description={description} onClose={onClose}>
      <form onSubmit={onSubmit}>
        {error && <Alert tone="error" message={error} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Problem" required className="sm:col-span-2">
            <textarea
              required
              value={form.problem}
              onChange={(event) => update("problem", event.target.value)}
              placeholder="State the identified problem or concern."
              rows={3}
              className={textareaClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Goal" className="sm:col-span-2">
            <textarea
              value={form.goal}
              onChange={(event) => update("goal", event.target.value)}
              placeholder="State the intended counseling or intervention outcome."
              rows={3}
              className={textareaClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Plan of action" required className="sm:col-span-2">
            <textarea
              required
              value={form.planOfAction}
              onChange={(event) =>
                update("planOfAction", event.target.value)
              }
              placeholder="Describe the intervention activities, techniques, and responsibilities."
              rows={5}
              className={textareaClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Time span">
            <input
              value={form.timeSpan}
              onChange={(event) => update("timeSpan", event.target.value)}
              placeholder="e.g., 4 sessions over 1 month"
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Follow-up plan">
            <input
              value={form.followUpPlan}
              onChange={(event) =>
                update("followUpPlan", event.target.value)
              }
              placeholder="e.g., Review after 2 weeks"
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <div className="sm:col-span-2 rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
                <Icon name="folder" className="h-3.5 w-3.5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">
                  Supporting files
                </p>
                <p className="mt-1 text-[13px] leading-4 text-[#8D8580]">
                  Attach one or more worksheets, guides, forms, or other resources to this intervention plan.
                </p>
              </div>
            </div>

            <KnowledgeMaterialSelector resources={form.resources || []} onChange={resources => update('resources', resources)} disabled={saving} />

            {form.resources?.length > 0 && (
              <div className="mt-4">
                <p className="text-[14px] font-semibold text-[#4B4541]">
                  Existing attached files
                </p>

                <p className="mt-1 text-[13px] leading-4 text-[#8D8580]">
                  These files are already saved with the intervention plan.
                  Remove only the files that should no longer belong to this
                  plan.
                </p>

                <div className="mt-2 space-y-2">
                  {form.resources.map((resource, index) => (
                    <div
                      key={resource._id || resource.url || `${resource.title}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#E4DFDC] bg-white px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
                          <Icon
                            name="file"
                            className="h-3.5 w-3.5"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-[#403A37]">
                            {resource.title || "Untitled resource"}
                          </p>

                          <p className="mt-0.5 text-[13px] text-[#958D88]">
                            {resource.type || "File"}
                          </p>

                          {resource.description && (
                            <p className="mt-1 line-clamp-2 text-[13px] leading-4 text-[#716A66]">
                              {resource.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {resource.url && (
                          <a
                            href={getResourceUrl(resource.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-[#D9D2CE] bg-white px-2.5 py-1.5 !text-[15px] font-semibold text-[#8C1518] hover:border-[#8C1518]"
                          >
                            Open
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              resources: (current.resources || []).filter(
                                (_, resourceIndex) =>
                                  resourceIndex !== index,
                              ),
                            }))
                          }
                          className="rounded-lg border border-[#D9D2CE] bg-white px-2.5 py-1.5 !text-[15px] font-semibold text-red-600 hover:border-[#8C1518]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Resource title">
                <input
                  value={resourceTitle}
                  onChange={(event) =>
                    setResourceTitle(event.target.value)
                  }
                  placeholder="Optional title (used when one file is selected)"
                  className={inputClass}
                  style={{ fontSize: "15px" }}
                />
              </Field>

              <Field label="Choose files">
                <input
                  type="file"
                  multiple
                  onChange={(event) =>
                    setResourceFiles(Array.from(event.target.files || []))
                  }
                  className="block w-full rounded-lg border border-[#DDD8D4] bg-white px-3 py-2 !text-[15px] text-[#5E5753] file:mr-3 file:rounded-md file:border-0 file:bg-[#F4EAEA] file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-[#8C1518]"
                />
              </Field>

              <Field
                label="Resource description"
                className="sm:col-span-2"
              >
                <textarea
                  value={resourceDescription}
                  onChange={(event) =>
                    setResourceDescription(event.target.value)
                  }
                  placeholder="Briefly explain how the student should use this resource."
                  rows={2}
                  className={textareaClass}
                  style={{ fontSize: "15px" }}
                />
              </Field>

              {resourceFiles.length > 0 && (
                <div className="sm:col-span-2 space-y-2 rounded-lg border border-[#E4DFDC] bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-[#514A46]">
                      {resourceFiles.length} file{resourceFiles.length === 1 ? "" : "s"} selected
                    </p>

                    <button
                      type="button"
                      onClick={() => setResourceFiles([])}
                      className="shrink-0 !text-[15px] font-semibold text-red-600"
                    >
                      Remove all
                    </button>
                  </div>

                  {resourceFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-[#F8F6F5] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[#514A46]">
                          {file.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#9A928D]">
                          {formatFileSize(file.size)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setResourceFiles((current) =>
                            current.filter((_, fileIndex) => fileIndex !== index),
                          )
                        }
                        className="shrink-0 !text-[15px] font-semibold text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Field label="Remarks" className="sm:col-span-2">
            <textarea
              value={form.remarks}
              onChange={(event) => update("remarks", event.target.value)}
              placeholder="Add relevant notes for counselor review."
              rows={3}
              className={textareaClass}
              style={{ fontSize: "15px" }}
            />
          </Field>
        </div>

        <ModalActions
          saving={saving}
          submitLabel={submitLabel}
          onClose={onClose}
        />
      </form>
    </Modal>
  );
}

function ReviewModal({
  open,
  mode,
  plan,
  student,
  form,
  setForm,
  resourceFiles,
  setResourceFiles,
  resourceTitle,
  setResourceTitle,
  resourceDescription,
  setResourceDescription,
  rejectionReason,
  setRejectionReason,
  error,
  saving,
  onClose,
  onSubmit,
}) {
  if (!open || !plan) return null;

  if (mode === "revise") {
    return (
      <PlanEditorModal
        open
        title="Revise intervention plan"
        description="Edit the plan before returning it for review."
        form={form}
        setForm={setForm}
        resourceFiles={resourceFiles}
        setResourceFiles={setResourceFiles}
        resourceTitle={resourceTitle}
        setResourceTitle={setResourceTitle}
        resourceDescription={resourceDescription}
        setResourceDescription={setResourceDescription}
        error={error}
        saving={saving}
        submitLabel="Save revision"
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );
  }

  const titles = {
    approve: "Approve intervention plan",
    reject: "Reject intervention plan",
    send: "Send approved plan",
  };

  const descriptions = {
    approve:
      "Confirm that the plan is complete and ready for implementation.",
    reject:
      "Provide the reason the intervention plan should not be used.",
    send:
      student?.email
        ? `The approved plan will be sent to ${student.email}.`
        : "The student does not have a registered email address.",
  };

  return (
    <Modal
      title={titles[mode]}
      description={descriptions[mode]}
      onClose={onClose}
      narrow
    >
      <form onSubmit={onSubmit}>
        {error && <Alert tone="error" message={error} />}

        {mode === "send" && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 ${
              student?.email
                ? "border-blue-200 bg-blue-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                  student?.email
                    ? "bg-blue-100 text-blue-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                <Icon
                  name="mail"
                  className="h-3.5 w-3.5"
                />
              </div>

              <div className="min-w-0">
                <p
                  className={`text-[13px] font-semibold uppercase tracking-[0.08em] ${
                    student?.email
                      ? "text-blue-700"
                      : "text-red-700"
                  }`}
                >
                  Email recipient
                </p>

                <p
                  className={`mt-1 break-all text-[15px] font-semibold ${
                    student?.email
                      ? "text-blue-900"
                      : "text-red-700"
                  }`}
                >
                  {student?.email ||
                    "No registered student email"}
                </p>

                <p
                  className={`mt-1 text-[13px] leading-4 ${
                    student?.email
                      ? "text-blue-700"
                      : "text-red-600"
                  }`}
                >
                  {student?.email
                    ? `Please confirm that this is the correct email for ${formatStudentName(
                        student,
                      )} before sending.`
                    : "Update the student record with a valid email address before sending this intervention plan."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">

          <p className="mt-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
            Plan of action
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[14px] leading-4">
            {plan.planOfAction}
          </p>
        </div>

        <div className="mt-5">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
                Attached resources
            </p>

            {plan?.resources?.length > 0 ? (
                <div className="mt-2 space-y-2">
                {plan.resources.map((resource) => (
                    <div
                    key={resource._id || resource.url}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#E4DFDC] bg-[#FAF9F8] px-3 py-2.5"
                    >
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
                        <Icon
                            name="file"
                            className="h-3.5 w-3.5"
                        />
                        </div>

                        <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-[#403A37]">
                            {resource.title || "Untitled resource"}
                        </p>

                        <p className="mt-0.5 text-[13px] text-[#958D88]">
                            {resource.type || "File"}
                        </p>

                        {resource.description && (
                            <p className="mt-1 text-[13px] leading-4 text-[#716A66]">
                            {resource.description}
                            </p>
                        )}
                        </div>
                    </div>

                    {resource.url && (
                        <a
                        href={getResourceUrl(resource.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-lg border border-[#D9D2CE] bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#8C1518] hover:border-[#8C1518]"
                        >
                        Open
                        </a>
                    )}
                    </div>
                ))}
                </div>
            ) : (
                <p className="mt-2 text-[14px] text-[#958D88]">
                No files are attached to this intervention plan.
                </p>
            )}
            </div>

        {mode === "reject" && (
          <Field label="Rejection reason" required className="mt-4">
            <textarea
              required
              value={rejectionReason}
              onChange={(event) =>
                setRejectionReason(event.target.value)
              }
              placeholder="Explain why this intervention plan is rejected."
              rows={4}
              className={textareaClass}
              style={{ fontSize: "15px" }}
            />
          </Field>
        )}

        <ModalActions
          saving={saving}
          disabled={
            mode === "send" &&
            !student?.email
          }
          submitLabel={
            mode === "approve"
              ? "Approve plan"
              : mode === "reject"
                ? "Reject plan"
                : student?.email
                  ? "Send plan"
                  : "Email required"
          }
          danger={mode === "reject"}
          onClose={onClose}
        />
      </form>
    </Modal>
  );
}

function Modal({
  title,
  description,
  onClose,
  narrow = false,
  children,
}) {
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close modal"
      />

      <section
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)] ${
          narrow ? "max-w-[560px]" : "max-w-[860px]"
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">{title}</h2>
            <p className="mt-1 text-[14px] text-[#938B86]">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#8C847F] hover:bg-[#F4F1EF]"
            aria-label="Close"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  );
}

function ModalActions({
  saving,
  submitLabel,
  onClose,
  danger = false,
  disabled = false,
}) {
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-[#ECE8E5] pt-4">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 font-medium text-[#5E5753] disabled:opacity-40"
        style={{ fontSize: "15px" }}
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={saving || disabled}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 font-semibold text-white disabled:opacity-60 ${
          danger
            ? "bg-red-600 hover:bg-red-700"
            : "bg-[#8C1518] hover:bg-[#701013]"
        }`}
        style={{ fontSize: "15px" }}
      >
        {saving && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}

        {saving ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function ActionButton({
  onClick,
  children,
  primary = false,
  danger = false,
  disabled = false,
  disabledMessage = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledMessage : undefined}
      className={`h-7 rounded-lg border px-2.5 font-semibold ${
        disabled
          ? "cursor-not-allowed border-[#DDD7D3] bg-[#F2EFED] text-[#9A928D]"
          : primary
            ? "border-[#8C1518] bg-[#8C1518] text-white"
            : danger
              ? "border-red-200 bg-red-50 text-red-600"
              : "border-[#DCD6D2] bg-white text-[#5A534F] hover:border-[#8C1518] hover:text-[#8C1518]"
      }`}
      style={{ fontSize: "15px" }}
    >
      {children}
    </button>
  );
}

function PermissionTooltip({
  disabled,
  message,
  children,
}) {
  if (!disabled) {
    return children;
  }

  return (
    <span className="group relative inline-flex">
      {children}

      <span
        role="tooltip"
        className="
          pointer-events-none
          absolute
          right-0
          top-[calc(100%+8px)]
          z-[200]
          hidden
          w-[260px]
          rounded-lg
          bg-[#2F2926]
          px-3
          py-2
          text-left
          text-[13px]
          font-medium
          leading-4
          text-white
          shadow-xl
          group-hover:block
          group-focus-within:block
        "
      >
        {message ||
          "You are not allowed to perform this action."}

        <span
          className="
            absolute
            bottom-full
            right-4
            border-4
            border-transparent
            border-b-[#2F2926]
          "
        />
      </span>
    </span>
  );
}

function ReadOnlyAccessNotice({ accessUntil }) {
  return (
    <div className="border-b border-[#ECE8E5] px-4 py-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
            <Icon name="eye" className="h-3.5 w-3.5" />
          </div>

          <div>
            <p className="text-[14px] font-semibold text-blue-800">
              Read-only temporary access
            </p>

            <p className="mt-1 text-[13px] leading-4 text-blue-700">
              You may review the intervention plans and open their
              attached resources. Only the assigned counselor can
              create, revise, approve, reject, upload, remove, or send
              intervention-plan content.
            </p>

            <p className="mt-1 text-[13px] font-semibold text-blue-700">
              Access expires {formatDateTime(accessUntil)}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <article className="rounded-xl border border-[#E8E3E0] bg-[#FCFBFA] p-3">
      <p className="text-[13px] text-[#958D88]">{label}</p>
      <p className="mt-1 break-words text-[14px] font-semibold text-[#4E4844]">
        {value}
      </p>
    </article>
  );
}

function PlanSection({ label, value, required = false }) {
  return (
    <section className="mt-3">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p className="mt-1 whitespace-pre-wrap text-[14px] leading-4 text-[#4F4945]">
        {value || (required ? "No information recorded." : "—")}
      </p>
    </section>
  );
}

function EmptyState({ title, message, compact = false }) {
  return (
    <div
      className={`grid place-items-center px-6 text-center ${
        compact ? "min-h-[420px]" : "min-h-[620px]"
      }`}
    >
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
          <Icon name="folder" className="h-5 w-5" />
        </div>

        <p className="mt-4 text-[16px] font-semibold">{title}</p>
        <p className="mt-1 text-[14px] text-[#938C87]">{message}</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[620px] place-items-center">
      <div className="text-center">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />
        <p className="mt-3 text-[14px] text-[#827B77]">
          Loading case details...
        </p>
      </div>
    </div>
  );
}

function Field({ label, required = false, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[14px] font-semibold text-[#4B4541]">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>

      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function CaseStatusBadge({ status }) {
  const styles = {
    Open: "bg-blue-50 text-blue-700",
    "In Progress": "bg-amber-50 text-amber-700",
    "For Follow-up": "bg-violet-50 text-violet-700",
    Closed: "bg-emerald-50 text-emerald-700",
    Terminated: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[status] || "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

function ApprovalBadge({ status }) {
  const styles = {
    "Pending Review": "bg-amber-50 text-amber-700",
    Approved: "bg-emerald-50 text-emerald-700",
    Revised: "bg-blue-50 text-blue-700",
    Rejected: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[status] || "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status || "Pending Review"}
    </span>
  );
}

function PlanStatusBadge({ status }) {
  const styles = {
    Planned: "bg-slate-100 text-slate-700",
    Ongoing: "bg-blue-50 text-blue-700",
    Completed: "bg-emerald-50 text-emerald-700",
    Cancelled: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[status] || "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status || "Planned"}
    </span>
  );
}

function Alert({ tone, message }) {
  const success = tone === "success";

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-[14px] ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

function getResourceUrl(resourceUrl) {
  if (!resourceUrl) {
    return "#";
  }

  if (
    resourceUrl.startsWith("http://") ||
    resourceUrl.startsWith("https://")
  ) {
    return resourceUrl;
  }

  const backendOrigin =
    import.meta.env.VITE_API_ORIGIN ||
    "http://localhost:5000";

  return `${backendOrigin}${resourceUrl}`;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatStudentName(student) {
  if (!student) return "Unknown student";

  return [student.firstName, student.lastName]
    .filter(Boolean)
    .join(" ");
}

function formatCounselorName(counselor) {
  if (!counselor) return "Unknown counselor";

  if (typeof counselor === "string") {
    return "Assigned counselor";
  }

  return [counselor.firstName, counselor.middleName, counselor.lastName]
    .filter(Boolean)
    .join(" ");
}

function formatDateTime(value) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const inputClass =
  "h-8 w-full rounded-lg border border-[#DDD8D4] bg-white px-2.5 !text-[14px] font-[Poppins] text-[#302B28] outline-none transition placeholder:!text-[14px] placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";

const textareaClass =
  "w-full resize-y rounded-lg border border-[#DDD8D4] bg-white px-2.5 py-2 !text-[14px] font-[Poppins] leading-4 text-[#302B28] outline-none transition placeholder:!text-[14px] placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";

const filterClass =
  "h-8 w-full min-w-0 rounded-lg border border-[#E1DCD8] bg-white px-2.5 outline-none focus:border-[#8C1518]";