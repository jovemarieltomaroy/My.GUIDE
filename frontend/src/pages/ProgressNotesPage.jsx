import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";

const PROGRESS_STATUSES = ["Improved", "No Progress", "Worsened", "Needs Follow-up"];

const STUDENT_RESPONSES = [
  "Positive Response",
  "Mixed Response",
  "No Noticeable Change",
  "Negative Response",
  "Not Assessed",
];

const GOAL_PROGRESS_OPTIONS = [
  "No Progress Observed",
  "Slight Progress",
  "Moderate Progress",
  "Goal Mostly Achieved",
  "Goal Achieved",
  "Not Assessed",
];

const PLAN_ACTION_OPTIONS = [
  "Continue Current Plan",
  "Continue With Adjustments",
  "Revise Intervention Plan",
  "Complete Intervention Plan",
  "Refer for Additional Support",
  "Not Decided",
];

const EMPTY_NOTE_FORM = {
  progressStatus: "Needs Follow-up",
  progressSummary: "",
  newPlanOfAction: "",
  timeSpan: "",
  remarks: "",
  interventionPlanId: "",
  studentResponse: "Not Assessed",
  goalProgress: "Not Assessed",
  recommendedPlanAction: "Not Decided",
  supportingNote: "",
};

export default function ProgressNotesPage() {
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
  const [statusFilter, setStatusFilter] = useState("");
  const [progressFilter, setProgressFilter] = useState("");

  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [isLoadingCase, setIsLoadingCase] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteForm, setNoteForm] = useState(EMPTY_NOTE_FORM);
  const [generateAfterSave, setGenerateAfterSave] = useState(false);

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
        const [myCases, temporaryCases] = await Promise.all([
          apiRequest("/cases/my-cases", {
            method: "GET",
          }),
          apiRequest("/cases/temporary-access", {
            method: "GET",
          }),
        ]);

        const caseMap = new Map();

        [...(myCases || []), ...(temporaryCases || [])].forEach((caseRecord) => {
          caseMap.set(caseRecord._id || caseRecord.id, caseRecord);
        });

        retrievedCases = Array.from(caseMap.values());
      }

      if (!Array.isArray(retrievedCases)) {
        throw new Error("The backend returned an invalid cases response.");
      }

      setCases(retrievedCases);

      if (
        selectedCaseId &&
        !retrievedCases.some((caseRecord) => (caseRecord._id || caseRecord.id) === selectedCaseId)
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

      const matchesStatus = !statusFilter || caseRecord.caseStatus === statusFilter;

      const latestNote = getLatestProgressNote(caseRecord);
      const matchesProgress = !progressFilter || latestNote?.progressStatus === progressFilter;

      return matchesSearch && matchesStatus && matchesProgress;
    });
  }, [cases, searchQuery, statusFilter, progressFilter]);

  const progressNotes = useMemo(() => {
    return [...(selectedCase?.progressNotes || [])].sort(
      (a, b) => new Date(b.noteDate || b.createdAt) - new Date(a.noteDate || a.createdAt)
    );
  }, [selectedCase]);

  const assignedCounselorId =
    selectedCase?.assignedCounselor?._id || selectedCase?.assignedCounselor;

  const isAssignedCounselor =
    Boolean(selectedCase && user?._id) && assignedCounselorId?.toString() === user._id.toString();

  const currentTemporaryAccess = useMemo(() => {
    if (!selectedCase || !user?._id) {
      return null;
    }

    return (
      (selectedCase.temporaryCounselor || []).find((access) => {
        const counselorId = access.counselor?._id || access.counselor;

        const accessUntil = new Date(access.accessUntil);

        return (
          counselorId?.toString() === user._id.toString() &&
          access.isActive === true &&
          !access.revokedAt &&
          !Number.isNaN(accessUntil.getTime()) &&
          accessUntil > new Date()
        );
      }) || null
    );
  }, [selectedCase, user]);

  const isTemporaryCounselor = Boolean(currentTemporaryAccess) && !isAssignedCounselor;

  const openNoteModal = () => {
    setNoteForm(EMPTY_NOTE_FORM);
    setGenerateAfterSave(false);
    setModalError("");
    setNoteModalOpen(true);
  };

  const submitProgressNote = async (event) => {
    event.preventDefault();

    if (!selectedCase) return;

    setIsSaving(true);
    setModalError("");

    const previousNoteIds = new Set(
      (selectedCase.progressNotes || []).map((note) => String(note._id))
    );

    try {
      const data = await apiRequest(`/cases/${selectedCase._id}/progress-notes`, {
        method: "POST",
        body: JSON.stringify({
          progressStatus: noteForm.progressStatus,
          progressSummary: noteForm.progressSummary.trim(),
          newPlanOfAction: noteForm.newPlanOfAction.trim(),
          timeSpan: noteForm.timeSpan.trim(),
          remarks: noteForm.remarks.trim(),
          interventionProgress: {
            interventionPlan: noteForm.interventionPlanId || null,
            studentResponse: noteForm.studentResponse,
            goalProgress: noteForm.goalProgress,
            recommendedPlanAction: noteForm.recommendedPlanAction,
            supportingNote: noteForm.supportingNote.trim(),
          },
        }),
      });

      const updatedCase = data?.case;

      if (!updatedCase) {
        throw new Error("The backend did not return the updated case.");
      }

      setSelectedCase(updatedCase);
      setCases((current) =>
        current.map((caseRecord) =>
          (caseRecord._id || caseRecord.id) === updatedCase._id ? updatedCase : caseRecord
        )
      );

      const createdNote = [...(updatedCase.progressNotes || [])]
        .reverse()
        .find((note) => note._id && !previousNoteIds.has(String(note._id)));

      setNoteModalOpen(false);

      if (generateAfterSave) {
        setGenerateAfterSave(false);

        if (!createdNote?._id) {
          setSuccessMessage(
            "Progress note saved, but its ID could not be identified for recommendation generation."
          );
          return;
        }

        navigate(
          `/llm-recommendations?caseId=${updatedCase._id}&progressNoteId=${createdNote._id}&mode=progress-based${
            isTemporaryCounselor ? "&access=temporary" : ""
          }`
        );
        return;
      }

      setSuccessMessage(data?.message || "Progress note added successfully.");
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setModalError(error.message || "Unable to add the progress note.");
    } finally {
      setIsSaving(false);
    }
  };

  const canAccessProgressWorkspace =
    Boolean(selectedCase) && (isAdmin || isAssignedCounselor || isTemporaryCounselor);

  const canAddProgressNote =
    canAccessProgressWorkspace &&
    !selectedCase.isArchived &&
    !["Closed", "Terminated"].includes(selectedCase.caseStatus);

  if (!user) return null;

  return (
    <div className="authenticated-app min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#2F2A27]">
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

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
                <h1 className="text-[20px] font-semibold">Progress Notes</h1>
                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  Record counseling-session progress and follow-up plans
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openNoteModal}
              disabled={!canAddProgressNote}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ fontSize: "15px" }}
            >
              <Icon name="plus" className="h-3 w-3" />
              Add progress note
            </button>
          </div>
        </header>

        <main className="page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7 lg:w-[calc(100%-240px)]! lg:px-0!">
          {successMessage && <Alert tone="success" message={successMessage} />}

          {pageError && <Alert tone="error" message={pageError} />}

          {!isFocusedCaseMode && (
            <section>
              <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
                Counseling progress documentation
              </h2>

              <p className="mt-1 max-w-[760px] text-[14px] leading-4 text-[#89817D]">
                Select an accessible case to review previous notes or record the outcome of a
                counseling or follow-up session.
              </p>
            </section>
          )}

          <div
            className={`grid gap-5 ${
              isFocusedCaseMode ? "mt-0 grid-cols-1" : "mt-5 xl:grid-cols-[390px_minmax(0,1fr)]"
            }`}
          >
            {!isFocusedCaseMode && (
              <section className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
                <div className="border-b border-[#ECE8E5] p-4">
                  <h3 className="text-[17px] font-semibold">Accessible cases</h3>

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
                        style={{ fontSize: "15px" }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className={filterClass}
                        style={{ fontSize: "15px" }}
                      >
                        <option value="">Case statuses</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="For Follow-up">For Follow-up</option>
                        <option value="Closed">Closed</option>
                        <option value="Terminated">Terminated</option>
                      </select>

                      <select
                        value={progressFilter}
                        onChange={(event) => setProgressFilter(event.target.value)}
                        className={filterClass}
                        style={{ fontSize: "15px" }}
                      >
                        <option value="">Progress statuses</option>
                        {PROGRESS_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
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
                <EmptyCaseSelection />
              ) : isLoadingCase ? (
                <LoadingCase />
              ) : selectedCase ? (
                <>
                  <CaseHeader
                    caseRecord={selectedCase}
                    canAddProgressNote={canAddProgressNote}
                    isTemporaryCounselor={isTemporaryCounselor}
                    temporaryAccessUntil={currentTemporaryAccess?.accessUntil}
                    onAddNote={openNoteModal}
                  />

                  {isTemporaryCounselor && (
                    <TemporaryProgressAccessNotice
                      accessUntil={currentTemporaryAccess?.accessUntil}
                    />
                  )}

                  <div className="border-b border-[#ECE8E5] p-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoCard label="Case status" value={selectedCase.caseStatus || "—"} />
                      <InfoCard label="Priority" value={selectedCase.priorityLevel || "—"} />
                      <InfoCard
                        label="Main domain"
                        value={selectedCase.problemAssessment?.mainDomain || "—"}
                      />
                      <InfoCard label="Progress notes" value={String(progressNotes.length)} />
                    </div>
                  </div>

                  <ProgressNotesList
                    notes={progressNotes}
                    canGenerate={canAddProgressNote}
                    onGenerate={(note) => navigate(
                      `/llm-recommendations?caseId=${selectedCase._id}&progressNoteId=${note._id}&mode=updated`
                    )}
                  />
                </>
              ) : (
                <EmptyCaseSelection
                  title="Unable to display case"
                  message="Select another accessible case."
                />
              )}
            </section>
          </div>
        </main>
      </div>

      <ProgressNoteModal
        open={noteModalOpen}
        caseRecord={selectedCase}
        form={noteForm}
        setForm={setNoteForm}
        error={modalError}
        saving={isSaving}
        generateAfterSave={generateAfterSave}
        setGenerateAfterSave={setGenerateAfterSave}
        isTemporaryCounselor={isTemporaryCounselor}
        onClose={() => {
          setGenerateAfterSave(false);
          setNoteModalOpen(false);
        }}
        onSubmit={submitProgressNote}
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
      <div className="grid min-h-[420px] place-items-center px-5 text-center">
        <div>
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
            <Icon name="folder" className="h-5 w-5" />
          </div>

          <p className="mt-4 text-[15px] font-semibold">No accessible cases found</p>

          <p className="mt-1 text-[14px] leading-4 text-[#938C87]">
            Adjust the filters or verify that a case is assigned to this counselor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[680px] divide-y divide-[#EEEAE7] overflow-y-auto">
      {cases.map((caseRecord) => {
        const caseId = caseRecord._id || caseRecord.id;
        const latestNote = getLatestProgressNote(caseRecord);
        const selected = selectedCaseId === caseId;

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

            <p className="mt-2 truncate text-[13px] text-[#6F6864]">
              {caseRecord.problemAssessment?.mainDomain || "No domain"}
            </p>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[13px] text-[#9A928D]">
                {caseRecord.student?.college || "No college"}
              </span>

              {latestNote ? (
                <ProgressBadge status={latestNote.progressStatus} />
              ) : (
                <span className="rounded-full bg-[#F1EEEC] px-2 py-1 text-[13px] text-[#6E6763]">
                  No notes
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CaseHeader({
  caseRecord,
  canAddProgressNote,
  isTemporaryCounselor,
  temporaryAccessUntil,
  onAddNote,
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-[#ECE8E5] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-semibold">{formatStudentName(caseRecord.student)}</h3>

          <CaseStatusBadge status={caseRecord.caseStatus} />

          {isTemporaryCounselor && (
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[13px] font-semibold text-blue-700">
              Temporary access
            </span>
          )}
        </div>

        <p className="mt-1 text-[14px] text-[#938B86]">
          {caseRecord.caseNumber} · {caseRecord.student?.studentIdNumber || "No student ID"}
        </p>

        <p className="mt-1 text-[13px] text-[#AAA19C]">
          Assigned to {formatCounselorName(caseRecord.assignedCounselor)}
        </p>

        {isTemporaryCounselor && (
          <p className="mt-1 text-[13px] font-medium text-blue-700">
            Temporary access until {formatDateTime(temporaryAccessUntil)}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onAddNote}
        disabled={!canAddProgressNote}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: "15px" }}
      >
        <Icon name="plus" className="h-3 w-3" />
        Add note
      </button>
    </header>
  );
}

function ProgressNotesList({ notes, canGenerate, onGenerate }) {
  if (notes.length === 0) {
    return (
      <div className="grid min-h-[390px] place-items-center px-6 text-center">
        <div>
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
            <Icon name="note" className="h-5 w-5" />
          </div>

          <p className="mt-4 text-[15px] font-semibold">No progress notes yet</p>

          <p className="mt-1 text-[14px] text-[#938C87]">
            Add the first progress note after the next counseling session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[680px] space-y-3 overflow-y-auto p-4">
      {notes.map((note, index) => (
        <article
          key={note._id || `${note.noteDate}-${index}`}
          className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <ProgressBadge status={note.progressStatus} />

                <span className="text-[13px] text-[#9A928D]">
                  {formatDateTime(note.noteDate || note.createdAt)}
                </span>
              </div>

              <p className="mt-2 text-[13px] text-[#A39B96]">
                Attending counselor: {formatCounselorName(note.attendingCounselor || note.addedBy)}
              </p>
            </div>
          </div>

          <NoteSection label="Progress summary" value={note.progressSummary} required />

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <NoteSection label="New plan of action" value={note.newPlanOfAction} />
            <NoteSection label="Time span" value={note.timeSpan} />
            <NoteSection label="Remarks" value={note.remarks} className="md:col-span-2" />
          </div>

          {note.interventionProgress && (
            <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
              <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700">
                  <Icon name="heart" className="h-3.5 w-3.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-violet-800">
                    Intervention progress recorded
                  </p>

                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <MiniValue
                      label="Student response"
                      value={note.interventionProgress.studentResponse || "Not Assessed"}
                    />
                    <MiniValue
                      label="Goal progress"
                      value={note.interventionProgress.goalProgress || "Not Assessed"}
                    />
                    <MiniValue
                      label="Recommended action"
                      value={note.interventionProgress.recommendedPlanAction || "Not Decided"}
                    />
                  </div>

                  {note.interventionProgress.supportingNote && (
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-4 text-violet-700">
                      {note.interventionProgress.supportingNote}
                    </p>
                  )}

                  {note._id && note.interventionProgress.recommendedPlanAction === "Revise Intervention Plan" && (
                    <button
                      type="button"
                      onClick={() => onGenerate(note)}
                      disabled={!canGenerate}
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-[14px] font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon name="sparkle" className="h-3.5 w-3.5" />
                      Generate Updated Intervention Plan
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function ProgressNoteModal({
  open,
  caseRecord,
  form,
  setForm,
  error,
  saving,
  generateAfterSave,
  setGenerateAfterSave,
  isTemporaryCounselor,
  onClose,
  onSubmit,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, saving, onClose]);

  if (!open || !caseRecord) return null;

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!saving) onClose();
        }}
        aria-label="Close progress note modal"
      />

      <section
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">Add progress note</h2>

            <p className="mt-1 text-[14px] text-[#938B86]">
              {caseRecord.caseNumber} · {formatStudentName(caseRecord.student)}
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

          {isTemporaryCounselor && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
                  <Icon name="eye" className="h-3.5 w-3.5" />
                </div>

                <div>
                  <p className="text-[14px] font-semibold text-blue-800">
                    Temporary counselor workflow
                  </p>

                  <p className="mt-1 text-[13px] leading-4 text-blue-700">
                    You may save this progress note, generate a progress-based intervention
                    recommendation, and revise the recommendation draft. Only the assigned counselor
                    can accept the recommendation as an intervention plan, approve it, or send it to
                    the student.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Progress status" required>
              <select
                required
                value={form.progressStatus}
                onChange={(event) => update("progressStatus", event.target.value)}
                className={inputClass}
                style={{ fontSize: "15px" }}
              >
                {PROGRESS_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Time span">
              <input
                value={form.timeSpan}
                onChange={(event) => update("timeSpan", event.target.value)}
                placeholder="e.g., Follow-up in 2 weeks"
                className={inputClass}
                style={{ fontSize: "15px" }}
              />
            </Field>

            <Field label="Progress summary" required className="sm:col-span-2">
              <textarea
                required
                value={form.progressSummary}
                onChange={(event) => update("progressSummary", event.target.value)}
                placeholder="Summarize the student’s current progress, concerns, and session outcome."
                rows={5}
                className={textareaClass}
                style={{ fontSize: "15px" }}
              />
            </Field>

            <div className="sm:col-span-2 rounded-xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700">
                  <Icon name="heart" className="h-3.5 w-3.5" />
                </div>

                <div>
                  <p className="text-[14px] font-semibold text-violet-800">Intervention progress</p>
                  <p className="mt-1 text-[13px] leading-4 text-violet-700">
                    Record how the student responded during this session. This is to see the
                    effectiveness of the previous intervention plan given.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Related intervention plan">
                  <select
                    value={form.interventionPlanId}
                    onChange={(event) => update("interventionPlanId", event.target.value)}
                    className={inputClass}
                    style={{ fontSize: "15px" }}
                  >
                    <option value="">No specific plan selected</option>
                    {(caseRecord.interventionPlans || []).map((plan, index) => (
                      <option key={plan._id || index} value={plan._id}>
                        {plan.problem || `Intervention plan ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Student response">
                  <select
                    value={form.studentResponse}
                    onChange={(event) => update("studentResponse", event.target.value)}
                    className={inputClass}
                    style={{ fontSize: "15px" }}
                  >
                    {STUDENT_RESPONSES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Goal progress">
                  <select
                    value={form.goalProgress}
                    onChange={(event) => update("goalProgress", event.target.value)}
                    className={inputClass}
                    style={{ fontSize: "15px" }}
                  >
                    {GOAL_PROGRESS_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Recommended plan action">
                  <select
                    value={form.recommendedPlanAction}
                    onChange={(event) => update("recommendedPlanAction", event.target.value)}
                    className={inputClass}
                    style={{ fontSize: "15px" }}
                  >
                    {PLAN_ACTION_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Supporting note" className="sm:col-span-2">
                  <textarea
                    value={form.supportingNote}
                    onChange={(event) => update("supportingNote", event.target.value)}
                    placeholder="Briefly describe the student's response, observed progress, or difficulty with the current intervention."
                    rows={3}
                    className={textareaClass}
                    style={{ fontSize: "15px" }}
                  />
                </Field>
              </div>
            </div>

            <Field label="New plan of action" className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] leading-4 text-[#8D8580]">
                Record what should happen after this session. This may continue the current
                intervention, make a small adjustment, or describe the direction for a substantially
                revised intervention plan.
              </p>

              <textarea
                value={form.newPlanOfAction}
                onChange={(event) => update("newPlanOfAction", event.target.value)}
                placeholder="Example: Continue weekly planning, review task completion after two weeks, and adjust the strategy if progress remains limited."
                rows={4}
                className={textareaClass}
                style={{ fontSize: "15px" }}
              />

              <button
                type="button"
                onClick={() => setGenerateAfterSave((current) => !current)}
                disabled={saving}
                className={`mt-2 flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition disabled:opacity-50 ${
                  generateAfterSave
                    ? "border-violet-500 bg-violet-50"
                    : "border-violet-200 bg-white hover:bg-violet-50"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    generateAfterSave ? "bg-violet-700 text-white" : "bg-violet-100 text-violet-700"
                  }`}
                >
                  <Icon name="sparkle" className="h-3.5 w-3.5" />
                </span>

                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-violet-800">
                    Save note and generate an updated intervention plan
                  </span>

                  <span className="mt-1 block text-[13px] leading-4 text-violet-700">
                    After this note is saved, open the recommendation workspace using the progress
                    summary, intervention progress, and new plan of action as additional context.
                    {isTemporaryCounselor
                      ? " You may generate and revise the draft, but only the assigned counselor can accept, approve, or send it."
                      : ""}
                  </span>

                  <span className="mt-1.5 block text-[13px] font-semibold text-violet-800">
                    {generateAfterSave
                      ? "Selected - recommendation workspace will open after saving."
                      : "Select this when the current intervention needs a meaningful revision."}
                  </span>
                </span>
              </button>
            </Field>

            <Field label="Remarks" className="sm:col-span-2">
              <textarea
                value={form.remarks}
                onChange={(event) => update("remarks", event.target.value)}
                placeholder="Add other relevant observations or reminders."
                rows={3}
                className={textareaClass}
                style={{ fontSize: "15px" }}
              />
            </Field>
          </div>

          <div className="mt-5 rounded-lg border border-[#E7E2DF] bg-[#FAF8F7] px-3 py-2 text-[13px] leading-4 text-[#756E69]">
            Selecting <strong>Needs Follow-up</strong> changes the case status to{" "}
            <strong>For Follow-up</strong>. Other progress statuses move an open case to{" "}
            <strong>In Progress</strong>.
          </div>

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
              disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013] disabled:opacity-60"
              style={{ fontSize: "15px" }}
            >
              {saving && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}

              {saving
                ? "Saving..."
                : generateAfterSave
                  ? "Save note and continue"
                  : "Save progress note"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TemporaryProgressAccessNotice({ accessUntil }) {
  return (
    <div className="border-b border-[#ECE8E5] px-4 py-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
            <Icon name="note" className="h-3.5 w-3.5" />
          </div>

          <div>
            <p className="text-[14px] font-semibold text-blue-800">Temporary counseling access</p>

            <p className="mt-1 text-[13px] leading-4 text-blue-700">
              You may add progress notes and generate or revise a progress-based intervention
              recommendation. The resulting draft must remain pending for the assigned counselor,
              who alone can accept, approve, finalize, or send it.
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

function MiniValue({ label, value }) {
  return (
    <div className="rounded-lg border border-violet-200 bg-white px-3 py-2">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-violet-500">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-medium text-violet-800">{value}</p>
    </div>
  );
}

function EmptyCaseSelection({
  title = "Select a case",
  message = "Choose a case from the list to view its progress notes.",
}) {
  return (
    <div className="grid min-h-[620px] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
          <Icon name="note" className="h-5 w-5" />
        </div>

        <p className="mt-4 text-[16px] font-semibold">{title}</p>
        <p className="mt-1 text-[14px] text-[#938C87]">{message}</p>
      </div>
    </div>
  );
}

function LoadingCase() {
  return (
    <div className="grid min-h-[620px] place-items-center">
      <div className="text-center">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />
        <p className="mt-3 text-[14px] text-[#827B77]">Loading case details...</p>
      </div>
    </div>
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

function NoteSection({ label, value, required = false, className = "" }) {
  return (
    <section className={`mt-3 ${className}`}>
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p className="mt-1 whitespace-pre-wrap text-[14px] leading-4 text-[#4F4945]">
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
      className={`inline-flex shrink-0 rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[status] || "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

function ProgressBadge({ status }) {
  const styles = {
    Improved: "bg-emerald-50 text-emerald-700",
    "No Progress": "bg-slate-100 text-slate-700",
    Worsened: "bg-red-50 text-red-700",
    "Needs Follow-up": "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[status] || "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status || "Needs Follow-up"}
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

function getLatestProgressNote(caseRecord) {
  const notes = caseRecord?.progressNotes || [];

  if (notes.length === 0) return null;

  return [...notes].sort(
    (a, b) => new Date(b.noteDate || b.createdAt) - new Date(a.noteDate || a.createdAt)
  )[0];
}

function formatStudentName(student) {
  if (!student) return "Unknown student";

  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

function formatCounselorName(counselor) {
  if (!counselor) return "Unknown counselor";

  if (typeof counselor === "string") {
    return "Assigned counselor";
  }

  return [counselor.firstName, counselor.middleName, counselor.lastName].filter(Boolean).join(" ");
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
