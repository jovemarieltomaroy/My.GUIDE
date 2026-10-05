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

const FOLLOW_UP_TYPES = [
  "Counseling Session",
  "Student Check-in",
  "Intervention Review",
  "Referral Follow-up",
  "Parent/Guardian Contact",
  "Academic Monitoring",
  "Other",
];

const FOLLOW_UP_PRIORITIES = [
  "Low",
  "Moderate",
  "High",
  "Urgent",
];

const STORED_STATUSES = [
  "Pending",
  "Completed",
  "Cancelled",
];

const FOLLOW_UP_TIME_OPTIONS = createTimeOptions();

const EMPTY_FOLLOW_UP_FORM = {
  followUpDate: "",
  followUpTime: "09:00",
  followUpType: "Counseling Session",
  purpose: "",
  priority: "Moderate",
  status: "Pending",
  remarks: "",
  completionRemarks: "",
};

export default function FollowUpsPage() {
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
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [isLoadingCase, setIsLoadingCase] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState("");

  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState(null);
  const [reminderConfirmOpen, setReminderConfirmOpen] = useState(false);
  const [followUpForReminder, setFollowUpForReminder] = useState(null);
  const [modalMode, setModalMode] = useState("create");
  const [followUpForm, setFollowUpForm] = useState(
    EMPTY_FOLLOW_UP_FORM,
  );

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

        [...(myCases || []), ...(temporaryCases || [])].forEach(
          (caseRecord) => {
            caseMap.set(
              caseRecord._id || caseRecord.id,
              caseRecord,
            );
          },
        );

        retrievedCases = Array.from(caseMap.values());
      }

      if (!Array.isArray(retrievedCases)) {
        throw new Error(
          "The backend returned an invalid cases response.",
        );
      }

      setCases(retrievedCases);

      if (
        selectedCaseId &&
        !retrievedCases.some(
          (caseRecord) =>
            (caseRecord._id || caseRecord.id) ===
            selectedCaseId,
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
          throw new Error(
            "The backend did not return the case record.",
          );
        }

        setSelectedCase(caseRecord);
      } catch (error) {
        console.error(
          "Unable to retrieve case details:",
          error,
        );

        if (error.status === 401) {
          handleUnauthorized();
          return;
        }

        setSelectedCase(null);
        setPageError(
          error.message ||
            "Unable to retrieve the selected case.",
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

  const allFollowUps = useMemo(() => {
    return cases.flatMap((caseRecord) =>
      (caseRecord.followUps || []).map((followUp) => ({
        ...followUp,
        caseRecord,
      })),
    );
  }, [cases]);

  const summary = useMemo(() => {
    return {
      pending: allFollowUps.filter(
        (item) =>
          item.status === "Pending" &&
          getComputedFollowUpStatus(item.followUpDate, item.status) ===
            "Pending",
      ).length,
      dueToday: allFollowUps.filter(
        (item) =>
          getComputedFollowUpStatus(
            item.followUpDate,
            item.status,
          ) === "Due Today",
      ).length,
      overdue: allFollowUps.filter(
        (item) =>
          getComputedFollowUpStatus(
            item.followUpDate,
            item.status,
          ) === "Overdue",
      ).length,
      completed: allFollowUps.filter(
        (item) => item.status === "Completed",
      ).length,
    };
  }, [allFollowUps]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = searchQuery.toLowerCase();

    return cases.filter((caseRecord) => {
      const studentName = formatStudentName(
        caseRecord.student,
      );

      const searchableValues = [
        caseRecord.caseNumber,
        studentName,
        caseRecord.student?.studentIdNumber,
        caseRecord.student?.college,
        caseRecord.student?.program,
        caseRecord.problemAssessment?.mainDomain,
      ];

      const matchesSearch =
        !normalizedSearch ||
        searchableValues
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(normalizedSearch),
          );

      const followUps = caseRecord.followUps || [];

      const matchesStatus =
        statusFilter === "All" ||
        followUps.some(
          (followUp) =>
            getComputedFollowUpStatus(
              followUp.followUpDate,
              followUp.status,
            ) === statusFilter,
        );

      const matchesType =
        !typeFilter ||
        followUps.some(
          (followUp) =>
            followUp.followUpType === typeFilter,
        );

      const matchesPriority =
        !priorityFilter ||
        followUps.some(
          (followUp) =>
            followUp.priority === priorityFilter,
        );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesPriority
      );
    });
  }, [
    cases,
    searchQuery,
    statusFilter,
    typeFilter,
    priorityFilter,
  ]);

  const selectedFollowUps = useMemo(() => {
    const followUps = [
      ...(selectedCase?.followUps || []),
    ];

    return followUps.sort((a, b) => {
      const aCompleted =
        ["Completed", "Cancelled"].includes(a.status);
      const bCompleted =
        ["Completed", "Cancelled"].includes(b.status);

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      return (
        new Date(a.followUpDate) -
        new Date(b.followUpDate)
      );
    });
  }, [selectedCase]);

  const canManageFollowUps =
    selectedCase &&
    !selectedCase.isArchived &&
    !["Closed", "Terminated"].includes(
      selectedCase.caseStatus,
    );

  const openCreateModal = () => {
    if (!selectedCase) return;

    setSelectedFollowUp(null);
    setModalMode("create");
    setFollowUpForm(EMPTY_FOLLOW_UP_FORM);
    setModalError("");
    setFollowUpModalOpen(true);
  };

  const openEditModal = (followUp) => {
    setSelectedFollowUp(followUp);
    setModalMode("edit");
    setFollowUpForm({
      followUpDate: toDateInput(
        followUp.followUpDate,
      ),
      followUpTime: toTimeInput(
        followUp.followUpDate,
      ),
      followUpType:
        followUp.followUpType ||
        "Counseling Session",
      purpose: followUp.purpose || "",
      priority: followUp.priority || "Moderate",
      status: followUp.status || "Pending",
      remarks: followUp.remarks || "",
      completionRemarks:
        followUp.completionRemarks || "",
    });
    setModalError("");
    setFollowUpModalOpen(true);
  };

  const openCompleteModal = (followUp) => {
    setSelectedFollowUp(followUp);
    setModalMode("complete");
    setFollowUpForm({
      followUpDate: toDateInput(
        followUp.followUpDate,
      ),
      followUpTime: toTimeInput(
        followUp.followUpDate,
      ),
      followUpType:
        followUp.followUpType ||
        "Counseling Session",
      purpose: followUp.purpose || "",
      priority: followUp.priority || "Moderate",
      status: "Completed",
      remarks: followUp.remarks || "",
      completionRemarks:
        followUp.completionRemarks || "",
    });
    setModalError("");
    setFollowUpModalOpen(true);
  };

  const saveFollowUp = async (event) => {
    event.preventDefault();

    if (!selectedCase) return;

    setIsSaving(true);
    setModalError("");

    try {
      let endpoint = "";
      let method = "POST";
      let payload = {};

      if (modalMode === "create") {
        endpoint = `/cases/${selectedCase._id}/follow-ups`;
        payload = {
          followUpDate: combineDateAndTime(
            followUpForm.followUpDate,
            followUpForm.followUpTime,
          ),
          followUpType: followUpForm.followUpType,
          purpose: followUpForm.purpose.trim(),
          priority: followUpForm.priority,
          remarks: followUpForm.remarks.trim(),
        };
      }

      if (modalMode === "edit") {
        endpoint = `/cases/${selectedCase._id}/follow-ups/${selectedFollowUp._id}`;
        method = "PATCH";
        payload = {
          followUpDate: combineDateAndTime(
            followUpForm.followUpDate,
            followUpForm.followUpTime,
          ),
          followUpType: followUpForm.followUpType,
          purpose: followUpForm.purpose.trim(),
          priority: followUpForm.priority,
          remarks: followUpForm.remarks.trim(),
        };
      }

      if (modalMode === "complete") {
        endpoint = `/cases/${selectedCase._id}/follow-ups/${selectedFollowUp._id}/complete`;
        method = "PATCH";
        payload = {
          completionRemarks:
            followUpForm.completionRemarks.trim(),
        };
      }

      const data = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const updatedCase = data?.case;

      if (!updatedCase) {
        throw new Error(
          "The backend did not return the updated case.",
        );
      }

      updateCaseInState(updatedCase);
      setFollowUpModalOpen(false);
      setSuccessMessage(
        data?.message ||
          "Follow-up updated successfully.",
      );
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setModalError(
        error.message ||
          "Unable to save the follow-up.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const cancelFollowUp = async (followUp) => {
    const confirmed = window.confirm(
      "Cancel this follow-up? It will remain in the record as cancelled.",
    );

    if (!confirmed || !selectedCase) return;

    setPageError("");

    try {
      const data = await apiRequest(
        `/cases/${selectedCase._id}/follow-ups/${followUp._id}/cancel`,
        {
          method: "PATCH",
          body: JSON.stringify({
            cancellationReason:
              "Cancelled by counselor.",
          }),
        },
      );

      const updatedCase = data?.case;

      if (!updatedCase) {
        throw new Error(
          "The backend did not return the updated case.",
        );
      }

      updateCaseInState(updatedCase);
      setSuccessMessage(
        data?.message ||
          "Follow-up cancelled successfully.",
      );
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(
        error.message ||
          "Unable to cancel the follow-up.",
      );
    }
  };

  const openReminderConfirmation = (followUp) => {
    if (!selectedCase || !followUp?._id) return;

    const studentEmail =
      selectedCase.student?.email?.trim();

    if (!studentEmail) {
      setPageError(
        "The student does not have an email address on record.",
      );
      return;
    }

    setFollowUpForReminder(followUp);
    setReminderConfirmOpen(true);
    setPageError("");
  };

  const closeReminderConfirmation = () => {
    if (sendingReminderId) return;

    setReminderConfirmOpen(false);
    setFollowUpForReminder(null);
  };

  const sendFollowUpReminder = async () => {
    if (
      !selectedCase ||
      !followUpForReminder?._id
    ) {
      return;
    }

    const studentEmail =
      selectedCase.student?.email?.trim();

    if (!studentEmail) {
      setReminderConfirmOpen(false);
      setFollowUpForReminder(null);
      setPageError(
        "The student does not have an email address on record.",
      );
      return;
    }

    setSendingReminderId(
      followUpForReminder._id,
    );
    setPageError("");

    try {
      const data = await apiRequest(
        `/cases/${selectedCase._id}/follow-ups/${followUpForReminder._id}/send-reminder`,
        {
          method: "POST",
        },
      );

      const updatedCase = data?.case;

      if (updatedCase) {
        updateCaseInState(updatedCase);
      }

      setReminderConfirmOpen(false);
      setFollowUpForReminder(null);

      setSuccessMessage(
        data?.message ||
          `Follow-up reminder sent to ${studentEmail}.`,
      );
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(
        error.message ||
          "Unable to send the follow-up reminder.",
      );
    } finally {
      setSendingReminderId("");
    }
  };

  const updateCaseInState = (updatedCase) => {
    setSelectedCase(updatedCase);

    setCases((current) =>
      current.map((caseRecord) =>
        (caseRecord._id || caseRecord.id) ===
        updatedCase._id
          ? updatedCase
          : caseRecord,
      ),
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#2F2A27]">
      <AppSidebar
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="min-h-screen lg:pl-[220px]">
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
                  onClick={() =>
                    navigate(
                      `/cases/${requestedCaseId}`,
                    )
                  }
                  className="grid h-8 w-8 place-items-center rounded-lg text-[#817A76] hover:bg-[#F5F2F0] hover:text-[#8C1518]"
                  aria-label="Back to case details"
                >
                  <Icon
                    name="arrowLeft"
                    className="h-3.5 w-3.5"
                  />
                </button>
              )}

              <div>
                <h1 className="text-[20px] font-semibold">
                  Follow-ups
                </h1>
                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  Track required next actions and upcoming case reviews
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              disabled={!canManageFollowUps}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ fontSize: "15px" }}
            >
              <Icon
                name="plus"
                className="h-3 w-3"
              />
              Add follow-up
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7">
          {successMessage && (
            <Alert
              tone="success"
              message={successMessage}
            />
          )}

          {pageError && (
            <Alert
              tone="error"
              message={pageError}
            />
          )}

          {!isFocusedCaseMode && (
            <>
              <section>
                <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
                  Follow-up tracker
                </h2>

                <p className="mt-1 max-w-[780px] text-[14px] leading-4 text-[#89817D]">
                  Monitor upcoming, due, overdue, completed,
                  and cancelled follow-up actions across
                  accessible cases.
                </p>
              </section>

              <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  label="Pending"
                  value={summary.pending}
                  helper="Upcoming actions"
                />
                <SummaryCard
                  label="Due today"
                  value={summary.dueToday}
                  helper="Needs attention today"
                />
                <SummaryCard
                  label="Overdue"
                  value={summary.overdue}
                  helper="Past the follow-up date"
                  urgent={summary.overdue > 0}
                />
                <SummaryCard
                  label="Completed"
                  value={summary.completed}
                  helper="Finished follow-ups"
                />
              </section>
            </>
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
                    {filteredCases.length === 1
                      ? ""
                      : "s"}{" "}
                    displayed
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
                          setSearchInput(
                            event.target.value,
                          )
                        }
                        placeholder="Search case or student..."
                        className="h-8 w-full rounded-lg border border-[#E1DCD8] bg-[#FAF9F8] pl-8 pr-2.5 outline-none focus:border-[#8C1518]"
                        style={{
                          fontSize: "15px",
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(
                            event.target.value,
                          )
                        }
                        className={filterClass}
                        style={{
                          fontSize: "15px",
                        }}
                      >
                        <option value="All">
                          All follow-ups
                        </option>
                        <option value="Pending">
                          Pending
                        </option>
                        <option value="Due Today">
                          Due Today
                        </option>
                        <option value="Overdue">
                          Overdue
                        </option>
                        <option value="Completed">
                          Completed
                        </option>
                        <option value="Cancelled">
                          Cancelled
                        </option>
                      </select>

                      <select
                        value={priorityFilter}
                        onChange={(event) =>
                          setPriorityFilter(
                            event.target.value,
                          )
                        }
                        className={filterClass}
                        style={{
                          fontSize: "15px",
                        }}
                      >
                        <option value="">
                          All priorities
                        </option>
                        {FOLLOW_UP_PRIORITIES.map(
                          (priority) => (
                            <option
                              key={priority}
                              value={priority}
                            >
                              {priority}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <select
                      value={typeFilter}
                      onChange={(event) =>
                        setTypeFilter(
                          event.target.value,
                        )
                      }
                      className={filterClass}
                      style={{
                        fontSize: "15px",
                      }}
                    >
                      <option value="">
                        All follow-up types
                      </option>

                      {FOLLOW_UP_TYPES.map((type) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {type}
                        </option>
                      ))}
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
                  message="Choose a case to view and manage its follow-ups."
                />
              ) : isLoadingCase ? (
                <LoadingState />
              ) : selectedCase ? (
                <>
                  <CaseHeader
                    caseRecord={selectedCase}
                    canCreate={canManageFollowUps}
                    onCreate={openCreateModal}
                  />

                  <div className="border-b border-[#ECE8E5] p-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoCard
                        label="Case status"
                        value={
                          selectedCase.caseStatus ||
                          "—"
                        }
                      />
                      <InfoCard
                        label="Priority"
                        value={
                          selectedCase.priorityLevel ||
                          "—"
                        }
                      />
                      <InfoCard
                        label="Main domain"
                        value={
                          selectedCase
                            .problemAssessment
                            ?.mainDomain || "—"
                        }
                      />
                      <InfoCard
                        label="Follow-ups"
                        value={String(
                          selectedFollowUps.length,
                        )}
                      />
                    </div>
                  </div>

                  <FollowUpList
                    followUps={selectedFollowUps}
                    caseRecord={selectedCase}
                    onEdit={openEditModal}
                    onComplete={openCompleteModal}
                    onCancel={cancelFollowUp}
                    onGoToCase={() =>
                      navigate(
                        `/cases/${selectedCase._id}`,
                      )
                    }
                    onAddProgressNote={() =>
                      navigate(
                        `/progress-notes?caseId=${selectedCase._id}`,
                      )
                    }
                    onSendReminder={openReminderConfirmation}
                    sendingReminderId={sendingReminderId}
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

      <FollowUpModal
        open={followUpModalOpen}
        mode={modalMode}
        caseRecord={selectedCase}
        form={followUpForm}
        setForm={setFollowUpForm}
        error={modalError}
        saving={isSaving}
        onClose={() =>
          setFollowUpModalOpen(false)
        }
        onSubmit={saveFollowUp}
      />

      <ReminderConfirmationModal
        open={reminderConfirmOpen}
        caseRecord={selectedCase}
        followUp={followUpForReminder}
        sending={Boolean(sendingReminderId)}
        onClose={closeReminderConfirmation}
        onConfirm={sendFollowUpReminder}
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
        title="No matching cases"
        message="Adjust the filters or verify the case assignment."
        compact
      />
    );
  }

  return (
    <div className="max-h-[680px] divide-y divide-[#EEEAE7] overflow-y-auto">
      {cases.map((caseRecord) => {
        const caseId =
          caseRecord._id || caseRecord.id;
        const selected =
          selectedCaseId === caseId;
        const followUps =
          caseRecord.followUps || [];
        const nextFollowUp =
          getNextFollowUp(followUps);

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
                  {formatStudentName(
                    caseRecord.student,
                  )}
                </p>

                <p className="mt-1 text-[13px] text-[#938B86]">
                  {caseRecord.caseNumber ||
                    "No case number"}{" "}
                  ·{" "}
                  {caseRecord.student
                    ?.studentIdNumber ||
                    "No student ID"}
                </p>
              </div>

              <CaseStatusBadge
                status={caseRecord.caseStatus}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="truncate text-[13px] text-[#9A928D]">
                {nextFollowUp
                  ? formatDateTime(
                      nextFollowUp.followUpDate,
                    )
                  : "No pending follow-up"}
              </span>

              {nextFollowUp && (
                <FollowUpStatusBadge
                  status={getComputedFollowUpStatus(
                    nextFollowUp.followUpDate,
                    nextFollowUp.status,
                  )}
                />
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
  canCreate,
  onCreate,
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-[#ECE8E5] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-semibold">
            {formatStudentName(
              caseRecord.student,
            )}
          </h3>

          <CaseStatusBadge
            status={caseRecord.caseStatus}
          />
        </div>

        <p className="mt-1 text-[14px] text-[#938B86]">
          {caseRecord.caseNumber} ·{" "}
          {caseRecord.student?.studentIdNumber ||
            "No student ID"}
        </p>

        <p className="mt-1 text-[13px] text-[#AAA19C]">
          Assigned to{" "}
          {formatCounselorName(
            caseRecord.assignedCounselor,
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={onCreate}
        disabled={!canCreate}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: "15px" }}
      >
        <Icon
          name="plus"
          className="h-3 w-3"
        />
        Add follow-up
      </button>
    </header>
  );
}

function FollowUpList({
  followUps,
  caseRecord,
  onEdit,
  onComplete,
  onCancel,
  onGoToCase,
  onAddProgressNote,
  onSendReminder,
  sendingReminderId,
}) {
  if (followUps.length === 0) {
    return (
      <EmptyState
        title="No follow-ups yet"
        message="Add a follow-up to track the next required action for this case."
      />
    );
  }

  const caseIsActive =
    !caseRecord.isArchived &&
    !["Closed", "Terminated"].includes(
      caseRecord.caseStatus,
    );

  return (
    <div className="max-h-[680px] space-y-3 overflow-y-auto p-4">
      {followUps.map((followUp) => {
        const computedStatus =
          getComputedFollowUpStatus(
            followUp.followUpDate,
            followUp.status,
          );

        const canModify =
          caseIsActive &&
          followUp.status === "Pending";

        return (
          <article
            key={followUp._id}
            className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <FollowUpStatusBadge
                    status={computedStatus}
                  />
                  <PriorityBadge
                    priority={followUp.priority}
                  />
                </div>

                <h4 className="mt-3 text-[15px] font-semibold">
                  {followUp.followUpType}
                </h4>

                <p className="mt-1 text-[13px] text-[#9A928D]">
                  Scheduled for{" "}
                  {formatDateTime(
                    followUp.followUpDate,
                  )}
                </p>

                <p className="mt-1 text-[13px] text-[#9A928D]">
                  Reminder recipient:{" "}
                  {caseRecord.student?.email ||
                    "No student email recorded"}
                </p>
              </div>
            </div>

            <FollowUpSection
              label="Purpose"
              value={followUp.purpose}
              required
            />

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <FollowUpSection
                label="Remarks"
                value={followUp.remarks}
              />

              <FollowUpSection
                label="Created by"
                value={formatCounselorName(
                  followUp.createdBy,
                )}
              />
            </div>

            {followUp.completionRemarks && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[13px] font-semibold text-emerald-700">
                  Completion remarks
                </p>

                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-4 text-emerald-700">
                  {followUp.completionRemarks}
                </p>
              </div>
            )}

            {followUp.cancellationReason && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-[13px] font-semibold text-red-700">
                  Cancellation reason
                </p>

                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-4 text-red-700">
                  {followUp.cancellationReason}
                </p>
              </div>
            )}

            {followUp.reminderSentAt && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="text-[13px] font-semibold text-blue-700">
                  Student reminder sent
                </p>

                <p className="mt-1 text-[14px] leading-4 text-blue-700">
                  Sent to {caseRecord.student?.email || "the student"} on{" "}
                  {formatDateTime(followUp.reminderSentAt)}.
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#ECE8E5] pt-3">
              <ActionButton
                onClick={onGoToCase}
              >
                Go to case
              </ActionButton>

              {canModify && (
                <>
                  <ActionButton
                    primary
                    disabled={
                      !caseRecord.student?.email ||
                      sendingReminderId === followUp._id
                    }
                    onClick={() =>
                      onSendReminder(followUp)
                    }
                  >
                    {sendingReminderId === followUp._id
                      ? "Sending reminder..."
                      : followUp.reminderSentAt
                        ? "Send reminder again"
                        : "Send student reminder"}
                  </ActionButton>

                  <ActionButton
                    onClick={() =>
                      onEdit(followUp)
                    }
                  >
                    Edit
                  </ActionButton>

                  <ActionButton
                    danger
                    onClick={() =>
                      onCancel(followUp)
                    }
                  >
                    Cancel
                  </ActionButton>

                  <ActionButton
                    primary
                    onClick={() =>
                      onComplete(followUp)
                    }
                  >
                    Mark completed
                  </ActionButton>
                </>
              )}

              {followUp.status === "Completed" && (
                <ActionButton
                  primary
                  onClick={onAddProgressNote}
                >
                  Add progress note
                </ActionButton>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ReminderConfirmationModal({
  open,
  caseRecord,
  followUp,
  sending,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    const closeOnEscape = (event) => {
      if (
        event.key === "Escape" &&
        !sending
      ) {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, [open, sending, onClose]);

  if (!open || !caseRecord || !followUp) {
    return null;
  }

  const studentName =
    formatStudentName(caseRecord.student);

  const studentEmail =
    caseRecord.student?.email ||
    "No student email";

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!sending) onClose();
        }}
        aria-label="Close reminder confirmation"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-confirmation-title"
        className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
              <Icon name="calendar" className="h-4 w-4" />
            </div>

            <div>
              <h2
                id="reminder-confirmation-title"
                className="text-[20px] font-semibold"
              >
                Send student reminder?
              </h2>

              <p className="mt-1 text-[14px] leading-4 text-[#938B86]">
                Review the recipient and schedule before sending.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#8C847F] hover:bg-[#F4F1EF] disabled:opacity-40"
            aria-label="Close"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="p-5">
          <div className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ConfirmationItem label="Student" value={studentName} />
              <ConfirmationItem label="Email recipient" value={studentEmail} />
              <ConfirmationItem label="Follow-up type" value={followUp.followUpType || "Follow-up"} />
              <ConfirmationItem label="Date and time" value={formatDateTime(followUp.followUpDate)} />
            </div>

            <div className="mt-3 border-t border-[#ECE8E5] pt-3">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">Purpose</p>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-4 text-[#4F4945]">
                {followUp.purpose || "No purpose recorded."}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-[14px] font-semibold text-blue-700">Email privacy reminder</p>
            <p className="mt-1 text-[14px] leading-4 text-blue-700">
              Only the follow-up type, schedule, and general purpose will be sent. Detailed counseling notes are not included.
            </p>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#ECE8E5] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[14px] font-medium text-[#5E5753] disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={sending}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 text-[14px] font-semibold text-white hover:bg-[#701013] disabled:opacity-60"
          >
            {sending && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}

            {sending ? "Sending reminder..." : "Send reminder"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ConfirmationItem({ label, value }) {
  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p className="mt-1 break-words text-[14px] font-medium text-[#4E4844]">
        {value || "Not recorded"}
      </p>
    </div>
  );
}

function FollowUpModal({
  open,
  mode,
  caseRecord,
  form,
  setForm,
  error,
  saving,
  onClose,
  onSubmit,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const closeOnEscape = (event) => {
      if (
        event.key === "Escape" &&
        !saving
      ) {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, [open, saving, onClose]);

  if (!open || !caseRecord) return null;

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const title =
    mode === "create"
      ? "Add follow-up"
      : mode === "edit"
        ? "Edit follow-up"
        : "Complete follow-up";

  const submitLabel =
    mode === "create"
      ? "Save follow-up"
      : mode === "edit"
        ? "Save changes"
        : "Mark completed";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!saving) onClose();
        }}
        aria-label="Close follow-up modal"
      />

      <section
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">
              {title}
            </h2>

            <p className="mt-1 text-[14px] text-[#938B86]">
              {caseRecord.caseNumber} ·{" "}
              {formatStudentName(
                caseRecord.student,
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#8C847F] hover:bg-[#F4F1EF] disabled:opacity-40"
            aria-label="Close"
          >
            <Icon
              name="close"
              className="h-3.5 w-3.5"
            />
          </button>
        </header>

        <form
          onSubmit={onSubmit}
          className="overflow-y-auto p-5"
        >
          {error && (
            <Alert
              tone="error"
              message={error}
            />
          )}

          {mode === "complete" ? (
            <>
              <div className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
                  Follow-up
                </p>

                <p className="mt-1 text-[15px] font-semibold">
                  {form.followUpType}
                </p>

                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-4 text-[#5A534F]">
                  {form.purpose}
                </p>

                <p className="mt-2 text-[13px] text-[#938B86]">
                  {formatDateTime(
                    combineDateAndTime(
                      form.followUpDate,
                      form.followUpTime,
                    ),
                  )}
                </p>
              </div>

              <Field
                label="Completion remarks"
                required
                className="mt-4"
              >
                <textarea
                  required
                  value={
                    form.completionRemarks
                  }
                  onChange={(event) =>
                    update(
                      "completionRemarks",
                      event.target.value,
                    )
                  }
                  placeholder="Record the outcome of the follow-up and any next action."
                  rows={5}
                  className={textareaClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Follow-up date"
                required
              >
                <input
                  type="date"
                  required
                  min={getTodayInputValue()}
                  value={form.followUpDate}
                  onChange={(event) =>
                    update(
                      "followUpDate",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              <Field
                label="Follow-up time"
                required
              >
                <select
                  required
                  value={form.followUpTime}
                  onChange={(event) =>
                    update(
                      "followUpTime",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                  style={{
                    fontSize: "15px",
                  }}
                >
                  {FOLLOW_UP_TIME_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field
                label="Follow-up type"
                required
              >
                <select
                  required
                  value={form.followUpType}
                  onChange={(event) =>
                    update(
                      "followUpType",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                  style={{
                    fontSize: "15px",
                  }}
                >
                  {FOLLOW_UP_TYPES.map(
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

              <Field
                label="Priority"
                required
              >
                <select
                  required
                  value={form.priority}
                  onChange={(event) =>
                    update(
                      "priority",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                  style={{
                    fontSize: "15px",
                  }}
                >
                  {FOLLOW_UP_PRIORITIES.map(
                    (priority) => (
                      <option
                        key={priority}
                        value={priority}
                      >
                        {priority}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field
                label="Current status"
              >
                <input
                  value={
                    form.status || "Pending"
                  }
                  readOnly
                  className={`${inputClass} bg-[#F5F2F0] text-[#817A76]`}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              <Field
                label="Purpose"
                required
                className="sm:col-span-2"
              >
                <textarea
                  required
                  value={form.purpose}
                  onChange={(event) =>
                    update(
                      "purpose",
                      event.target.value,
                    )
                  }
                  placeholder="State what must be reviewed, checked, discussed, or completed during the follow-up."
                  rows={5}
                  className={textareaClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>

              <Field
                label="Remarks"
                className="sm:col-span-2"
              >
                <textarea
                  value={form.remarks}
                  onChange={(event) =>
                    update(
                      "remarks",
                      event.target.value,
                    )
                  }
                  placeholder="Add reminders, preparation notes, or other relevant details."
                  rows={3}
                  className={textareaClass}
                  style={{
                    fontSize: "15px",
                  }}
                />
              </Field>
            </div>
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
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013] disabled:opacity-60"
              style={{
                fontSize: "15px",
              }}
            >
              {saving && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}

              {saving
                ? "Saving..."
                : submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  urgent = false,
}) {
  return (
    <article
      className={`rounded-2xl border bg-white p-4 ${
        urgent
          ? "border-red-200"
          : "border-[#E4DFDC]"
      }`}
    >
      <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p
        className={`mt-2 text-[20px] font-semibold ${
          urgent
            ? "text-red-600"
            : "text-[#342F2C]"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-[13px] text-[#9A928D]">
        {helper}
      </p>
    </article>
  );
}

function InfoCard({ label, value }) {
  return (
    <article className="rounded-xl border border-[#E8E3E0] bg-[#FCFBFA] p-3">
      <p className="text-[13px] text-[#958D88]">
        {label}
      </p>

      <p className="mt-1 break-words text-[14px] font-semibold text-[#4E4844]">
        {value}
      </p>
    </article>
  );
}

function FollowUpSection({
  label,
  value,
  required = false,
}) {
  return (
    <section className="mt-3">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p className="mt-1 whitespace-pre-wrap text-[14px] leading-4 text-[#4F4945]">
        {value ||
          (required
            ? "No information recorded."
            : "—")}
      </p>
    </section>
  );
}

function Field({
  label,
  required = false,
  className = "",
  children,
}) {
  return (
    <label className={`block ${className}`}>
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
    </label>
  );
}

function ActionButton({
  onClick,
  children,
  primary = false,
  danger = false,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-7 rounded-lg border px-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
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

function CaseStatusBadge({ status }) {
  const styles = {
    Open: "bg-blue-50 text-blue-700",
    "In Progress":
      "bg-amber-50 text-amber-700",
    "For Follow-up":
      "bg-violet-50 text-violet-700",
    Closed:
      "bg-emerald-50 text-emerald-700",
    Terminated: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[status] ||
        "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

function FollowUpStatusBadge({ status }) {
  const styles = {
    Pending: "bg-blue-50 text-blue-700",
    "Due Today":
      "bg-amber-50 text-amber-700",
    Overdue: "bg-red-50 text-red-700",
    Completed:
      "bg-emerald-50 text-emerald-700",
    Cancelled:
      "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[status] ||
        "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    Low: "bg-slate-100 text-slate-700",
    Moderate: "bg-blue-50 text-blue-700",
    High: "bg-amber-50 text-amber-700",
    Urgent: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[priority] ||
        "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {priority || "Moderate"}
    </span>
  );
}

function EmptyState({
  title,
  message,
  compact = false,
}) {
  return (
    <div
      className={`grid place-items-center px-6 text-center ${
        compact
          ? "min-h-[420px]"
          : "min-h-[620px]"
      }`}
    >
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
          <Icon
            name="calendar"
            className="h-5 w-5"
          />
        </div>

        <p className="mt-4 text-[16px] font-semibold">
          {title}
        </p>

        <p className="mt-1 text-[14px] text-[#938C87]">
          {message}
        </p>
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

function getComputedFollowUpStatus(
  followUpDate,
  storedStatus,
) {
  if (
    storedStatus === "Completed" ||
    storedStatus === "Cancelled"
  ) {
    return storedStatus;
  }

  if (!followUpDate) {
    return "Pending";
  }

  const now = new Date();
  const dueDate = new Date(followUpDate);

  if (Number.isNaN(dueDate.getTime())) {
    return "Pending";
  }

  const nowDateOnly = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const dueDateOnly = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );

  if (
    dueDateOnly.getTime() ===
    nowDateOnly.getTime()
  ) {
    return "Due Today";
  }

  if (dueDate < now) {
    return "Overdue";
  }

  return "Pending";
}

function getNextFollowUp(followUps) {
  return [...(followUps || [])]
    .filter(
      (followUp) =>
        followUp.status === "Pending",
    )
    .sort(
      (a, b) =>
        new Date(a.followUpDate) -
        new Date(b.followUpDate),
    )[0];
}

function createTimeOptions() {
  const options = [];

  for (let hour = 7; hour <= 18; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === 18 && minute === 30) continue;

      const value = `${String(hour).padStart(2, "0")}:${String(
        minute,
      ).padStart(2, "0")}`;

      const date = new Date();
      date.setHours(hour, minute, 0, 0);

      const label = new Intl.DateTimeFormat("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);

      options.push({
        value,
        label,
      });
    }
  }

  return options;
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue) return "";

  const safeTime = timeValue || "09:00";
  const combinedDate = new Date(
    `${dateValue}T${safeTime}:00`,
  );

  if (Number.isNaN(combinedDate.getTime())) {
    return "";
  }

  return combinedDate.toISOString();
}

function toDateInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) =>
    String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1,
  )}-${pad(date.getDate())}`;
}

function toTimeInput(value) {
  if (!value) return "09:00";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "09:00";
  }

  const minutes =
    date.getMinutes() < 30 ? "00" : "30";

  return `${String(date.getHours()).padStart(
    2,
    "0",
  )}:${minutes}`;
}

function getTodayInputValue() {
  const today = new Date();

  const pad = (number) =>
    String(number).padStart(2, "0");

  return `${today.getFullYear()}-${pad(
    today.getMonth() + 1,
  )}-${pad(today.getDate())}`;
}

function formatStudentName(student) {
  if (!student) return "Unknown student";

  return [
    student.firstName,
    student.middleName,
    student.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatCounselorName(counselor) {
  if (!counselor) return "Unknown counselor";

  if (typeof counselor === "string") {
    return "Assigned counselor";
  }

  return [
    counselor.firstName,
    counselor.middleName,
    counselor.lastName,
  ]
    .filter(Boolean)
    .join(" ");
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