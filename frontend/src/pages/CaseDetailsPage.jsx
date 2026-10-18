import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ALL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "assessment", label: "Assessment" },
  { id: "history", label: "Background" },
  { id: "formulation", label: "Formulation" },
  { id: "interventions", label: "Intervention Plans" },
  { id: "progress", label: "Progress Notes" },
  { id: "timeline", label: "Timeline" },
];

const ADMIN_VISIBLE_TABS = [
  "overview",
  "timeline",
];

const ADMIN_ROLE = "Counselor-Admin";
const EMPTY_TEMPORARY_ACCESS_FORM = {
  temporaryCounselor: "",
  reason: "",
  accessUntilDate: "",
  accessUntilTime: "17:00",
};

export default function CaseDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [caseRecord, setCaseRecord] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState(
    location.state?.successMessage || "",
  );

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusAction, setStatusAction] = useState("");
  const [statusRemarks, setStatusRemarks] = useState("");
  const [statusError, setStatusError] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [counselors, setCounselors] = useState([]);
  const [isLoadingCounselors, setIsLoadingCounselors] = useState(false);
  const [grantAccessModalOpen, setGrantAccessModalOpen] = useState(false);
  const [grantAccessForm, setGrantAccessForm] = useState(EMPTY_TEMPORARY_ACCESS_FORM);
  const [grantAccessError, setGrantAccessError] = useState("");
  const [isGrantingAccess, setIsGrantingAccess] = useState(false);
  const [revokeAccessModalOpen, setRevokeAccessModalOpen] = useState(false);
  const [selectedAccessRecord, setSelectedAccessRecord] = useState(null);
  const [revocationReason, setRevocationReason] = useState("");
  const [revokeAccessError, setRevokeAccessError] = useState("");
  const [isRevokingAccess, setIsRevokingAccess] = useState(false);

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
    if (!successMessage) return undefined;

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const handleUnauthorized = useCallback(() => {
    clearUser();
    navigate("/login", { replace: true });
  }, [clearUser, navigate]);

  const fetchCase = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setPageError("");

    try {
      const data = await apiRequest(`/cases/${id}`, {
        method: "GET",
      });

      const foundCase = data?.case || data;

      if (!foundCase?._id) {
        throw new Error("The backend did not return a valid case record.");
      }

      setCaseRecord(foundCase);
    } catch (error) {
      console.error("Unable to retrieve case:", error);

      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(error.message || "Unable to retrieve the case.");
    } finally {
      setIsLoading(false);
    }
  }, [id, handleUnauthorized]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  const fetchTimeline = useCallback(async () => {
    if (!id) return;

    setIsTimelineLoading(true);
    setPageError("");

    try {
      const data = await apiRequest(`/cases/${id}/timeline`, {
        method: "GET",
      });

      setTimeline(Array.isArray(data?.timeline) ? data.timeline : []);
    } catch (error) {
      console.error("Unable to retrieve case timeline:", error);

      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(
        error.message || "Unable to retrieve the case timeline.",
      );
    } finally {
      setIsTimelineLoading(false);
    }
  }, [id, handleUnauthorized]);

  useEffect(() => {
    if (activeTab === "timeline" && timeline.length === 0) {
      fetchTimeline();
    }
  }, [activeTab, timeline.length, fetchTimeline]);

  const studentName = useMemo(
    () => formatPersonName(caseRecord?.student),
    [caseRecord],
  );

  const assignedCounselorName = useMemo(
    () => formatPersonName(caseRecord?.assignedCounselor),
    [caseRecord],
  );

  const assignedCounselorId =
    caseRecord?.assignedCounselor?._id || caseRecord?.assignedCounselor;

  const isAdmin =
    user?.role === ADMIN_ROLE;

  const creatorId =
    caseRecord?.createdBy?._id || caseRecord?.createdBy?.id || caseRecord?.createdBy;
  const currentUserId = user?._id || user?.id;
  const isCaseCreator =
    Boolean(creatorId && currentUserId) &&
    String(creatorId) === String(currentUserId);
  const isAdminOverviewOnly = isAdmin && !isCaseCreator;

  const visibleTabs = useMemo(() => {
    if (isAdminOverviewOnly) {
      return ALL_TABS.filter((tab) =>
        ADMIN_VISIBLE_TABS.includes(tab.id),
      );
    }

    return ALL_TABS;
  }, [isAdminOverviewOnly]);

  useEffect(() => {
    if (
      !visibleTabs.some(
        (tab) => tab.id === activeTab,
      )
    ) {
      setActiveTab("overview");
    }
  }, [visibleTabs, activeTab]);

  const isAssignedCounselor =
    Boolean(caseRecord && user?._id) &&
    assignedCounselorId?.toString() ===
      user._id.toString();

  const canManageTemporaryAccess =
    Boolean(caseRecord) &&
    !caseRecord.isArchived &&
    !["Closed", "Terminated"].includes(caseRecord.caseStatus) &&
    (isAdmin || isAssignedCounselor);

  const temporaryAccessRecords = useMemo(
    () => [...(caseRecord?.temporaryCounselor || [])].sort(
      (a, b) => new Date(b.grantedAt || 0) - new Date(a.grantedAt || 0),
    ),
    [caseRecord],
  );

  const currentUserTemporaryAccess = useMemo(() => {
    if (!user?._id) return null;
    return temporaryAccessRecords.find((access) => {
      const counselorId = access.counselor?._id || access.counselor;
      return (
        counselorId?.toString() === user._id.toString() &&
        getTemporaryAccessStatus(access) === "Active"
      );
    });
  }, [temporaryAccessRecords, user]);

  const fetchActiveCounselors = async () => {
    setIsLoadingCounselors(true);
    setGrantAccessError("");

    try {
      const data = await apiRequest(
        "/users/counselors/active",
        {
          method: "GET",
        },
      );

      const counselorList =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.counselors)
            ? data.counselors
            : [];

      setCounselors(
        counselorList.filter(
          (counselor) => {
            const counselorId =
              counselor._id ||
              counselor.id;

            return (
              [
                "Counselor-Admin",
                "Counselor-User",
              ].includes(
                counselor.role,
              ) &&
              counselor.isActive !== false &&
              counselorId?.toString() !==
                assignedCounselorId?.toString() &&
              counselorId?.toString() !==
                user?._id?.toString()
            );
          },
        ),
      );
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setGrantAccessError(
        error.message ||
          "Unable to retrieve active counselors.",
      );

      setCounselors([]);
    } finally {
      setIsLoadingCounselors(false);
    }
  };

  const openGrantAccessModal = async () => {
    if (!canManageTemporaryAccess) return;
    setGrantAccessForm(EMPTY_TEMPORARY_ACCESS_FORM);
    setGrantAccessError("");
    setGrantAccessModalOpen(true);
    await fetchActiveCounselors();
  };

  const closeGrantAccessModal = () => {
    if (isGrantingAccess) return;
    setGrantAccessModalOpen(false);
    setGrantAccessForm(EMPTY_TEMPORARY_ACCESS_FORM);
    setGrantAccessError("");
  };

  const submitGrantTemporaryAccess = async (event) => {
    event.preventDefault();
    if (!caseRecord) return;

    if (!grantAccessForm.temporaryCounselor) {
      setGrantAccessError("Select a temporary counselor.");
      return;
    }
    if (!grantAccessForm.reason.trim()) {
      setGrantAccessError("Reason for temporary access is required.");
      return;
    }

    const accessUntil = combineDateAndTime(
      grantAccessForm.accessUntilDate,
      grantAccessForm.accessUntilTime,
    );

    if (!accessUntil || new Date(accessUntil) <= new Date()) {
      setGrantAccessError("Access expiration must be a valid future date and time.");
      return;
    }

    setIsGrantingAccess(true);
    setGrantAccessError("");

    try {
      const data = await apiRequest(`/cases/${caseRecord._id}/temporary-access`, {
        method: "POST",
        body: JSON.stringify({
          temporaryCounselor: grantAccessForm.temporaryCounselor,
          reason: grantAccessForm.reason.trim(),
          accessUntil,
        }),
      });

      if (!data?.case) {
        throw new Error("The backend did not return the updated case.");
      }

      setCaseRecord(data.case);
      setGrantAccessModalOpen(false);
      setGrantAccessForm(EMPTY_TEMPORARY_ACCESS_FORM);
      setSuccessMessage(data?.message || "Temporary access granted successfully.");
      if (activeTab === "timeline") await fetchTimeline();
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }
      setGrantAccessError(error.message || "Unable to grant temporary access.");
    } finally {
      setIsGrantingAccess(false);
    }
  };

  const openRevokeAccessModal = (accessRecord) => {
    if (!canManageTemporaryAccess) return;
    setSelectedAccessRecord(accessRecord);
    setRevocationReason("");
    setRevokeAccessError("");
    setRevokeAccessModalOpen(true);
  };

  const closeRevokeAccessModal = () => {
    if (isRevokingAccess) return;
    setRevokeAccessModalOpen(false);
    setSelectedAccessRecord(null);
    setRevocationReason("");
    setRevokeAccessError("");
  };

  const submitRevokeTemporaryAccess = async (event) => {
    event.preventDefault();
    if (!caseRecord || !selectedAccessRecord?._id) return;
    if (!revocationReason.trim()) {
      setRevokeAccessError("Revocation reason is required.");
      return;
    }

    setIsRevokingAccess(true);
    setRevokeAccessError("");

    try {
      const data = await apiRequest(
        `/cases/${caseRecord._id}/temporary-access/${selectedAccessRecord._id}/revoke`,
        {
          method: "PATCH",
          body: JSON.stringify({ revocationReason: revocationReason.trim() }),
        },
      );

      if (!data?.case) {
        throw new Error("The backend did not return the updated case.");
      }

      setCaseRecord(data.case);
      setRevokeAccessModalOpen(false);
      setSelectedAccessRecord(null);
      setRevocationReason("");
      setSuccessMessage(data?.message || "Temporary access revoked successfully.");
      if (activeTab === "timeline") await fetchTimeline();
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }
      setRevokeAccessError(error.message || "Unable to revoke temporary access.");
    } finally {
      setIsRevokingAccess(false);
    }
  };

  const openStatusModal = (action) => {
    setStatusAction(action);
    setStatusRemarks("");
    setStatusError("");
    setStatusModalOpen(true);
  };

  const closeStatusModal = () => {
    if (isUpdatingStatus) return;

    setStatusModalOpen(false);
    setStatusAction("");
    setStatusRemarks("");
    setStatusError("");
  };

  const submitCaseStatus = async (event) => {
    event.preventDefault();

    if (!caseRecord || !statusAction) return;

    if (!statusRemarks.trim()) {
      setStatusError(
        statusAction === "Closed"
          ? "Closing remarks are required."
          : "Termination reason is required.",
      );
      return;
    }

    setIsUpdatingStatus(true);
    setStatusError("");

    try {
      const requestBody =
        statusAction === "Closed"
          ? {
              caseStatus: "Closed",
              closingRemarks: statusRemarks.trim(),
            }
          : {
              caseStatus: "Terminated",
              terminationReason: statusRemarks.trim(),
            };

      const data = await apiRequest(
        `/cases/${caseRecord._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify(requestBody),
        },
      );

      const updatedCase = data?.case;

      if (!updatedCase) {
        throw new Error(
          "The backend did not return the updated case.",
        );
      }

      setCaseRecord(updatedCase);
      setStatusModalOpen(false);
      setStatusAction("");
      setStatusRemarks("");
      setSuccessMessage(
        data?.message || "Case status updated successfully.",
      );

      if (activeTab === "timeline") {
        await fetchTimeline();
      }
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setStatusError(
        error.message || "Unable to update the case status.",
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#292522]">
      <AppSidebar
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="min-h-screen lg:pl-[220px]">
        <header className="sticky top-0 z-30 border-b border-[#E6E1DE] bg-white/95 backdrop-blur-xl">
          <div className="flex min-h-[62px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#E4DFDC] text-[#655E59] lg:hidden"
                aria-label="Open navigation"
              >
                <Icon name="menu" className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/cases")}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#817A76] hover:bg-[#F5F2F0] hover:text-[#8C1518]"
                aria-label="Back to cases"
              >
                <Icon name="arrowLeft" className="h-3.5 w-3.5" />
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-[20px] font-semibold">
                  {caseRecord?.caseNumber || "Case Details"}
                </h1>

                <p className="hidden truncate text-[14px] text-[#99918C] sm:block">
                  {isAdminOverviewOnly
                    ? "Administrative case overview and activity timeline"
                    : "Complete case preview and counselor workspace"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!isAdminOverviewOnly && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/intervention-plans?caseId=${caseRecord._id}`,
                      )
                    }
                    disabled={!caseRecord}
                    className="hidden h-8 rounded-lg border border-[#D9D2CE] bg-white px-3 text-[14px] font-semibold text-[#5F5854] hover:border-[#8C1518] hover:text-[#8C1518] disabled:opacity-40 sm:inline-flex sm:items-center"
                  >
                    Intervention plans
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/progress-notes?caseId=${caseRecord._id}`,
                      )
                    }
                    disabled={!caseRecord}
                    className="hidden h-8 rounded-lg border border-[#D9D2CE] bg-white px-3 text-[14px] font-semibold text-[#5F5854] hover:border-[#8C1518] hover:text-[#8C1518] disabled:opacity-40 sm:inline-flex sm:items-center"
                  >
                    Progress notes
                  </button>
                </>
              )}

              {caseRecord &&
                !["Closed", "Terminated"].includes(
                  caseRecord.caseStatus,
                ) && (
                  <>
                    <button
                      type="button"
                      onClick={() => openStatusModal("Closed")}
                      className="hidden h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[14px] font-semibold text-emerald-700 hover:bg-emerald-100 md:inline-flex"
                    >
                      Close case
                    </button>

                    <button
                      type="button"
                      onClick={() => openStatusModal("Terminated")}
                      className="hidden h-8 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-[14px] font-semibold text-red-700 hover:bg-red-100 md:inline-flex"
                    >
                      Terminate
                    </button>
                  </>
                )}

              <button
                type="button"
                onClick={fetchCase}
                disabled={!caseRecord || isLoading}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 text-[14px] font-semibold text-white hover:bg-[#701013] disabled:opacity-40"
              >
                <Icon name="refresh" className="h-3 w-3" />
                Refresh
              </button>
            </div>
          </div>

          <nav className="overflow-x-auto border-t border-[#F0ECE9] px-4 sm:px-6 lg:px-7">
            <div className="flex min-w-max gap-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`border-b-2 px-3 py-2.5 text-[14px] font-semibold transition ${
                    activeTab === tab.id
                      ? "border-[#8C1518] text-[#8C1518]"
                      : "border-transparent text-[#837B76] hover:text-[#4F4844]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-7">
          {successMessage && (
            <Alert tone="success" message={successMessage} />
          )}

          {pageError && <Alert tone="error" message={pageError} />}

          {isLoading ? (
            <LoadingState />
          ) : !caseRecord ? (
            <EmptyState
              title="Case unavailable"
              message="The case could not be displayed."
            />
          ) : (
            <>
              <CaseHero
                caseRecord={caseRecord}
                studentName={studentName}
                assignedCounselorName={assignedCounselorName}
              />

              {caseRecord &&
                !["Closed", "Terminated"].includes(
                  caseRecord.caseStatus,
                ) && (
                  <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
                    <button
                      type="button"
                      onClick={() => openStatusModal("Closed")}
                      className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[14px] font-semibold text-emerald-700"
                    >
                      Close case
                    </button>

                    <button
                      type="button"
                      onClick={() => openStatusModal("Terminated")}
                      className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-[14px] font-semibold text-red-700"
                    >
                      Terminate case
                    </button>
                  </div>
                )}

              <div className="mt-5">
                {activeTab === "overview" &&
                  (isAdminOverviewOnly ? (
                    <AdminOverviewTab
                      caseRecord={caseRecord}
                      canManageTemporaryAccess={
                        canManageTemporaryAccess
                      }
                      onGrantTemporaryAccess={
                        openGrantAccessModal
                      }
                      onRevokeTemporaryAccess={
                        openRevokeAccessModal
                      }
                    />
                  ) : (
                    <OverviewTab
                      caseRecord={caseRecord}
                      canManageTemporaryAccess={
                        canManageTemporaryAccess
                      }
                      currentUserTemporaryAccess={
                        currentUserTemporaryAccess
                      }
                      onGrantTemporaryAccess={
                        openGrantAccessModal
                      }
                      onRevokeTemporaryAccess={
                        openRevokeAccessModal
                      }
                    />
                  ))}

                {!isAdminOverviewOnly && activeTab === "assessment" && (
                  <AssessmentTab caseRecord={caseRecord} />
                )}

                {!isAdminOverviewOnly && activeTab === "history" && (
                  <HistoryTab caseRecord={caseRecord} />
                )}

                {!isAdminOverviewOnly && activeTab === "formulation" && (
                  <FormulationTab key={caseRecord._id} caseRecord={caseRecord}
                    canEdit={!caseRecord.isArchived && !["Closed", "Terminated"].includes(caseRecord.caseStatus) && (isAdmin ? isCaseCreator : isAssignedCounselor)}
                    onSaved={record => { setCaseRecord(record); setSuccessMessage("Case formulation saved."); fetchTimeline(); }} />
                )}

                {!isAdminOverviewOnly && activeTab === "interventions" && (
                  <InterventionsTab
                    caseRecord={caseRecord}
                    onOpenWorkspace={() =>
                      navigate(
                        `/intervention-plans?caseId=${caseRecord._id}`,
                      )
                    }
                  />
                )}

                {!isAdminOverviewOnly && activeTab === "progress" && (
                  <ProgressTab
                    caseRecord={caseRecord}
                    onOpenWorkspace={() =>
                      navigate(
                        `/progress-notes?caseId=${caseRecord._id}`,
                      )
                    }
                  />
                )}

                {activeTab === "timeline" && (
                  <TimelineTab
                    timeline={timeline}
                    isLoading={isTimelineLoading}
                    onRefresh={fetchTimeline}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {statusModalOpen && caseRecord && (
        <CaseStatusModal
          caseRecord={caseRecord}
          action={statusAction}
          remarks={statusRemarks}
          setRemarks={setStatusRemarks}
          error={statusError}
          saving={isUpdatingStatus}
          onClose={closeStatusModal}
          onSubmit={submitCaseStatus}
        />
      )}

      {grantAccessModalOpen && caseRecord && (
        <GrantTemporaryAccessModal
          caseRecord={caseRecord}
          counselors={counselors}
          loadingCounselors={isLoadingCounselors}
          form={grantAccessForm}
          setForm={setGrantAccessForm}
          error={grantAccessError}
          saving={isGrantingAccess}
          onClose={closeGrantAccessModal}
          onSubmit={submitGrantTemporaryAccess}
        />
      )}

      {revokeAccessModalOpen && caseRecord && selectedAccessRecord && (
        <RevokeTemporaryAccessModal
          caseRecord={caseRecord}
          accessRecord={selectedAccessRecord}
          reason={revocationReason}
          setReason={setRevocationReason}
          error={revokeAccessError}
          saving={isRevokingAccess}
          onClose={closeRevokeAccessModal}
          onSubmit={submitRevokeTemporaryAccess}
        />
      )}
    </div>
  );
}

function TemporaryAccessSection({ caseRecord, canManage, currentUserAccess, onGrant, onRevoke }) {
  const accessRecords = [...(caseRecord.temporaryCounselor || [])].sort(
    (a, b) => new Date(b.grantedAt || 0) - new Date(a.grantedAt || 0),
  );

  return (
    <SectionCard
      title="Temporary counselor access"
      action={canManage ? (
        <button type="button" onClick={onGrant} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 !text-[15px] font-semibold text-white hover:bg-[#701013]">
          <Icon name="plus" className="h-3 w-3" />
          Grant access
        </button>
      ) : null}
    >
      {currentUserAccess && !canManage && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-[14px] font-semibold text-blue-700">You currently have temporary access</p>
          <p className="mt-1 text-[14px] leading-4 text-blue-700">Access expires on {formatDateTime(currentUserAccess.accessUntil)}.</p>
        </div>
      )}

      {accessRecords.length ? (
        <div className="space-y-3">
          {accessRecords.map((access) => {
            const status = getTemporaryAccessStatus(access);
            return (
              <article key={access._id} className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold">{formatPersonName(access.counselor)}</p>
                      <TemporaryAccessBadge status={status} />
                    </div>
                    <p className="mt-1 break-all text-[13px] text-[#958D88]">{access.counselor?.email || "No email"}</p>
                  </div>
                  {canManage && status === "Active" && (
                    <button type="button" onClick={() => onRevoke(access)} className="h-8 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 !text-[15px] font-semibold text-red-700 hover:bg-red-100">
                      Revoke access
                    </button>
                  )}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <DetailItem label="Granted by" value={formatPersonName(access.grantedBy)} />
                  <DetailItem label="Granted at" value={formatDateTime(access.grantedAt)} />
                  <DetailItem label="Access until" value={formatDateTime(access.accessUntil)} />
                  <DetailItem label="Status" value={status} />
                </div>

                <LongText label="Reason" value={access.reason} />

                {status === "Revoked" && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-[13px] font-semibold text-red-700">Revoked by {formatPersonName(access.revokedBy)} on {formatDateTime(access.revokedAt)}</p>
                    <p className="mt-1 text-[14px] leading-4 text-red-700">{access.revocationReason || "No revocation reason recorded."}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyInline title="No temporary access records" message="Grant temporary access when another counselor needs limited access to this case." />
      )}
    </SectionCard>
  );
}

function GrantTemporaryAccessModal({ caseRecord, counselors, loadingCounselors, form, setForm, error, saving, onClose, onSubmit }) {
  useModalLock(true, saving, onClose);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" onClick={() => { if (!saving) onClose(); }} aria-label="Close grant temporary access modal" />
      <section role="dialog" aria-modal="true" className="relative z-10 w-full max-w-[620px] overflow-hidden rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">Grant temporary access</h2>
            <p className="mt-1 text-[14px] text-[#938B86]">{caseRecord.caseNumber} · {formatPersonName(caseRecord.student)}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid h-8 w-8 place-items-center rounded-lg text-[#8C847F] hover:bg-[#F4F1EF] disabled:opacity-40" aria-label="Close">
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="p-5">
          {error && <Alert tone="error" message={error} />}
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-[14px] font-semibold text-blue-700">Limited case access</p>
            <p className="mt-1 text-[13px] leading-4 text-blue-700">The assigned counselor remains unchanged. Access ends automatically at the selected date and time, or earlier when revoked.</p>
          </div>

          <label className="mt-4 block">
            <span className="text-[14px] font-semibold text-[#4B4541]">Temporary counselor<span className="ml-1 text-red-600">*</span></span>
            <select required value={form.temporaryCounselor} onChange={(event) => update("temporaryCounselor", event.target.value)} disabled={loadingCounselors || saving} className={modalInputClass}>
              <option value="">{loadingCounselors ? "Loading counselors..." : "Select an active counselor"}</option>
              {counselors.map((counselor) => (
                <option key={counselor._id || counselor.id} value={counselor._id || counselor.id}>
                  {formatPersonName(counselor)} - {counselor.role}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[14px] font-semibold text-[#4B4541]">Access until date<span className="ml-1 text-red-600">*</span></span>
              <input type="date" required min={getTodayInputValue()} value={form.accessUntilDate} onChange={(event) => update("accessUntilDate", event.target.value)} className={modalInputClass} />
            </label>
            <label className="block">
              <span className="text-[14px] font-semibold text-[#4B4541]">Access until time<span className="ml-1 text-red-600">*</span></span>
              <input type="time" required value={form.accessUntilTime} onChange={(event) => update("accessUntilTime", event.target.value)} className={modalInputClass} />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-[14px] font-semibold text-[#4B4541]">Reason for access<span className="ml-1 text-red-600">*</span></span>
            <textarea required value={form.reason} onChange={(event) => update("reason", event.target.value)} rows={4} placeholder="Example: Assigned counselor is on leave and another counselor must conduct the scheduled follow-up." className={modalTextareaClass} />
          </label>

          <div className="mt-5 flex justify-end gap-2 border-t border-[#ECE8E5] pt-4">
            <button type="button" onClick={onClose} disabled={saving} className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[14px] font-medium text-[#5E5753] disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={saving || loadingCounselors || !form.temporaryCounselor || !form.accessUntilDate || !form.reason.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 text-[14px] font-semibold text-white hover:bg-[#701013] disabled:opacity-50">
              {saving && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {saving ? "Granting..." : "Grant access"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RevokeTemporaryAccessModal({ caseRecord, accessRecord, reason, setReason, error, saving, onClose, onSubmit }) {
  useModalLock(true, saving, onClose);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" onClick={() => { if (!saving) onClose(); }} aria-label="Close revoke temporary access modal" />
      <section role="dialog" aria-modal="true" className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">Revoke temporary access</h2>
            <p className="mt-1 text-[14px] text-[#938B86]">{formatPersonName(accessRecord.counselor)} · {caseRecord.caseNumber}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid h-8 w-8 place-items-center rounded-lg text-[#8C847F] hover:bg-[#F4F1EF] disabled:opacity-40" aria-label="Close">
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="p-5">
          {error && <Alert tone="error" message={error} />}
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-[14px] font-semibold text-red-700">Access will end immediately</p>
            <p className="mt-1 text-[13px] leading-4 text-red-700">The counselor will lose temporary case access immediately. The record remains in the case history for auditing.</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailItem label="Counselor" value={formatPersonName(accessRecord.counselor)} />
            <DetailItem label="Original expiration" value={formatDateTime(accessRecord.accessUntil)} />
          </div>

          <label className="mt-4 block">
            <span className="text-[14px] font-semibold text-[#4B4541]">Revocation reason<span className="ml-1 text-red-600">*</span></span>
            <textarea required value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Explain why this temporary access is being removed." className={modalTextareaClass} />
          </label>

          <div className="mt-5 flex justify-end gap-2 border-t border-[#ECE8E5] pt-4">
            <button type="button" onClick={onClose} disabled={saving} className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[14px] font-medium text-[#5E5753] disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={saving || !reason.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {saving && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {saving ? "Revoking..." : "Revoke access"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function useModalLock(open, saving, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, saving, onClose]);
}

function CaseStatusModal({
  caseRecord,
  action,
  remarks,
  setRemarks,
  error,
  saving,
  onClose,
  onSubmit,
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [saving, onClose]);

  const closing = action === "Closed";

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close status modal"
      />

      <section
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">
              {closing ? "Close case" : "Terminate case"}
            </h2>
            <p className="mt-1 text-[14px] text-[#938B86]">
              {caseRecord.caseNumber} · {formatPersonName(caseRecord.student)}
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

        <form onSubmit={onSubmit} className="p-5">
          {error && <Alert tone="error" message={error} />}

          <div className={`rounded-xl border px-4 py-3 ${closing ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <p className={`text-[14px] font-semibold ${closing ? "text-emerald-700" : "text-red-700"}`}>
              {closing
                ? "Use this when counseling goals were completed or the case was resolved."
                : "Use this when counseling ended before normal completion."}
            </p>
            <p className={`mt-1 text-[13px] leading-4 ${closing ? "text-emerald-700" : "text-red-700"}`}>
              New progress notes and intervention-plan actions will be blocked after this update.
            </p>
          </div>

          <label className="mt-4 block">
            <span className="text-[14px] font-semibold text-[#4B4541]">
              {closing ? "Closing remarks" : "Termination reason"}
              <span className="ml-1 text-red-600">*</span>
            </span>

            <textarea
              required
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={5}
              placeholder={
                closing
                  ? "Describe the counseling outcome and reason for closing the case."
                  : "Explain why counseling services are being terminated."
              }
              className="mt-2 w-full resize-y rounded-lg border border-[#DDD8D4] bg-white px-3 py-2 text-[14px] leading-4 text-[#302B28] outline-none focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]"
            />
          </label>

          <div className="mt-5 flex justify-end gap-2 border-t border-[#ECE8E5] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[14px] font-medium text-[#5E5753] disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !remarks.trim()}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[14px] font-semibold text-white disabled:opacity-50 ${closing ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              {saving && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {saving ? "Saving..." : closing ? "Close case" : "Terminate case"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CaseHero({
  caseRecord,
  studentName,
  assignedCounselorName,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
              {studentName || "Unknown student"}
            </h2>

            <CaseStatusBadge status={caseRecord.caseStatus} />
            <PriorityBadge priority={caseRecord.priorityLevel} />
          </div>

          <p className="mt-2 text-[14px] text-[#8F8782]">
            {caseRecord.caseNumber} ·{" "}
            {caseRecord.student?.studentIdNumber || "No student ID"}
          </p>

          <p className="mt-1 text-[14px] text-[#8F8782]">
            Assigned counselor: {assignedCounselorName || "Not assigned"}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[430px]">
          <MiniStat
            label="Date opened"
            value={formatDate(caseRecord.dateOpened)}
          />

          <MiniStat
            label="Main domain"
            value={caseRecord.problemAssessment?.mainDomain || "—"}
          />

          <MiniStat
            label="Progress notes"
            value={String(caseRecord.progressNotes?.length || 0)}
          />
        </div>
      </div>
    </section>
  );
}


function AdminOverviewTab({
  caseRecord,
  canManageTemporaryAccess,
  onGrantTemporaryAccess,
  onRevokeTemporaryAccess,
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
            <Icon name="eye" className="h-3.5 w-3.5" />
          </div>

          <div>
            <p className="text-[14px] font-semibold text-blue-800">
              Administrative overview
            </p>
            <p className="mt-1 text-[13px] leading-4 text-blue-700">
              Administrators can review the case overview and activity
              timeline. Clinical assessment, psychosocial background,
              formulation, intervention plans, and progress notes are
              restricted to counselors directly involved in the case.
            </p>
          </div>
        </div>
      </div>

      <SectionCard title="Case overview">
        <DetailGrid>
          <DetailItem
            label="Case number"
            value={caseRecord.caseNumber}
          />
          <DetailItem
            label="Student"
            value={formatPersonName(caseRecord.student)}
          />
          <DetailItem
            label="Student ID"
            value={caseRecord.student?.studentIdNumber}
          />
          <DetailItem
            label="College"
            value={caseRecord.student?.college}
          />
          <DetailItem
            label="Program"
            value={caseRecord.student?.program}
          />
          <DetailItem
            label="Year level"
            value={caseRecord.student?.yearLevel}
          />
          <DetailItem
            label="Assigned counselor"
            value={formatPersonName(
              caseRecord.assignedCounselor,
            )}
          />
          <DetailItem
            label="Date opened"
            value={formatDate(caseRecord.dateOpened)}
          />
          <DetailItem
            label="Case status"
            value={caseRecord.caseStatus}
          />
          <DetailItem
            label="Priority level"
            value={caseRecord.priorityLevel}
          />
          <DetailItem
            label="Main domain"
            value={
              caseRecord.problemAssessment?.mainDomain
            }
          />
          <DetailItem
            label="Last updated"
            value={formatDateTime(caseRecord.updatedAt)}
          />
          <DetailItem
            label="Date closed"
            value={formatDate(caseRecord.dateClosed)}
          />
        </DetailGrid>
      </SectionCard>

      <TemporaryAccessSection
        caseRecord={caseRecord}
        canManage={canManageTemporaryAccess}
        currentUserAccess={null}
        onGrant={onGrantTemporaryAccess}
        onRevoke={onRevokeTemporaryAccess}
      />
    </div>
  );
}

function OverviewTab({
  caseRecord,
  canManageTemporaryAccess,
  currentUserTemporaryAccess,
  onGrantTemporaryAccess,
  onRevokeTemporaryAccess,
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <SectionCard title="Student information">
          <DetailGrid>
            <DetailItem
              label="Student ID"
              value={caseRecord.student?.studentIdNumber}
            />
            <DetailItem
              label="Email"
              value={caseRecord.student?.email}
            />
            <DetailItem
              label="Contact number"
              value={caseRecord.student?.contactNumber}
            />
            <DetailItem
              label="College"
              value={caseRecord.student?.college}
            />
            <DetailItem
              label="Program"
              value={caseRecord.student?.program}
            />
            <DetailItem
              label="Year level"
              value={caseRecord.student?.yearLevel}
            />
          </DetailGrid>
        </SectionCard>

        <SectionCard title="Referral information">
          <DetailGrid>
            <DetailItem
              label="Referral source"
              value={caseRecord.referralInformation?.referralSource}
            />
            <DetailItem
              label="Referred by"
              value={caseRecord.referralInformation?.referredBy}
            />
            <DetailItem
              label="Date referred"
              value={formatDate(
                caseRecord.referralInformation?.dateReferred,
              )}
            />
          </DetailGrid>

          <LongText
            label="Referral question"
            value={caseRecord.referralInformation?.referralQuestion}
          />
        </SectionCard>

        <SectionCard title="Current presentation">
          <LongText
            label="Narrative description"
            value={caseRecord.currentPresentation?.narrativeDescription}
          />

          <LongText
            label="Behavioral observations"
            value={caseRecord.currentPresentation?.behavioralObservations}
          />

          <DetailGrid>
            <DetailItem
              label="Onset"
              value={caseRecord.currentPresentation?.onset}
            />
            <DetailItem
              label="Duration"
              value={caseRecord.currentPresentation?.duration}
            />
            <DetailItem
              label="Frequency"
              value={caseRecord.currentPresentation?.frequency}
            />
            <DetailItem
              label="Intensity"
              value={caseRecord.currentPresentation?.intensity}
            />
          </DetailGrid>
        </SectionCard>

        <TemporaryAccessSection
          caseRecord={caseRecord}
          canManage={canManageTemporaryAccess}
          currentUserAccess={currentUserTemporaryAccess}
          onGrant={onGrantTemporaryAccess}
          onRevoke={onRevokeTemporaryAccess}
        />
      </div>

      <aside className="space-y-5">
        <SectionCard title="Consent">
          <ConsentRow
            label="Counseling consent"
            accepted={caseRecord.consent?.hasConsent}
          />
          <ConsentRow
            label="Confidentiality agreement"
            accepted={
              caseRecord.consent?.confidentialityAgreementAccepted
            }
          />
          <ConsentRow
            label="Data privacy notice"
            accepted={caseRecord.consent?.dataPrivacyNoticeAccepted}
          />

          <DetailItem
            label="Consent date"
            value={formatDate(caseRecord.consent?.consentDate)}
          />
        </SectionCard>

        <SectionCard title="Case management">
          <DetailItem
            label="Case status"
            value={caseRecord.caseStatus}
          />
          <DetailItem
            label="Priority level"
            value={caseRecord.priorityLevel}
          />
          <DetailItem
            label="Last updated"
            value={formatDateTime(caseRecord.updatedAt)}
          />
          <DetailItem
            label="Date closed"
            value={formatDate(caseRecord.dateClosed)}
          />
        </SectionCard>
      </aside>
    </div>
  );
}

function AssessmentTab({ caseRecord }) {
  return (
    <div className="space-y-5">
      <SectionCard title="Problem assessment">
        <DetailItem
          label="Main domain"
          value={caseRecord.problemAssessment?.mainDomain}
        />

        <StringList
          label="Primary problems"
          values={caseRecord.problemAssessment?.primaryProblems}
        />

        <StringList
          label="Secondary problems"
          values={caseRecord.problemAssessment?.secondaryProblems}
        />
      </SectionCard>

      <SectionCard title="Mental status">
        <div className="space-y-6">
          {[
            ["Appearance (observed)", ["grooming", "attire", "physicalPresentation"]],
            ["Behaviour (observed)", ["eyeContact", "activityLevel"]],
            ["Speech (observed)", ["speechRate", "speechVolume", "speechFluency", "speechArticulation", "speech"]],
            ["Other mental-status observations", ["moodAndAffect", "thoughtProcess", "orientation", "attentionAndConcentration", "riskIndicators"]],
          ].map(([title, fields]) => (
            <section key={title}>
              <h4 className="border-b border-[#ECE8E5] pb-2 text-[15px] font-semibold text-[#403A36]">
                {title}
              </h4>
              <div className="mt-3 grid gap-x-6 gap-y-4 md:grid-cols-2">
                {fields.map((field) => (
                  <div key={field} className="min-w-0 break-words">
                    <LongText
                      label={field === "speech" ? "General speech notes" : humanizeKey(field)}
                      value={caseRecord.mentalStatus?.[field] || "Not recorded"}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function HistoryTab({ caseRecord }) {
  const history = caseRecord.backgroundAndPsychosocialHistory || {};

  return (
    <div className="space-y-5">
      <SectionCard title="Psychosocial background">
        <div className="grid gap-4 md:grid-cols-2">
          <LongText label="Family context" value={history.familyContext} />
          <LongText
            label="Academic context"
            value={history.academicContext}
          />
          <LongText
            label="Peer and social context"
            value={history.peerSocialContext}
          />
          <LongText
            label="Family constellation comments"
            value={history.familyConstellationComments}
          />
        </div>
      </SectionCard>

      <SectionCard title="Family constellation">
        {history.familyConstellation?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {[
                    "Name",
                    "Age",
                    "Relationship",
                    "Parent type",
                    "Significant",
                    "Remarks",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border-b border-[#E8E3E0] px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8F8782]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {history.familyConstellation.map((member) => (
                  <tr key={member._id || `${member.name}-${member.age}`}>
                    <td className={tableCellClass}>{member.name || "—"}</td>
                    <td className={tableCellClass}>{member.age ?? "—"}</td>
                    <td className={tableCellClass}>
                      {member.relationship || "—"}
                    </td>
                    <td className={tableCellClass}>
                      {member.parentType || "—"}
                    </td>
                    <td className={tableCellClass}>
                      {member.isSignificantPerson ? "Yes" : "No"}
                    </td>
                    <td className={tableCellClass}>
                      {member.remarks || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <MutedText>No family members were recorded.</MutedText>
        )}
      </SectionCard>

      <SectionCard title="Relevant history">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["psychiatricCareHistory", "Psychiatric care history"],
            ["psychologicalTherapyHistory", "Psychological therapy history"],
            ["previousCounselingHistory", "Previous counseling history"],
            ["medicalHistory", "Medical history"],
            ["familyMentalHealthHistory", "Family mental-health history"],
            ["substanceUseHistory", "Substance-use history"],
            ["legalHistory", "Legal history"],
          ].map(([key, label]) => (
            <HistorySummary
              key={key}
              label={label}
              value={history[key]}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function FormulationTab({ caseRecord, canEdit, onSaved }) {
  const formulation = caseRecord.caseFormulation || {};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const fields = [["presentingProblem", "Problem summary"], ["formulationNarrative", "Formulation narrative"], ["counselorAssessment", "Counselor assessment"]];
  const latestRecommendation = [...(caseRecord.llmRecommendations || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
  const beginEdit = () => {
    setDraft({ presentingProblem: formulation.presentingProblem || "",
      formulationNarrative: formulation.formulationNarrative || "", counselorAssessment: formulation.counselorAssessment || "" });
    setError(""); setAiDraft(null); setEditing(true);
  };
  const generateSummary = async () => {
    setGenerating(true); setError('');
    try {
      const data = await apiRequest(`/cases/${caseRecord._id}/formulation/summary`, { method: 'POST' });
      setAiDraft(data.draft);
    } catch (failure) { setError(failure.message || 'Unable to generate summary.'); }
    finally { setGenerating(false); }
  };
  const save = async event => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const data = await apiRequest(`/cases/${caseRecord._id}`, { method: 'PATCH', body: JSON.stringify({ caseFormulation: Object.fromEntries(fields.map(([field]) => [field, (draft[field] || '').trim()])) }) });
      if (!data.case) throw new Error('The updated case could not be loaded. Refresh to check the saved formulation.');
      onSaved(data.case); setEditing(false);
    } catch (failure) { setError(failure.message || 'Unable to save formulation.'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-5">
    <SectionCard title="Case formulation" action={canEdit && !editing ? <button type="button" onClick={beginEdit} className="rounded-lg bg-[#8C1518] px-4 py-2 text-sm font-semibold text-white">{fields.some(([field]) => formulation[field]) ? 'Edit formulation' : 'Add formulation'}</button> : null}>
      <p className="mb-4 text-sm leading-6 text-[#8D8580]">Record the counselor’s understanding of the presenting concerns, relevant context, and assessment.</p>
      {error && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {editing ? <form onSubmit={save} className="space-y-4">
        <div className="rounded-lg border border-[#E7E2DF] bg-[#FCFBFA] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Generate formulation drafts</p><p className="mt-1 text-xs leading-5 text-[#827A76]">Problem summary uses Problem Assessment. Formulation narrative summarizes Mental Status. The proposed counselor assessment brings together those sections and Current Presentation.</p></div><button type="button" disabled={generating || saving} onClick={generateSummary} className="shrink-0 rounded-lg border border-[#DDD8D4] bg-white px-3 py-2 text-sm font-semibold text-[#8C1518] disabled:opacity-50">{generating ? 'Generating…' : 'Generate AI drafts'}</button></div>
          {aiDraft && <div className="mt-4 border-t border-[#E7E2DF] pt-3"><p className="mb-2 text-xs font-semibold text-[#8C1518]">AI draft — review for accuracy</p><div className="space-y-3">{fields.map(([field, label]) => <div key={field}><p className="text-xs font-semibold text-[#827A76]">{label}{field === 'counselorAssessment' ? ' (AI-proposed)' : ''}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-7">{aiDraft[field] || 'Insufficient recorded information for this field.'}</p></div>)}</div><div className="mt-3 flex gap-2"><button type="button" disabled={saving || generating} onClick={() => { setDraft(current => ({ ...current, ...Object.fromEntries(fields.filter(([field]) => aiDraft[field]?.trim()).map(([field]) => [field, aiDraft[field]])) })); setAiDraft(null); }} className="rounded-lg bg-[#8C1518] px-3 py-2 text-sm font-semibold text-white">Use drafts</button><button type="button" onClick={() => setAiDraft(null)} className="rounded-lg border px-3 py-2 text-sm">Discard</button></div></div>}
        </div>
        {fields.map(([field, label]) => <label key={field} className="block"><span className="text-sm font-semibold">{label}</span><textarea rows={field === 'formulationNarrative' ? 6 : 4} disabled={saving} value={draft[field] || ''} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} className="mt-2 w-full rounded-lg border border-[#DDD8D4] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#8C1518] disabled:opacity-60" /></label>)}
        <div className="flex justify-end gap-2"><button type="button" disabled={saving || generating} onClick={() => { setEditing(false); setError(''); }} className="rounded-lg border border-[#DDD8D4] px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={saving || generating} className="rounded-lg bg-[#8C1518] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save formulation'}</button></div>
      </form> : <div className="space-y-5">{fields.map(([field, label]) => <LongText key={field} label={label} value={formulation[field] || 'Not recorded yet'} />)}</div>}
      {!canEdit && <p className="mt-4 text-xs text-[#8D8580]">Formulation editing is available to the authorized counselor while the case is active.</p>}
    </SectionCard>
    {formulation.aiSummary && <SectionCard title="Previously recorded AI summary"><LongText label="AI summary" value={formulation.aiSummary} /></SectionCard>}
    <SectionCard title="AI intervention recommendation context">
      <p className="mb-4 text-sm leading-6 text-[#8D8580]">AI generates intervention recommendations separately. The formulation above may use AI drafts and remains subject to counselor review.</p>
      {latestRecommendation ? <div className="space-y-4"><LongText label="Latest recommendation concern summary" value={latestRecommendation.concernSummary} /><LongText label="Recommendation rationale" value={latestRecommendation.rationale} /></div> : <p className="text-sm text-[#8D8580]">No intervention recommendation has been generated for this case yet.</p>}
    </SectionCard>
  </div>;
}

function InterventionsTab({ caseRecord, onOpenWorkspace }) {
  const plans = caseRecord.interventionPlans || [];

  return (
    <SectionCard
      title="Intervention plans"
      action={
        <button
          type="button"
          onClick={onOpenWorkspace}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 text-[14px] font-semibold text-white hover:bg-[#701013]"
        >
          Open intervention workspace
        </button>
      }
    >
      {plans.length ? (
        <div className="space-y-3">
          {plans.map((plan) => (
            <article
              key={plan._id}
              className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <ApprovalBadge status={plan.approvalStatus} />
                <PlanStatusBadge status={plan.status} />

                {plan.isSentToStudent && (
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[13px] font-medium text-blue-700">
                    Sent to student
                  </span>
                )}
              </div>

              <h4 className="mt-3 whitespace-pre-wrap break-words text-justify text-[15px] font-semibold leading-6">
                {plan.problem}
              </h4>

              <LongText label="Goal" value={plan.goal} />
              <LongText
                label="Plan of action"
                value={plan.planOfAction}
              />
              <LongText
                label="Follow-up plan"
                value={plan.followUpPlan}
              />

              {plan.isSentToStudent && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[14px] font-semibold text-emerald-700">
                    Sent to {plan.sentToEmail || "student email"}
                  </p>
                  <p className="mt-1 text-[13px] text-emerald-600">
                    {formatDateTime(plan.sentAt)}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyInline
          title="No intervention plans yet"
          message="Open the intervention workspace to create a manual plan. LLM recommendations can be added later."
        />
      )}
    </SectionCard>
  );
}

function ProgressTab({ caseRecord, onOpenWorkspace }) {
  const notes = [...(caseRecord.progressNotes || [])].sort(
    (a, b) =>
      new Date(b.noteDate || b.createdAt) -
      new Date(a.noteDate || a.createdAt),
  );

  return (
    <SectionCard
      title="Progress notes"
      action={
        <button
          type="button"
          onClick={onOpenWorkspace}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 text-[14px] font-semibold text-white hover:bg-[#701013]"
        >
          Open progress workspace
        </button>
      }
    >
      {notes.length ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <article
              key={note._id}
              className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ProgressBadge status={note.progressStatus} />
                <span className="text-[13px] text-[#958D88]">
                  {formatDateTime(note.noteDate || note.createdAt)}
                </span>
              </div>

              <LongText
                label="Progress summary"
                value={note.progressSummary}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <LongText label="Action taken" value={note.actionTaken} />
                <LongText
                  label="New plan of action"
                  value={note.newPlanOfAction}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyInline
          title="No progress notes yet"
          message="Progress notes are added after counseling or follow-up sessions."
        />
      )}
    </SectionCard>
  );
}

function TimelineTab({ timeline, isLoading, onRefresh }) {
  return (
    <SectionCard
      title="Case timeline"
      action={
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8 rounded-lg border border-[#D9D2CE] bg-white px-3 text-[14px] font-semibold text-[#5F5854] hover:border-[#8C1518] hover:text-[#8C1518] disabled:opacity-40"
        >
          Refresh
        </button>
      }
    >
      {isLoading ? (
        <LoadingInline />
      ) : timeline.length ? (
        <div className="relative space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-[#E2DDDA]">
          {timeline.map((event, index) => (
            <article
              key={`${event.type}-${event.date}-${index}`}
              className="relative pl-9"
            >
              <span className="absolute left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#8C1518] shadow" />

              <div className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold">
                      {event.title || event.type}
                    </p>
                    <p className="mt-1 text-[13px] text-[#958D88]">
                      {event.type}
                    </p>
                  </div>

                  <span className="text-[13px] text-[#958D88]">
                    {formatDateTime(event.date)}
                  </span>
                </div>

                {event.description && (
                  <p className="mt-3 whitespace-pre-wrap break-words text-justify text-[14px] leading-6 text-[#514A46]">
                    {event.description}
                  </p>
                )}

                <p className="mt-3 text-[13px] text-[#958D88]">
                  Performed by: {formatPersonName(event.performedBy)}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyInline
          title="No timeline events"
          message="Case activity will appear here as the record is updated."
        />
      )}
    </SectionCard>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[#ECE8E5] px-4 py-3.5 sm:px-5">
        <h3 className="text-[17px] font-semibold">{title}</h3>
        {action}
      </header>

      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function DetailGrid({ children }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-xl border border-[#E8E3E0] bg-[#FCFBFA] p-3">
      <p className="text-[13px] text-[#958D88]">{label}</p>
      <p className="mt-1 break-words text-[14px] font-semibold leading-4 text-[#4E4844]">
        {value || "—"}
      </p>
    </div>
  );
}

function LongText({ label, value }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p className="mt-1 whitespace-pre-wrap break-words text-justify text-[14px] leading-6 text-[#4F4945]">
        {value || "—"}
      </p>
    </div>
  );
}

function StringList({ label, values }) {
  return (
    <div className="mt-4">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      {values?.length ? (
        <ul className="mt-2 space-y-2">
          {values.map((value, index) => (
            <li
              key={`${value}-${index}`}
              className="rounded-lg border border-[#E8E3E0] bg-[#FCFBFA] px-3 py-2 break-words text-justify text-[14px] leading-6 text-[#4F4945]"
            >
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <MutedText>No information recorded.</MutedText>
      )}
    </div>
  );
}

function HistorySummary({ label, value }) {
  return (
    <article className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-semibold">{label}</p>

        <span
          className={`rounded-full px-2 py-1 text-[13px] font-medium ${
            value?.hasHistory
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {value?.hasHistory ? "Recorded" : "None"}
        </span>
      </div>

      {value?.hasHistory && (
        <p className="mt-2 whitespace-pre-wrap break-words text-justify text-[14px] leading-6 text-[#5A534F]">
          {value.description || "No description recorded."}
        </p>
      )}
    </article>
  );
}

function ConsentRow({ label, accepted }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-[#E8E3E0] bg-[#FCFBFA] px-3 py-2">
      <span className="text-[14px] text-[#514A46]">{label}</span>

      <span
        className={`rounded-full px-2 py-1 text-[13px] font-medium ${
          accepted
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
        }`}
      >
        {accepted ? "Accepted" : "Not accepted"}
      </span>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-[#E8E3E0] bg-[#FCFBFA] px-3 py-2.5">
      <p className="text-[13px] text-[#958D88]">{label}</p>
      <p className="mt-1 truncate text-[14px] font-semibold text-[#4E4844]">
        {value || "—"}
      </p>
    </div>
  );
}

function EmptyInline({ title, message }) {
  return (
    <div className="rounded-xl border border-dashed border-[#D8D1CD] bg-[#FAF9F8] px-4 py-8 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mt-1 text-[13px] leading-4 text-[#8D8580]">
        {message}
      </p>
    </div>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="grid min-h-[520px] place-items-center text-center">
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
    <div className="grid min-h-[520px] place-items-center">
      <div className="text-center">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />
        <p className="mt-3 text-[14px] text-[#827B77]">
          Loading case details...
        </p>
      </div>
    </div>
  );
}

function LoadingInline() {
  return (
    <div className="grid min-h-[240px] place-items-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />
    </div>
  );
}

function MutedText({ children }) {
  return (
    <p className="mt-2 text-[14px] leading-4 text-[#958D88]">
      {children}
    </p>
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
      className={`rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[status] || "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    Low: "bg-emerald-50 text-emerald-700",
    Moderate: "bg-amber-50 text-amber-700",
    High: "bg-orange-50 text-orange-700",
    Urgent: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[priority] || "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {priority || "Moderate"}
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

function ProgressBadge({ status }) {
  const styles = {
    Improved: "bg-emerald-50 text-emerald-700",
    "No Progress": "bg-slate-100 text-slate-700",
    Worsened: "bg-red-50 text-red-700",
    "Needs Follow-up": "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-[13px] font-medium ${
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

function formatPersonName(person) {
  if (!person) return "Unknown";

  if (typeof person === "string") {
    return "User";
  }

  return [person.firstName, person.lastName]
    .filter(Boolean)
    .join(" ");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function humanizeKey(value) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}

function TemporaryAccessBadge({ status }) {
  const styles = {
    Active: "bg-emerald-50 text-emerald-700",
    Expired: "bg-amber-50 text-amber-700",
    Revoked: "bg-red-50 text-red-700",
    Inactive: "bg-slate-100 text-slate-700",
  };
  return <span className={`rounded-full px-2 py-1 text-[13px] font-medium ${styles[status] || styles.Inactive}`}>{status}</span>;
}

function getTemporaryAccessStatus(access) {
  if (access.revokedAt) return "Revoked";
  if (access.isActive !== true) return "Inactive";
  const accessUntil = new Date(access.accessUntil);
  if (Number.isNaN(accessUntil.getTime()) || accessUntil <= new Date()) return "Expired";
  return "Active";
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue) return "";
  const combined = new Date(`${dateValue}T${timeValue || "17:00"}:00`);
  return Number.isNaN(combined.getTime()) ? "" : combined.toISOString();
}

function getTodayInputValue() {
  const today = new Date();
  const pad = (number) => String(number).padStart(2, "0");
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

const modalInputClass =
  "mt-2 h-9 w-full rounded-lg border border-[#DDD8D4] bg-white px-3 text-[14px] text-[#302B28] outline-none focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06] disabled:bg-[#F5F2F0] disabled:text-[#8C847F]";

const modalTextareaClass =
  "mt-2 w-full resize-y rounded-lg border border-[#DDD8D4] bg-white px-3 py-2 text-[14px] leading-4 text-[#302B28] outline-none focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";

const tableCellClass =
  "border-b border-[#EEEAE7] px-3 py-2 text-[14px] leading-4 text-[#4F4945]";