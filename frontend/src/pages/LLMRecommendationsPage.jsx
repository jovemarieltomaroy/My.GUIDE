import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest, API_BASE_URL } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";

const EMPTY_RECOMMENDATION_FORM = {
  concernSummary: "",
  goal: "",
  suggestedInterventions: [""],
  planOfAction: "",
  timeSpan: "",
  followUpPlan: "",
  rationale: "",
  counselorRemarks: "",
  resources: [],
};

export default function LLMRecommendationsPage({ embedded = false, caseId = null }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedCaseId = caseId || searchParams.get("caseId");
  const isFocusedCaseMode = Boolean(requestedCaseId);
  const [generationSelection, setGenerationSelection] = useState({});
  const { user, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);
  const progressNotes = useMemo(() => [...(selectedCase?.progressNotes || [])].sort(
    (a, b) => new Date(b.noteDate || b.createdAt || 0) - new Date(a.noteDate || a.createdAt || 0)
  ), [selectedCase]);


  const selection = generationSelection[selectedCase?._id];
  const requestedNoteId = requestedCaseId === selectedCase?._id ? searchParams.get("progressNoteId") : null;
  const generationType = selection?.mode || (searchParams.get("mode") === "initial" ? "initial" : progressNotes.length || requestedNoteId ? "updated" : "initial");
  const selectedNoteId = selection?.noteId || requestedNoteId || progressNotes[0]?._id || "";
  const progressNote = progressNotes.find((note) => String(note._id) === String(selectedNoteId));
  const previousPlan = selectedCase?.interventionPlans?.find((plan) => String(plan._id) === String(progressNote?.interventionProgress?.interventionPlan));


  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [isLoadingCase, setIsLoadingCase] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState("");
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [recommendationForm, setRecommendationForm] = useState(EMPTY_RECOMMENDATION_FORM);
  const [rejectionReason, setRejectionReason] = useState("");
  const [resourceFiles, setResourceFiles] = useState([]);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");

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
        retrievedCases = await apiRequest("/cases", {
          method: "GET",
        });
      } else {
        retrievedCases = await apiRequest("/cases/my-cases", {
          method: "GET",
        });
      }

      if (!Array.isArray(retrievedCases)) {
        throw new Error("The backend returned an invalid cases response.");
      }

      const activeCases = retrievedCases.filter(
        (caseRecord) =>
          caseRecord.isArchived !== true &&
          !["Closed", "Terminated"].includes(caseRecord.caseStatus)
      );

      setCases(activeCases);

      if (
        selectedCaseId &&
        !activeCases.some((caseRecord) => (caseRecord._id || caseRecord.id) === selectedCaseId)
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

      setPageError(error.message || "Unable to retrieve cases.");
    } finally {
      setIsLoadingCases(false);
    }
  }, [user, isAdmin, selectedCaseId, handleUnauthorized]);

  useEffect(() => {
    if (!isFocusedCaseMode) fetchCases();
  }, [fetchCases, isFocusedCaseMode]);

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
        console.error("Unable to retrieve case details:", error);

        if (error.status === 401) {
          handleUnauthorized();
          return;
        }

        setSelectedCase(null);
        setPageError(error.message || "Unable to retrieve the selected case.");
      } finally {
        setIsLoadingCase(false);
      }
    },
    [handleUnauthorized]
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
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));

      const recommendations = caseRecord.llmRecommendations || [];

      const matchesStatus =
        !statusFilter ||
        recommendations.some((recommendation) => recommendation.status === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [cases, searchQuery, statusFilter]);

  const recommendations = useMemo(() => {
    return [...(selectedCase?.llmRecommendations || [])].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
  }, [selectedCase]);

  const canGenerate =
    selectedCase &&
    !selectedCase.isArchived &&
    !["Closed", "Terminated"].includes(selectedCase.caseStatus);

  const generateRecommendation = async () => {
    if (!selectedCase) return;
    if (generationType === "updated" && !progressNote) {
      setPageError("Select a saved progress note from this case.");
      return;
    }
    setIsGenerating(true);
    setPageError("");

    try {
      await assertCurrentRecommendationRuntime(fetch, API_BASE_URL, window.location.href);
      const data = await apiRequest(`/cases/${selectedCase._id}/llm-recommendations/generate`, {
        method: "POST",
        body: JSON.stringify({ mode: generationType, ...(generationType === "updated" ? { progressNoteId: selectedNoteId } : {}) }),
      });

      let updatedCase = data?.case;

      if (!updatedCase) {
        throw new Error("The backend did not return the updated case.");
      }

      updateCaseInState(updatedCase);
      if (import.meta.env.DEV) console.debug("[intervention-generation] display", {
        fieldSource: "saved-backend-recommendation",
        originalCasePlanFallbackTriggered: false,
        newRecommendationReturned: (updatedCase.llmRecommendations || []).some((item) =>
          !(selectedCase.llmRecommendations || []).some((previous) => previous._id === item._id)),
      });

      const newRecommendation = (updatedCase.llmRecommendations || []).find((item) =>
        !(selectedCase.llmRecommendations || []).some((previous) => previous._id === item._id));
      const outputIssue = generationOutputIssue(newRecommendation);
      if (outputIssue) {
        setSuccessMessage("");
        setPageError(outputIssue);
        return;
      }
      setSuccessMessage(data?.message || "Recommendation draft generated.");
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(error.message || "Unable to generate a recommendation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const resetResourceForm = () => {
    setResourceFiles([]);
    setResourceTitle("");
    setResourceDescription("");
  };

  const uploadRecommendationResources = async (caseId, recommendationId) => {
    if (resourceFiles.length === 0) {
      return null;
    }

    const formData = new FormData();

    resourceFiles.forEach((file) => {
      formData.append("files", file);
    });

    formData.append("title", resourceTitle.trim());

    formData.append("description", resourceDescription.trim());

    return apiRequest(`/cases/${caseId}/llm-recommendations/${recommendationId}/resources`, {
      method: "POST",
      body: formData,
    });
  };

  const openReviewModal = (mode, recommendation) => {
    setReviewMode(mode);
    setSelectedRecommendation(recommendation);
    setRejectionReason("");
    resetResourceForm();

    setRecommendationForm({
      selectedSuggestedMaterialIds: recommendation.preselectedMaterialId
        ? [recommendation.preselectedMaterialId]
        : [],
      concernSummary: recommendation.concernSummary || "",
      goal: recommendation.goal || "",
      suggestedInterventions:
        recommendation.suggestedInterventions?.length > 0
          ? recommendation.suggestedInterventions
          : [""],
      planOfAction: recommendation.planOfAction || "",
      timeSpan: recommendation.timeSpan || "",
      followUpPlan: recommendation.followUpPlan || "",
      rationale: recommendation.rationale || "",
      counselorRemarks: recommendation.counselorRemarks || "",
      resources: recommendation.resources || [],
    });

    setModalError("");
    setReviewModalOpen(true);
  };

  const submitRecommendationAction = async (event) => {
    event.preventDefault();

    if (!selectedCase || !selectedRecommendation) {
      return;
    }

    setIsSaving(true);
    setModalError("");

    try {
      let endpoint = "";
      let body;

      if (reviewMode === "revise") {
        endpoint = `/cases/${selectedCase._id}/llm-recommendations/${selectedRecommendation._id}/revise`;

        body = JSON.stringify({
          concernSummary: recommendationForm.concernSummary.trim(),
          goal: recommendationForm.goal.trim(),
          suggestedInterventions: recommendationForm.suggestedInterventions
            .map((item) => item.trim())
            .filter(Boolean),
          planOfAction: recommendationForm.planOfAction.trim(),
          timeSpan: recommendationForm.timeSpan.trim(),
          followUpPlan: recommendationForm.followUpPlan.trim(),
          rationale: recommendationForm.rationale.trim(),
          counselorRemarks: recommendationForm.counselorRemarks.trim(),
          resources: recommendationForm.resources || [],
        });
      }

      if (reviewMode === "accept") {
        endpoint = `/cases/${selectedCase._id}/llm-recommendations/${selectedRecommendation._id}/accept`;

        body = JSON.stringify({
          selectedSuggestedMaterialIds: recommendationForm.selectedSuggestedMaterialIds || [],
          counselorRemarks: recommendationForm.counselorRemarks.trim(),
        });
      }

      if (reviewMode === "reject") {
        endpoint = `/cases/${selectedCase._id}/llm-recommendations/${selectedRecommendation._id}/reject`;

        body = JSON.stringify({
          rejectionReason: rejectionReason.trim(),
        });
      }

      const data = await apiRequest(endpoint, {
        method: "PATCH",
        ...(body ? { body } : {}),
      });

      let updatedCase = data?.case;

      if (!updatedCase) {
        throw new Error("The backend did not return the updated case.");
      }

      if (reviewMode === "revise" && resourceFiles.length > 0) {
        const uploadData = await uploadRecommendationResources(
          selectedCase._id,
          selectedRecommendation._id
        );

        updatedCase = uploadData?.case || updatedCase;
      }

      updateCaseInState(updatedCase);
      setReviewModalOpen(false);
      resetResourceForm();

      setSuccessMessage(data?.message || "Recommendation updated successfully.");
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setModalError(error.message || "Unable to process the recommendation.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateCaseInState = (updatedCase) => {
    setSelectedCase(updatedCase);

    setCases((current) =>
      current.map((caseRecord) =>
        (caseRecord._id || caseRecord.id) === updatedCase._id ? updatedCase : caseRecord
      )
    );
  };

  if (!user) return null;

  return (
    <div
      className={
        embedded ? "text-[#2F2A27]" : "min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#2F2A27]"
      }
    >
      {!embedded && (
        <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      )}

      <div className={embedded ? "" : "min-h-screen lg:pl-[250px]"}>
        {!embedded && (
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
                  <h1 className="text-[20px] font-semibold">LLM Recommendations</h1>

                  <p className="hidden text-[14px] text-[#99918C] sm:block">
                    Generate and review intervention recommendation drafts
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={generateRecommendation}
                disabled={!canGenerate || isGenerating}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ fontSize: "15px" }}
              >
                {isGenerating ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Icon name="sparkle" className="h-3 w-3" />
                )}

                {isGenerating ? "Generating..." : "Generate recommendation"}
              </button>
            </div>
          </header>
        )}

        <div
          className={
            embedded ? "" : "page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7"
          }
        >
          {successMessage && <Alert tone="success" message={successMessage} />}

          {pageError && <Alert tone="error" message={pageError} />}

          <div className="rounded-xl border border-[#E7DDD5] bg-[#FCFAF8] px-4 py-3">
            <p className="text-[10px] leading-5 text-[#6F6661] text-justify">
              AI-generated intervention recommendations are advisory only. Review the suggested
              interventions, plan of action, rationale, and retrieved references before accepting
              the recommendation for use in an intervention plan.
            </p>
          </div>

          {!isFocusedCaseMode && (
            <section>
              <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
                Recommendation review workspace
              </h2>

              <p className="mt-1 max-w-[820px] text-[14px] leading-4 text-[#89817D] text-justify">
                Select an active case, generate a recommendation draft, then revise, accept, or
                reject it. Accepted recommendations become intervention-plan drafts and still
                require counselor approval.
              </p>
            </section>
          )}

          <div
            className={`grid gap-5 ${
              isFocusedCaseMode ? "mt-4 grid-cols-1" : "mt-5 xl:grid-cols-[390px_minmax(0,1fr)]"
            }`}
          >
            {!isFocusedCaseMode && (
              <section className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
                <div className="border-b border-[#ECE8E5] p-4">
                  <h3 className="text-[17px] font-semibold">Active cases</h3>

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
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search case or student..."
                        className="h-8 w-full rounded-lg border border-[#E1DCD8] bg-[#FAF9F8] pl-8 pr-2.5 outline-none focus:border-[#8C1518]"
                        style={{
                          fontSize: "15px",
                        }}
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className={filterClass}
                      style={{
                        fontSize: "15px",
                      }}
                    >
                      <option value="">All recommendation statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="Revised">Revised</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Rejected">Rejected</option>
                    </select>
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
                  message="Choose an active case to generate and review recommendations."
                />
              ) : isLoadingCase ? (
                <LoadingState />
              ) : selectedCase ? (
                <>
                  <CaseHeader
                    caseRecord={selectedCase}
                    canGenerate={canGenerate}
                    isGenerating={isGenerating}
                    onGenerate={generateRecommendation}
                    onGoToCase={() => navigate(`/cases/${selectedCase._id}`)}
                  />

                  <div className="border-b border-[#ECE8E5] p-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <InfoCard label="Case status" value={selectedCase.caseStatus || "—"} />
                      <InfoCard
                        label="Main domain"
                        value={selectedCase.problemAssessment?.mainDomain || "—"}
                      />
                      <InfoCard label="Recommendations" value={String(recommendations.length)} />
                    </div>
                  </div>

                  <div className="border-b border-[#ECE8E5] p-4 sm:p-5 text-[14px]">
                    <h3 className="text-[16px] font-semibold">Prepare recommendation</h3>
                    <p className="mt-1 text-[13px] text-[#817873]">
                      {generationType === "updated"
                        ? "Choose a saved progress note and review the context before generating."
                        : "Generate an initial recommendation using the case assessment."}
                    </p>
                    <div className={`mt-4 grid gap-4 ${generationType === "updated" ? "lg:grid-cols-2" : ""}`}>
                      <label className="block font-semibold">Generation mode
                        <select className={`${filterClass} mt-2 font-normal`} value={generationType} disabled={isGenerating}
                          onChange={(event) => setGenerationSelection((current) => ({ ...current, [selectedCase._id]: { mode: event.target.value, noteId: selectedNoteId } }))}>
                          <option value="initial">Initial Intervention</option>
                          <option value="updated" disabled={!progressNotes.length}>Updated Intervention</option>
                        </select>
                      </label>
                      {generationType === "updated" && (
                        <label className="block font-semibold">Saved progress note
                          <select className={`${filterClass} mt-2 font-normal`} value={selectedNoteId} disabled={isGenerating}
                            onChange={(event) => setGenerationSelection((current) => ({ ...current, [selectedCase._id]: { mode: "updated", noteId: event.target.value } }))}>
                            {!progressNote && <option value={selectedNoteId}>Selected note unavailable — choose a note</option>}
                            {progressNotes.map((note) => <option key={note._id} value={note._id}>{formatDateTime(note.noteDate || note.createdAt)} — {note.progressStatus}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                    {generationType === "updated" && (
                      progressNote ? (
                        <div className="mt-5 rounded-xl border border-[#E7E2DF] bg-[#FCFAF8] p-4 sm:p-5">
                          <h4 className="font-semibold">Progress note context</h4>
                          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-[#ECE8E5] bg-white px-3 py-2.5">
                              <dt className="text-[12px] text-[#817873]">Student response</dt>
                              <dd className="mt-1 font-medium">{progressNote.interventionProgress?.studentResponse || "Not Assessed"}</dd>
                            </div>
                            <div className="rounded-lg border border-[#ECE8E5] bg-white px-3 py-2.5">
                              <dt className="text-[12px] text-[#817873]">Goal progress</dt>
                              <dd className="mt-1 font-medium">{progressNote.interventionProgress?.goalProgress || "Not Assessed"}</dd>
                            </div>
                          </dl>
                          <div className="mt-4 space-y-4 text-[#625954]">
                            <div>
                              <h5 className="font-semibold text-[#38312D]">Session summary</h5>
                              <p className="mt-1 whitespace-pre-line break-words leading-6 text-justify">{progressNote.progressSummary || "Not documented"}</p>
                            </div>
                            <div className="border-t border-[#E7E2DF] pt-4">
                              <h5 className="font-semibold text-[#38312D]">Previous linked plan</h5>
                              <p className="mt-1 whitespace-pre-line break-words leading-6 text-justify">{previousPlan ? previousPlan.goal || previousPlan.problem : "No linked plan available"}</p>
                              {previousPlan?.approvalStatus && <p className="mt-1 text-[12px] text-[#817873]">Status: {previousPlan.approvalStatus}</p>}
                            </div>
                            <div className="border-t border-[#E7E2DF] pt-4">
                              <h5 className="font-semibold text-[#38312D]">Proposed next steps</h5>
                              <p className="mt-1 whitespace-pre-line break-words leading-6 text-justify">{progressNote.newPlanOfAction || "Not documented"}</p>
                            </div>
                          </div>
                        </div>
                      ) : <p className="mt-4 text-[#8C1518]" role="alert">Select a saved progress note from this case before generating.</p>
                    )}
                  </div>

                  <RecommendationList
                    recommendations={recommendations}
                    progressNotes={selectedCase.progressNotes || []}
                    onAction={openReviewModal}
                    onOpenPlans={() => navigate(`/intervention-plans?caseId=${selectedCase._id}`)}
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
        </div>
      </div>

      <RecommendationModal
        open={reviewModalOpen}
        mode={reviewMode}
        recommendation={selectedRecommendation}
        form={recommendationForm}
        setForm={setRecommendationForm}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        resourceFiles={resourceFiles}
        setResourceFiles={setResourceFiles}
        resourceTitle={resourceTitle}
        setResourceTitle={setResourceTitle}
        resourceDescription={resourceDescription}
        setResourceDescription={setResourceDescription}
        error={modalError}
        saving={isSaving}
        onClose={() => {
          setReviewModalOpen(false);
          resetResourceForm();
        }}
        onSubmit={submitRecommendationAction}
      />
    </div>
  );
}

function CaseList({ cases, selectedCaseId, isLoading, onSelect }) {
  if (isLoading) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <div className="text-center">
          <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />
          <p className="mt-3 text-[14px] text-[#827B77]">Loading cases...</p>
        </div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <EmptyState
        title="No active cases"
        message="No accessible active cases match the current filters."
        compact
      />
    );
  }

  return (
    <div className="max-h-[680px] divide-y divide-[#EEEAE7] overflow-y-auto">
      {cases.map((caseRecord) => {
        const caseId = caseRecord._id || caseRecord.id;
        const selected = selectedCaseId === caseId;

        const recommendationCount = caseRecord.llmRecommendations?.length || 0;

        return (
          <button
            key={caseId}
            type="button"
            onClick={() => onSelect(caseId)}
            className={`block w-full px-4 py-3.5 text-left transition ${
              selected ? "bg-[#F6ECEC]" : "bg-white hover:bg-[#FCFBFA]"
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
              <span className="truncate text-[13px] text-[#9A928D]">
                {caseRecord.problemAssessment?.mainDomain || "No domain"}
              </span>

              <span className="rounded-full bg-[#F1EEEC] px-2 py-1 text-[13px] text-[#6E6763]">
                {recommendationCount} draft
                {recommendationCount === 1 ? "" : "s"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CaseHeader({ caseRecord, canGenerate, isGenerating, onGenerate, onGoToCase }) {
  return (
    <header className="flex flex-col gap-3 border-b border-[#ECE8E5] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-semibold">{formatStudentName(caseRecord.student)}</h3>

          <CaseStatusBadge status={caseRecord.caseStatus} />
        </div>

        <p className="mt-1 text-[14px] text-[#938B86]">
          {caseRecord.caseNumber} · {caseRecord.student?.studentIdNumber || "No student ID"}
        </p>

        <p className="mt-1 text-[13px] text-[#AAA19C]">
          Assigned to {formatCounselorName(caseRecord.assignedCounselor)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGoToCase}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-[#DDD7D3] bg-white px-3 font-semibold text-[#5E5753]"
          style={{ fontSize: "15px" }}
        >
          Go to case
        </button>

        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ fontSize: "15px" }}
        >
          {isGenerating ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Icon name="sparkle" className="h-3 w-3" />
          )}
          Generate
        </button>
      </div>
    </header>
  );
}

function RecommendationList({ recommendations, onAction, onOpenPlans, progressNotes = [] }) {
  if (recommendations.length === 0) {
    return (
      <EmptyState
        title="No recommendation drafts yet"
        message="Generate a structured recommendation draft for counselor review."
      />
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {recommendations.map((recommendation) => (
        <article
          key={recommendation._id}
          className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <RecommendationStatusBadge status={recommendation.status} />
              </div>

              <p className="mt-3 text-[14px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">Recommendation goal</p>
              <h4 className="mt-1 break-words text-left text-[18px] leading-7 font-semibold">
                {recommendation.goal || "Recommendation draft"}
              </h4>
              {/support the student through appropriate interventions/i.test(recommendation.goal || "") && (
                <p className="mt-2 text-[14px] text-amber-800">This saved recommendation uses the earlier goal format. Generate a new draft or revise it for an outcome-focused goal. Its saved text has been preserved.</p>
              )}

              <p className="mt-1 text-[14px] text-[#9A928D]">
                {recommendation.recommendationType === "updated" ? "Updated intervention" : "Initial intervention"} · Generated {formatDateTime(recommendation.createdAt)}
                {recommendation.sourceProgressNoteId && <span className="block">
                  Based on saved progress{progressNotes.find((note) => String(note._id) === String(recommendation.sourceProgressNoteId))?.noteDate
                    ? ` from ${formatDateTime(progressNotes.find((note) => String(note._id) === String(recommendation.sourceProgressNoteId)).noteDate)}` : " note"}
                  {recommendation.previousPlanId ? " · Linked to previous intervention" : " · No linked previous intervention"}
                </span>}
              </p>
            </div>
          </div>

          <RecommendationSection
            label="Concern summary"
            value={recommendation.concernSummary}
            required
          />

          <RecommendationSection
            label="Plan of action"
            value={recommendation.planOfAction}
            required
          />

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <RecommendationSection label={(recommendation.scheduleSource === "progress-note" || (!recommendation.timeSpan && recommendation.progressContextSnapshot?.latestProgress?.timeSpan)) ? "Time span (counselor-documented schedule)" : "Time span"} value={recommendation.timeSpan || recommendation.progressContextSnapshot?.latestProgress?.timeSpan} />

            <RecommendationSection label="Follow-up plan (for counselor review)" value={displayFollowUp(recommendation)} />
          </div>

          {recommendation.actionEvidence?.length > 0 && (
            <section className="mt-6 text-[16px] leading-7 text-[#4F4945]">
              <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">Action rationale and references</p>
              <p className="mt-1 text-[14px] text-[#958D88]">AI-generated recommendations and supporting references require counselor review.{recommendation.status === "Revised" ? " These explanations describe generated actions; verify them against your edited plan." : ""}</p>
              {recommendation.actionEvidence.map((item, index) => <div key={index} className="mt-4 break-words text-left">
                <p><strong>{({ continued: "Continued", adjusted: "Adjusted", new: "New" }[item.changeType]) || "Classification needs review"}:</strong> {item.action}</p>
                <p className="mt-1"><span className="font-medium">Rationale: </span>{item.changeReason || "Rationale not documented."}</p>
                <EvidenceSupportStatus item={item} />
                {item.classificationNeedsReview && <p className="mt-1 text-[14px] text-[#8C1518]">Confirm the classification against the intervention history.</p>}
                <p className="mt-1 text-[14px] text-[#958D88]">Supporting reference: {(item.references || []).map((reference) =>
                  `${reference.title || "Reference title not documented"}${reference.pageNumber ? `, page ${reference.pageNumber}` : ""}`
                ).join("; ") || "Not documented"}</p>
              </div>)}
            </section>
          )}

          {recommendation.generationWarnings?.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[14px] text-amber-900">
              {recommendation.generationWarnings.map((warning, index) => <p key={index}>{warning}</p>)}
            </div>
          )}
          {recommendation.updateAssessment?.justification && (
            <RecommendationSection label="Reason for intervention adjustment or continuation" value={recommendation.updateAssessment.justification} />
          )}

          {recommendation.suggestedInterventions?.length > 0 && (
            <section className="mt-5">
              <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
                Suggested interventions
              </p>

              <ul className="mt-1 space-y-1 text-[16px] leading-6 text-[#4F4945]">
                {recommendation.suggestedInterventions.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2">
                    <span>•</span>
                    <span className="min-w-0 flex-1 break-words text-left leading-6">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recommendation.suggestedMaterials?.length > 0 && (
            <section className="mt-6 border-t border-[#ECE8E5] pt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-[#5A514C]">
                  Suggested PDFs{" "}
                  <span className="ml-1 text-[#958D88]">
                    ({recommendation.suggestedMaterials.length})
                  </span>
                </h3>
                {["Draft", "Revised"].includes(recommendation.status) && (
                  <button
                    type="button"
                    onClick={() => onAction("revise", recommendation)}
                    className="rounded-lg border border-[#DDD7D3] bg-white px-3 py-1.5 text-[14px] font-semibold text-[#8C1518]"
                  >
                    Review PDFs
                  </button>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {recommendation.suggestedMaterials.map((material) => (
                  <div
                    key={material.resourceId}
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-[#E7E2DF] bg-white px-4 py-3.5"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
                      <Icon name="file" className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold" title={material.title}>
                        {material.title}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#958D88]">
                        {material.resourceType === "worksheet" ? "Worksheet" : "Handout"}
                        {material.pageNumber ? ` · Page ${material.pageNumber}` : ""}
                      </p>
                    </div>
                    <a
                      href={getResourceUrl(material.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-md px-2 py-1.5 text-[14px] font-medium text-[#8C1518] hover:bg-[#F4EAEA]"
                    >
                      Preview
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}

          {recommendation.resources?.length > 0 && (
            <section className="mt-5">
              <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
                Attached resources
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {recommendation.resources.map((resource, index) => (
                  <a
                    key={resource._id || resource.url || `${resource.title}-${index}`}
                    href={getResourceUrl(resource.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDD7D3] bg-white px-2.5 py-1.5 text-[14px] font-medium text-[#8C1518] hover:border-[#8C1518]"
                  >
                    <Icon name="file" className="h-3 w-3" />
                    {resource.title || "Attached resource"}
                  </a>
                ))}
              </div>
            </section>
          )}

          {recommendation.rejectionReason && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-[14px] font-semibold text-red-700">Rejection reason</p>

              <p className="mt-1 text-[16px] leading-6 text-red-700 text-justify">
                {recommendation.rejectionReason}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#ECE8E5] pt-3">
            {["Draft", "Revised"].includes(recommendation.status) && (
              <>
                <ActionButton onClick={() => onAction("revise", recommendation)}>
                  Revise
                </ActionButton>

                <ActionButton danger onClick={() => onAction("reject", recommendation)}>
                  Reject
                </ActionButton>

                <ActionButton primary onClick={() => onAction("accept", recommendation)}>
                  Accept as plan
                </ActionButton>
              </>
            )}

            {recommendation.status === "Accepted" && (
              <ActionButton primary onClick={onOpenPlans}>
                Open intervention plan
              </ActionButton>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function RecommendationModal({
  open,
  mode,
  recommendation,
  form,
  setForm,
  rejectionReason,
  setRejectionReason,
  resourceFiles,
  setResourceFiles,
  resourceTitle,
  setResourceTitle,
  resourceDescription,
  setResourceDescription,
  error,
  saving,
  onClose,
  onSubmit,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, saving, onClose]);

  if (!open || !recommendation) {
    return null;
  }

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const title =
    mode === "revise"
      ? "Revise recommendation"
      : mode === "accept"
        ? "Accept recommendation"
        : "Reject recommendation";

  const submitLabel =
    mode === "revise"
      ? "Save revision"
      : mode === "accept"
        ? "Accept as intervention plan"
        : "Reject recommendation";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!saving) onClose();
        }}
        aria-label="Close recommendation modal"
      />

      <section
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">{title}</h2>

            <p className="mt-1 text-[14px] text-[#938B86]">
              Counselor review is required before a recommendation becomes an intervention-plan
              draft.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#8C847F] hover:bg-[#F4F1EF] disabled:opacity-40"
            aria-label="Close"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="overflow-y-auto p-5">
          {error && <Alert tone="error" message={error} />}

          {mode === "revise" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Concern summary" required className="sm:col-span-2">
                <textarea
                  required
                  value={form.concernSummary}
                  onChange={(event) => update("", event.target.value)}
                  rows={4}
                  className={textareaClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              <Field label="Goal" required className="sm:col-span-2">
                <textarea
                  required
                  value={form.goal}
                  onChange={(event) => update("goal", event.target.value)}
                  rows={3}
                  className={textareaClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              <Field label="Suggested interventions" className="sm:col-span-2">
                <div className="space-y-2">
                  {form.suggestedInterventions.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        value={item}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            suggestedInterventions: current.suggestedInterventions.map(
                              (existing, itemIndex) =>
                                itemIndex === index ? event.target.value : existing
                            ),
                          }))
                        }
                        className={inputClass}
                        style={{
                          fontSize: "15px",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            suggestedInterventions: current.suggestedInterventions.filter(
                              (_, itemIndex) => itemIndex !== index
                            ),
                          }))
                        }
                        className="h-8 rounded-lg border border-red-200 bg-red-50 px-3 !text-[14px] font-semibold text-[#8C1518]"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        suggestedInterventions: [...current.suggestedInterventions, ""],
                      }))
                    }
                    className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[14px] font-semibold text-[#5E5753]"
                  >
                    Add intervention
                  </button>
                </div>
              </Field>

              <Field label="Plan of action" required className="sm:col-span-2">
                <textarea
                  required
                  value={form.planOfAction}
                  onChange={(event) => update("planOfAction", event.target.value)}
                  rows={5}
                  className={textareaClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              <Field label="Time span">
                <input
                  value={form.timeSpan}
                  onChange={(event) => update("timeSpan", event.target.value)}
                  className={inputClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              <Field label="Follow-up plan">
                <input
                  value={form.followUpPlan}
                  onChange={(event) => update("followUpPlan", event.target.value)}
                  className={inputClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              <Field label="Rationale" className="sm:col-span-2">
                <textarea
                  value={form.rationale}
                  onChange={(event) => update("rationale", event.target.value)}
                  rows={4}
                  className={textareaClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              <Field label="Counselor remarks" className="sm:col-span-2">
                <textarea
                  value={form.counselorRemarks}
                  onChange={(event) => update("counselorRemarks", event.target.value)}
                  rows={3}
                  className={textareaClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              {recommendation.suggestedMaterials?.length > 0 && (
                <div className="sm:col-span-2">
                  <SuggestedPdfPicker
                    materials={recommendation.suggestedMaterials}
                    disabled={saving}
                    selectedIds={recommendation.suggestedMaterials
                      .filter((material) =>
                        (form.resources || []).some((resource) => resource.url === material.url)
                      )
                      .map((material) => material.resourceId)}
                    onChange={(ids) =>
                      setForm((current) => {
                        const suggestedUrls = new Set(
                          recommendation.suggestedMaterials.map((material) => material.url)
                        );
                        const resources = (current.resources || []).filter(
                          (resource) => !suggestedUrls.has(resource.url)
                        );
                        for (const material of recommendation.suggestedMaterials.filter(
                          (material) => ids.includes(material.resourceId)
                        ))
                          resources.push({
                            title: material.title,
                            type: "PDF",
                            url: material.url,
                            description: `Counselor-selected ${material.resourceType}`,
                            isProvidedToStudent: false,
                          });
                        return { ...current, resources };
                      })
                    }
                  />
                </div>
              )}

              <div className="sm:col-span-2 rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
                    <Icon name="folder" className="h-3.5 w-3.5" />
                  </div>

                  <div>
                    <p className="text-[14px] font-semibold">Recommendation resources</p>

                    <p className="mt-1 text-[13px] leading-4 text-[#8D8580] text-justify">
                      Add worksheets, guides, forms, or other supporting files. Existing files may
                      also be removed during revision.
                    </p>
                  </div>
                </div>

                {form.resources?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[14px] font-semibold text-[#4B4541]">
                      Existing attached files
                    </p>

                    <div className="mt-2 space-y-2">
                      {form.resources.map((resource, index) => (
                        <div
                          key={resource._id || resource.url || `${resource.title}-${index}`}
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
                                <p className="mt-1 line-clamp-2 text-[13px] leading-4 text-[#716A66] text-justify">
                                  {resource.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            {resource.url && (
                              <a
                                href={getResourceUrl(resource.url)}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-[#D9D2CE] bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#8C1518]"
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
                                    (_, resourceIndex) => resourceIndex !== index
                                  ),
                                }))
                              }
                              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 !text-[14px] font-semibold text-[#8C1518]"
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
                      onChange={(event) => setResourceTitle(event.target.value)}
                      placeholder="Optional custom title"
                      className={inputClass}
                      style={{
                        fontSize: "15px",
                      }}
                    />
                  </Field>

                  <Field label="Choose files">
                    <input
                      type="file"
                      multiple
                      onChange={(event) => setResourceFiles(Array.from(event.target.files || []))}
                      className="block w-full rounded-lg border border-[#DDD8D4] bg-white px-3 py-2 text-[14px] text-[#5E5753] file:mr-3 file:rounded-md file:border-0 file:bg-[#F4EAEA] file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-[#8C1518]"
                    />
                  </Field>

                  <Field label="Resource description" className="sm:col-span-2">
                    <textarea
                      value={resourceDescription}
                      onChange={(event) => setResourceDescription(event.target.value)}
                      rows={2}
                      className={textareaClass}
                      style={{
                        fontSize: "15px",
                      }}
                    />
                  </Field>

                  {resourceFiles.length > 0 && (
                    <div className="sm:col-span-2 space-y-2 rounded-lg border border-[#E4DFDC] bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-semibold text-[#514A46]">
                          {resourceFiles.length} file
                          {resourceFiles.length === 1 ? "" : "s"} selected
                        </p>

                        <button
                          type="button"
                          onClick={() => setResourceFiles([])}
                          className="!text-[15px] font-semibold text-[#8C1518]"
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
                                current.filter((_, fileIndex) => fileIndex !== index)
                              )
                            }
                            className="!text-[15px] font-semibold text-[#8C1518]"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : mode === "reject" ? (
            <Field label="Rejection reason" required>
              <textarea
                required
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain why this recommendation should not be used."
                rows={5}
                className={textareaClass}
                style={{
                  fontSize: "15px",
                }}
              />
            </Field>
          ) : (
            <>
              <div className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">
                <RecommendationSection label="Goal" value={form.goal} required />

                <RecommendationSection label="Plan of action" value={form.planOfAction} required />

                <RecommendationSection label="Time span" value={form.timeSpan} />

                <RecommendationSection label="Follow-up plan" value={form.followUpPlan} />
              </div>

              {recommendation.suggestedMaterials?.length > 0 && (
                <div className="mt-4">
                  <SuggestedPdfPicker
                    materials={recommendation.suggestedMaterials}
                    disabled={saving}
                    lockedIds={recommendation.suggestedMaterials
                      .filter((material) =>
                        (form.resources || []).some((resource) => resource.url === material.url)
                      )
                      .map((material) => material.resourceId)}
                    selectedIds={[
                      ...new Set([
                        ...(form.selectedSuggestedMaterialIds || []),
                        ...recommendation.suggestedMaterials
                          .filter((material) =>
                            (form.resources || []).some((resource) => resource.url === material.url)
                          )
                          .map((material) => material.resourceId),
                      ]),
                    ]}
                    onChange={(ids) =>
                      setForm((current) => ({
                        ...current,
                        selectedSuggestedMaterialIds: ids,
                        resources: current.resources,
                      }))
                    }
                  />
                </div>
              )}

              {form.resources?.length > 0 && (
                <div className="mt-4 rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
                    Resources to transfer
                  </p>

                  <div className="mt-2 space-y-2">
                    {form.resources.map((resource, index) => (
                      <div
                        key={resource._id || resource.url || `${resource.title}-${index}`}
                        className="flex items-center gap-2 rounded-lg border border-[#E4DFDC] bg-white px-3 py-2"
                      >
                        <Icon name="file" className="h-3.5 w-3.5 shrink-0 text-[#8C1518]" />

                        <span className="truncate text-[13px] font-medium">
                          {resource.title || "Attached resource"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-2 text-[13px] leading-4 text-[#8D8580] text-justify">
                    These files will be copied to the intervention-plan draft when the
                    recommendation is accepted.
                  </p>
                </div>
              )}

              <Field label="Counselor remarks" className="mt-4">
                <textarea
                  value={form.counselorRemarks}
                  onChange={(event) => update("counselorRemarks", event.target.value)}
                  placeholder="Add optional review remarks before converting this recommendation into an intervention-plan draft."
                  rows={4}
                  className={textareaClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[13px] leading-4 text-blue-700">
                Accepting this recommendation creates a new intervention plan with the status{" "}
                <strong>Pending Review</strong>. It will not be automatically approved or sent to
                the student.
              </div>
            </>
          )}

          <div className="mt-5 flex justify-end gap-2 border-t border-[#ECE8E5] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 font-medium text-[#5E5753] disabled:opacity-40"
              style={{
                fontSize: "15px",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 font-semibold text-white disabled:opacity-60 ${
                mode === "reject"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-[#8C1518] hover:bg-[#701013]"
              }`}
              style={{
                fontSize: "15px",
              }}
            >
              {saving && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}

              {saving ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RecommendationSection({ label, value, required = false }) {
  return (
    <section className="mt-5">
      <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap break-words text-left text-[16px] leading-7 text-[#4F4945]">
        {value || (required ? "No information recorded." : "—")}
      </p>
    </section>
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

function ActionButton({ onClick, children, primary = false, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 rounded-lg border px-2.5 font-semibold ${
        primary
          ? "border-[#8C1518] bg-[#8C1518] text-white"
          : danger
            ? "border-red-200 bg-red-50 text-red-600"
            : "border-[#DCD6D2] bg-white text-[#5A534F] hover:border-[#8C1518] hover:text-[#8C1518]"
      }`}
      style={{
        fontSize: "15px",
      }}
    >
      {children}
    </button>
  );
}

function InfoCard({ label, value }) {
  return (
    <article className="rounded-xl border border-[#E8E3E0] bg-[#FCFBFA] p-3">
      <p className="text-[13px] text-[#958D88]">{label}</p>

      <p className="mt-1 break-words text-[14px] font-semibold text-[#4E4844]">{value}</p>
    </article>
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
          <Icon name="sparkle" className="h-5 w-5" />
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

        <p className="mt-3 text-[14px] text-[#827B77]">Loading case details...</p>
      </div>
    </div>
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

function CaseStatusBadge({ status }) {
  const styles = {
    Open: "bg-blue-50 text-blue-700",
    "In Progress": "bg-amber-50 text-amber-700",
    "For Follow-up": "bg-violet-50 text-violet-700",
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

function RecommendationStatusBadge({ status }) {
  const styles = {
    Draft: "bg-amber-50 text-amber-700",
    Revised: "bg-blue-50 text-blue-700",
    Accepted: "bg-emerald-50 text-emerald-700",
    Rejected: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[status] || "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status || "Draft"}
    </span>
  );
}

function getResourceUrl(resourceUrl) {
  if (!resourceUrl) {
    return "#";
  }

  if (resourceUrl.startsWith("http://") || resourceUrl.startsWith("https://")) {
    return resourceUrl;
  }

  const backendOrigin = import.meta.env.VITE_API_ORIGIN || "http://localhost:5000";

  return `${backendOrigin}${resourceUrl}`;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];

  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);

  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatStudentName(student) {
  if (!student) return "Unknown student";

  return [student.firstName, student.lastName].filter(Boolean).join(" ");
}

function formatCounselorName(counselor) {
  if (!counselor) return "Unknown counselor";

  if (typeof counselor === "string") {
    return "Assigned counselor";
  }

  return [counselor.firstName, counselor.lastName].filter(Boolean).join(" ");
}

function formatDateTime(value) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

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
function SuggestedPdfPicker({ materials, selectedIds = [], lockedIds = [], onChange, disabled }) {
  return (
    <section className="rounded-xl border border-[#E7E2DF] bg-white">
      <div className="border-b border-[#ECE8E5] px-4 py-3">
        <h3 className="text-sm font-semibold">Suggested PDFs</h3>
        <p className="mt-1 text-xs text-[#827A76]">
          Select PDFs to include in the plan draft. Approval is required before sending.
        </p>
      </div>
      <div className="divide-y divide-[#ECE8E5]">
        {materials.map((material) => (
          <div key={material.resourceId} className="flex items-center gap-3 px-4 py-3">
            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-[#8C1518]"
                checked={selectedIds.includes(material.resourceId)}
                disabled={disabled || lockedIds.includes(material.resourceId)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selectedIds, material.resourceId]
                      : selectedIds.filter((id) => id !== material.resourceId)
                  )
                }
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{material.title}</span>
                <span className="mt-0.5 block text-xs text-[#958D88]">
                  {material.resourceType === "worksheet" ? "Worksheet" : "Handout"}
                  {lockedIds.includes(material.resourceId)
                    ? " · Already selected; remove in Revise"
                    : ""}
                </span>
              </span>
            </label>
            <a
              href={getResourceUrl(material.url)}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-md border border-[#DDD7D3] px-2.5 py-1.5 text-xs font-semibold text-[#8C1518]"
            >
              Preview
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvidenceSupportStatus({ item }) {
  const needsReview = item.evidenceStatus !== "direct-support" ||
    item.evidenceNeedsReview || !item.references?.length;
  if (!needsReview) return null;
  return (
    <p className="mt-2 text-[14px] font-medium leading-6 text-amber-800">
      Supporting evidence needs review.
    </p>
  );
}


function displayFollowUp(recommendation) {
  const schedule = recommendation.progressContextSnapshot?.latestProgress?.timeSpan || recommendation.timeSpan || "";
  const followUp = recommendation.followUpPlan || "";
  const normalize = (value) => value.toLowerCase().replace(/^counselor-documented schedule:\s*/, "").replace(/\s+/g, " ").trim();
  if (!followUp.trim() || (schedule && normalize(schedule) === normalize(followUp)))
    return "No follow-up evaluation plan was saved with this recommendation. Generate a new draft or revise it for counselor review.";
  return followUp;
}

function generationOutputIssue(recommendation) {
  if (!recommendation || recommendation.outputContractVersion !== requiredRecommendationVersion())
    return "The backend returned an older or unrecognized recommendation format. Restart the backend and generate a fresh draft; existing saved recommendations are preserved.";
  if (typeof recommendation.goal !== "string" || !recommendation.goal.trim() ||
      /support the student through appropriate interventions/i.test(recommendation.goal) ||
      typeof recommendation.followUpPlan !== "string" || !recommendation.followUpPlan.trim())
    return "The returned recommendation is missing a usable goal or follow-up evaluation plan. Do not approve it; generate a fresh draft.";
  return "";
}


function requiredRecommendationVersion() {
  return "goal-followup-v3";
}

async function assertCurrentRecommendationRuntime(fetcher, apiBase, pageURL) {
  const healthURL = new URL(apiBase, pageURL);
  healthURL.pathname = healthURL.pathname.replace(/\/api\/?$/, "/");
  healthURL.search = "";
  healthURL.hash = "";
  let response, metadata;
  try {
    response = await fetcher(healthURL.toString(), { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
    metadata = await response.json();
  } catch {
    throw new Error("Could not verify the recommendation backend. Check that the backend is running at the configured API address. Generation has not started.");
  }
  if (!response.ok || metadata?.recommendationOutputVersion !== requiredRecommendationVersion()) {
    throw new Error("The configured backend is running an older or unrecognized recommendation workflow. Restart that backend before generating. Generation has not started and no draft was saved.");
  }
}
