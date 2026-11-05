import { clickableRecordProps } from "../utils/clickableRecord";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";

const ACTION_OPTIONS = [
  "Created",
  "Assigned",
  "Reassigned",
  "Updated",
  "Follow-up",
  "Closed",
  "Reopened",
  "Archived",
  "Restored",
  "Terminated",
];

const PERIOD_OPTIONS = [
  {
    value: "7-days",
    label: "Last 7 days",
  },
  {
    value: "30-days",
    label: "Last 30 days",
  },
  {
    value: "90-days",
    label: "Last 90 days",
  },
  {
    value: "current-year",
    label: "Current year",
  },
  {
    value: "all-time",
    label: "All time",
  },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function ActivityLogPage() {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [cases, setCases] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [pageError, setPageError] = useState("");

  const [searchInput, setSearchInput] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [period, setPeriod] = useState("30-days");

  const [actionFilter, setActionFilter] = useState("");

  const [actorFilter, setActorFilter] = useState("");

  const [caseStatusFilter, setCaseStatusFilter] = useState("");

  const [includeArchived, setIncludeArchived] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);

  const [pageSize, setPageSize] = useState(20);

  const [selectedLog, setSelectedLog] = useState(null);

  const isAdmin = user?.role === ADMIN_ROLE;

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
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const handleUnauthorized = useCallback(() => {
    clearUser();

    navigate("/login", {
      replace: true,
    });
  }, [clearUser, navigate]);

  const loadActivityLogs = useCallback(async () => {
    if (!user || !isAdmin) {
      return;
    }

    setIsLoading(true);
    setPageError("");

    try {
      const data = await apiRequest("/cases", {
        method: "GET",
      });

      if (!Array.isArray(data)) {
        throw new Error("The backend returned an invalid cases response.");
      }

      setCases(data);
    } catch (error) {
      console.error("Unable to load activity logs:", error);

      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(error.message || "Unable to load activity logs.");
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, handleUnauthorized]);

  useEffect(() => {
    loadActivityLogs();
  }, [loadActivityLogs]);

  const allLogs = useMemo(() => {
    return cases
      .filter((caseRecord) => includeArchived || caseRecord.isArchived !== true)
      .flatMap((caseRecord) => {
        const history = caseRecord.actionHistory || [];

        return history.map((entry, index) => ({
          id: entry._id || `${caseRecord._id}-${index}`,

          action: entry.action || "Updated",

          remarks: entry.remarks || "No remarks recorded.",

          actionDate: entry.actionDate || entry.createdAt || caseRecord.updatedAt,

          actor: entry.actionBy,

          actorId: getRecordId(entry.actionBy),

          actorName: formatName(entry.actionBy) || entry.actionBy?.email || "Unknown user",

          actorRole: entry.actionBy?.role || "Unknown role",

          actorEmail: entry.actionBy?.email || "",

          caseId: caseRecord._id || caseRecord.id,

          caseNumber: caseRecord.caseNumber || "No case number",

          caseStatus: caseRecord.caseStatus || "Unknown",

          priority: caseRecord.priorityLevel || "Not recorded",

          isArchived: caseRecord.isArchived === true,

          studentId: getRecordId(caseRecord.student),

          studentName: formatName(caseRecord.student) || "Unknown student",

          studentIdNumber: caseRecord.student?.studentIdNumber || "Not recorded",

          college: caseRecord.student?.college || "Not recorded",

          program: caseRecord.student?.program || "Not recorded",

          domain: caseRecord.problemAssessment?.mainDomain || "Not recorded",
        }));
      })
      .sort((first, second) => new Date(second.actionDate) - new Date(first.actionDate));
  }, [cases, includeArchived]);

  const actors = useMemo(() => {
    const map = new Map();

    allLogs.forEach((log) => {
      const key = log.actorId || log.actorName;

      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: log.actorName,
          email: log.actorEmail,
        });
      }
    });

    return Array.from(map.values()).sort((first, second) => first.name.localeCompare(second.name));
  }, [allLogs]);

  const filteredLogs = useMemo(() => {
    const startDate = getPeriodStart(period);

    return allLogs.filter((log) => {
      if (startDate) {
        const logDate = new Date(log.actionDate);

        if (!Number.isNaN(logDate.getTime()) && logDate < startDate) {
          return false;
        }
      }

      if (actionFilter && log.action !== actionFilter) {
        return false;
      }

      if (actorFilter && (log.actorId || log.actorName) !== actorFilter) {
        return false;
      }

      if (caseStatusFilter && log.caseStatus !== caseStatusFilter) {
        return false;
      }

      if (searchQuery) {
        const fields = [
          log.caseNumber,
          log.studentName,
          log.studentIdNumber,
          log.actorName,
          log.actorEmail,
          log.action,
          log.remarks,
          log.college,
          log.program,
          log.domain,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        if (!fields.some((value) => value.includes(searchQuery))) {
          return false;
        }
      }

      return true;
    });
  }, [allLogs, period, actionFilter, actorFilter, caseStatusFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [period, actionFilter, actorFilter, caseStatusFilter, includeArchived, searchQuery, pageSize]);

  const summary = useMemo(() => {
    const today = startOfDay(new Date());

    const tomorrow = new Date(today);

    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = allLogs.filter((log) => {
      const date = new Date(log.actionDate);

      return !Number.isNaN(date.getTime()) && date >= today && date < tomorrow;
    }).length;

    const activeActors = new Set(
      filteredLogs.map((log) => log.actorId || log.actorName).filter(Boolean)
    ).size;

    const mostCommonAction = getMostCommonAction(filteredLogs);

    return {
      total: filteredLogs.length,

      today: todayCount,

      activeActors,

      mostCommonAction,
    };
  }, [allLogs, filteredLogs]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const pageStart = (safeCurrentPage - 1) * pageSize;

  const displayedLogs = filteredLogs.slice(pageStart, pageStart + pageSize);

  const hasFilters =
    period !== "30-days" ||
    actionFilter ||
    actorFilter ||
    caseStatusFilter ||
    searchInput ||
    includeArchived !== true;

  const resetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setPeriod("30-days");
    setActionFilter("");
    setActorFilter("");
    setCaseStatusFilter("");
    setIncludeArchived(true);
  };

  const exportCsv = () => {
    if (filteredLogs.length === 0) {
      setPageError("There are no activity logs to export.");

      return;
    }

    const rows = filteredLogs.map((log) => ({
      Date: formatDateTime(log.actionDate),

      Action: log.action,

      User: log.actorName,

      Role: log.actorRole,

      "Case Number": log.caseNumber,

      Student: log.studentName,

      "Student ID": log.studentIdNumber,

      College: log.college,

      Program: log.program,

      Domain: log.domain,

      "Case Status": log.caseStatus,

      Archived: log.isArchived ? "Yes" : "No",

      Remarks: log.remarks,
    }));

    const csv = convertRowsToCsv(rows);

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `activity-log-${formatFileDate(new Date())}.csv`;

    document.body.appendChild(anchor);

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  };

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F6F4] px-5">
        <section className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-red-700">Activity log unavailable</h1>

          <p className="mt-3 text-[15px] text-[#756E69]">
            Only Counselor-Admin accounts can access system activity logs.
          </p>

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-6 rounded-xl bg-[#8C1518] px-5 py-3 text-[15px] font-semibold text-white"
          >
            Return to dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="authenticated-app min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#292522]">
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#E4DFDC] text-[#655E59] lg:hidden"
                aria-label="Open navigation"
              >
                <Icon name="menu" className="h-4 w-4" />
              </button>

              <div>
                <h1 className="text-[20px] font-semibold">Activity Log</h1>

                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  Review administrator and counselor activity across counseling cases
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportCsv}
                disabled={isLoading || filteredLogs.length === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#8C1518] bg-white px-3 text-[13px] font-semibold text-[#8C1518] disabled:opacity-40"
              >
                <Icon name="file" className="h-3 w-3" />
                Export CSV
              </button>

              <button
                type="button"
                onClick={loadActivityLogs}
                disabled={isLoading}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                <Icon name="history" className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <main className="page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7 lg:w-[calc(100%-240px)]! lg:px-0!">
          {pageError && <Alert tone="error" message={pageError} />}

          <section>
            <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
              System activity history
            </h2>

            <p className="mt-1 max-w-[920px] text-[14px] leading-4 text-[#89817D]">
              This page shows case-related activity currently stored in each case’s action history.
              Use it to review who performed an action, when it occurred, which case was affected,
              and what remarks were recorded.
            </p>
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Filtered activities"
              value={summary.total}
              note={getPeriodLabel(period)}
              icon="history"
            />

            <MetricCard
              label="Activities today"
              value={summary.today}
              note="All case activities"
              icon="calendar"
            />

            <MetricCard
              label="Active users"
              value={summary.activeActors}
              note="Within filtered results"
              icon="student"
            />

            <MetricCard
              label="Most common action"
              value={summary.mostCommonAction?.value || 0}
              note={summary.mostCommonAction?.label || "No activity"}
              icon="folder"
            />
          </section>

          <section className="mt-5 rounded-2xl border border-[#E4DFDC] bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <FilterField label="Search">
                <div className="relative">
                  <Icon
                    name="search"
                    className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#AAA29D] "
                  />

                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Case, student, user..."
                    className={`${filterClass} pl-8 !text-[15px]`}
                  />
                </div>
              </FilterField>

              <FilterField label="Period">
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  className={filterClass}
                >
                  {PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Action">
                <select
                  value={actionFilter}
                  onChange={(event) => setActionFilter(event.target.value)}
                  className={filterClass}
                >
                  <option value="">All actions</option>

                  {ACTION_OPTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Performed by">
                <select
                  value={actorFilter}
                  onChange={(event) => setActorFilter(event.target.value)}
                  className={filterClass}
                >
                  <option value="">All users</option>

                  {actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.name}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Case status">
                <select
                  value={caseStatusFilter}
                  onChange={(event) => setCaseStatusFilter(event.target.value)}
                  className={filterClass}
                >
                  <option value="">All statuses</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="For Follow-up">For Follow-up</option>
                  <option value="Closed">Closed</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </FilterField>

              <div className="flex items-end gap-2">
                <label className="flex h-8 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[#DDD8D4] bg-white px-2.5">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(event) => setIncludeArchived(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[#8C1518]"
                  />

                  <span className="text-[13px] font-medium text-[#5D5652]">Include archived</span>
                </label>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[13px] font-semibold text-[#8C1518]"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="mt-5 overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
            <header className="flex flex-col gap-3 border-b border-[#ECE8E5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[17px] font-semibold">Case activity records</h3>

                <p className="mt-1 text-[15px] text-[#99918C]">
                  Showing {filteredLogs.length === 0 ? 0 : pageStart + 1}–
                  {Math.min(pageStart + pageSize, filteredLogs.length)} of {filteredLogs.length}
                </p>
              </div>

              <label className="flex items-center gap-2 text-[15px] text-[#706965]">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-8 rounded-lg border border-[#DDD8D4] bg-white px-2 text-[14px]"
                >
                  {PAGE_SIZE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </header>

            {isLoading ? (
              <LoadingPanel />
            ) : displayedLogs.length === 0 ? (
              <EmptyPanel />
            ) : (
              <ActivityTable
                logs={displayedLogs}
                onOpenCase={(caseId) => navigate(`/cases/${caseId}`)}
                onViewDetails={setSelectedLog}
              />
            )}

            {!isLoading && filteredLogs.length > 0 && (
              <Pagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </section>

          <div className="mt-5 rounded-2xl border border-[#E6D9B7] bg-[#FCF8EB] px-4 py-3">
            <div className="flex items-start gap-3">
              <Icon name="alertTriangle" className="mt-0.5 h-4 w-4 shrink-0 text-[#A77A00]" />

              <div>
                <p className="text-[14px] font-semibold text-[#705A1B]">
                  Current activity-log scope
                </p>

                <p className="mt-1 text-[13px] leading-4 text-[#806E3A]">
                  This version derives records from each case’s actionHistory. It covers case
                  actions such as creation, assignment, updates, follow-ups, closure, archiving, and
                  restoration. Login events, failed authentication, user-account changes, and report
                  exports require a separate system-wide audit log collection.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ActivityDetailsModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onOpenCase={(caseId) => {
          setSelectedLog(null);
          navigate(`/cases/${caseId}`);
        }}
      />
    </div>
  );
}

function ActivityTable({ logs, onOpenCase, onViewDetails }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] table-fixed border-collapse">
        <thead>
          <tr className="border-b border-[#ECE8E5] bg-[#FCFBFA] text-left">
            <th className={`${tableHeadClass} w-[13%]`}>Date and time</th>

            <th className={`${tableHeadClass} w-[10%]`}>Action</th>

            <th className={`${tableHeadClass} w-[13%]`}>Performed by</th>

            <th className={`${tableHeadClass} w-[12%]`}>Case</th>

            <th className={`${tableHeadClass} w-[17%]`}>Student</th>

            <th className={`${tableHeadClass} w-[35%]`}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              {...clickableRecordProps(
                () => onViewDetails(log),
                `Open activity details for ${log.caseNumber}`
              )}
              key={log.id}
              className="clickable-record border-b border-[#F0ECE9] last:border-b-0 hover:bg-[#FCFBFA]"
            >
              <td className={tableCellClass}>
                <p className="text-[15px] font-medium text-[#4F4945]">
                  {formatDate(log.actionDate)}
                </p>

                <p className="mt-0.5 text-[15px] text-[#99918D]">{formatTime(log.actionDate)}</p>
              </td>

              <td className={tableCellClass}>
                <ActionBadge action={log.action} />
              </td>

              <td className={tableCellClass}>
                <p className="max-w-[180px] truncate text-[15px] font-semibold">{log.actorName}</p>

                <p className="mt-0.5 text-[12px] text-[#99918D]">{log.actorRole}</p>
              </td>

              <td className={tableCellClass}>
                <button
                  type="button"
                  onClick={() => onOpenCase(log.caseId)}
                  className="text-left text-[15px] font-semibold text-[#8C1518] hover:underline"
                >
                  {log.caseNumber}
                </button>

                <p className="mt-0.5 text-[12px] text-[#99918D]">
                  {log.caseStatus}
                  {log.isArchived ? " · Archived" : ""}
                </p>
              </td>

              <td className={tableCellClass}>
                <p className="max-w-[190px] truncate text-[15px] font-semibold">
                  {log.studentName}
                </p>

                <p className="mt-0.5 text-[12px] text-[#99918D]">{log.studentIdNumber}</p>
              </td>

              <td className={`${tableCellClass} w-[35%]`}>
                <p className="line-clamp-2 text-[15px] leading-4 text-[#68615D]">{log.remarks}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityDetailsModal({ log, onClose, onOpenCase }) {
  useEffect(() => {
    if (!log) return undefined;

    const oldOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = oldOverflow;

      window.removeEventListener("keydown", onKeyDown);
    };
  }, [log, onClose]);

  if (!log) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="Close activity details"
      />

      <section
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-[700px] overflow-hidden rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-semibold">Activity details</h2>

              <ActionBadge action={log.action} />
            </div>

            <p className="mt-1 text-[13px] text-[#938B86]">{formatDateTime(log.actionDate)}</p>
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

        <div className="max-h-[75vh] overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailCard
              label="Performed by"
              value={log.actorName}
              secondary={log.actorEmail || log.actorRole}
            />

            <DetailCard label="Case" value={log.caseNumber} secondary={log.caseStatus} />

            <DetailCard label="Student" value={log.studentName} secondary={log.studentIdNumber} />

            <DetailCard label="Academic information" value={log.college} secondary={log.program} />

            <DetailCard
              label="Concern domain"
              value={log.domain}
              secondary={`Priority: ${log.priority}`}
            />

            <DetailCard
              label="Record state"
              value={log.isArchived ? "Archived" : "Active record"}
              secondary={log.caseStatus}
            />
          </div>

          <section className="mt-4 rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
              Remarks
            </p>

            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-4 text-[#4F4945]">
              {log.remarks}
            </p>
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#ECE8E5] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[13px] font-semibold text-[#5E5753]"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => onOpenCase(log.caseId)}
            className="h-8 rounded-lg bg-[#8C1518] px-3 text-[13px] font-semibold text-white"
          >
            Open case
          </button>
        </footer>
      </section>
    </div>
  );
}

function MetricCard({ label, value, note, icon }) {
  return (
    <article className="rounded-xl border border-[#E4DFDC] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
          <Icon name={icon} className="h-4 w-4" />
        </div>

        <span className="max-w-[130px] text-right text-[12px] leading-3 text-[#948C87]">
          {note}
        </span>
      </div>

      <p className="mt-3 text-[13px] text-[#8D8580]">{label}</p>

      <p className="mt-1 text-[22px] font-semibold tracking-[-0.04em]">{value}</p>
    </article>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <footer className="flex items-center justify-between border-t border-[#ECE8E5] px-4 py-3">
      <p className="text-[13px] text-[#8C847F]">
        Page {currentPage} of {totalPages}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[13px] font-semibold text-[#5E5753] disabled:opacity-40"
        >
          Previous
        </button>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[13px] font-semibold text-[#5E5753] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </footer>
  );
}

function ActionBadge({ action }) {
  const styles = {
    Created: "bg-emerald-50 text-emerald-700",
    Assigned: "bg-blue-50 text-blue-700",
    Reassigned: "bg-violet-50 text-violet-700",
    Updated: "bg-slate-100 text-slate-700",
    "Follow-up": "bg-amber-50 text-amber-700",
    Closed: "bg-emerald-50 text-emerald-700",
    Reopened: "bg-blue-50 text-blue-700",
    Archived: "bg-red-50 text-red-700",
    Restored: "bg-cyan-50 text-cyan-700",
    Terminated: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[action] || "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {action || "Unknown"}
    </span>
  );
}

function DetailCard({ label, value, secondary }) {
  return (
    <article className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-3">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p className="mt-1 text-[14px] font-semibold text-[#4E4844]">{value || "Not recorded"}</p>

      {secondary && <p className="mt-1 text-[13px] text-[#938B86]">{secondary}</p>}
    </article>
  );
}

function FilterField({ label, children }) {
  return (
    <label>
      <span className="text-[13px] font-semibold text-[#5B544F]">{label}</span>

      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function LoadingPanel() {
  return (
    <div className="grid min-h-[420px] place-items-center">
      <div className="text-center">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />

        <p className="mt-3 text-[13px] text-[#8C847F]">Loading activity logs...</p>
      </div>
    </div>
  );
}

function EmptyPanel() {
  return (
    <div className="grid min-h-[420px] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
          <Icon name="history" className="h-5 w-5" />
        </div>

        <p className="mt-4 text-[15px] font-semibold">No activity logs found</p>

        <p className="mt-1 text-[14px] leading-4 text-[#938C87]">
          Adjust the selected filters or verify that case action history is being recorded by the
          backend.
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

function getMostCommonAction(logs) {
  const counts = new Map();

  logs.forEach((log) => {
    counts.set(log.action, (counts.get(log.action) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({
      label,
      value,
    }))
    .sort((first, second) => second.value - first.value)[0];
}

function getPeriodStart(period) {
  const now = new Date();

  if (period === "all-time") {
    return null;
  }

  if (period === "current-year") {
    return new Date(now.getFullYear(), 0, 1);
  }

  const days = period === "7-days" ? 7 : period === "90-days" ? 90 : 30;

  const start = startOfDay(now);

  start.setDate(start.getDate() - (days - 1));

  return start;
}

function getPeriodLabel(period) {
  return PERIOD_OPTIONS.find((option) => option.value === period)?.label || "Filtered period";
}

function getRecordId(record) {
  if (!record) return "";

  if (typeof record === "string") {
    return record;
  }

  return String(record._id || record.id || "");
}

function formatName(person) {
  return [person?.firstName, person?.middleName, person?.lastName].filter(Boolean).join(" ");
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
  }).format(date);
}

function formatTime(value) {
  if (!value) {
    return "No time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid time";
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeStyle: "short",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileDate(value) {
  const date = new Date(value);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function convertRowsToCsv(rows) {
  const columns = Object.keys(rows[0]);

  const escapeValue = (value) => {
    const stringValue = String(value ?? "");

    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const header = columns.map(escapeValue).join(",");

  const body = rows
    .map((row) => columns.map((column) => escapeValue(row[column])).join(","))
    .join("\n");

  return `${header}\n${body}`;
}

const filterClass =
  "h-8 w-full rounded-lg border border-[#DDD8D4] bg-white px-2.5 !text-[15px] text-[#302B28] outline-none focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";

const tableHeadClass =
  "px-4 py-3 text-[15px] font-semibold uppercase tracking-[0.08em] text-[#8E8681]";

const tableCellClass = "px-4 py-3 align-top !text-[14px]";
