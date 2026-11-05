import IndividualCaseReport from "../components/IndividualCaseReport";
import { aggregateCaseReport, buildCombinedCaseReport } from "../utils/reportAggregates";
import { buildAccomplishmentReport } from "../utils/accomplishmentReport";
import { getPeriodRange } from "../utils/reportPeriod";
import "./ReportsPage.css";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";
const COUNSELOR_ROLE = "Counselor-User";

const REPORT_TYPES = [
  {
    value: "accomplishment",
    label: "OPCR Accomplishment Report",
    description:
      "Student intakes, follow-up rates, and case closures using the accomplishment-sheet format. Export to formatted Excel.",
    icon: "file",
  },
  {
    value: "combined-case",
    label: "Combined Case Report",
    description:
      "Domain totals, monthly trends, current case statuses, and concern breakdowns in one CSV or printable report.",
    icon: "file",
  },
  {
    value: "case-summary",
    label: "Case Summary Report",
    description:
      "Total cases recorded during the selected period, grouped by case category, concern, and status.",
    icon: "folder",
  },
  {
    value: "case-trends",
    label: "Case Trends Report",
    description:
      "Monthly changes in case counts and concern categories during the selected period.",
    icon: "chart",
  },
  {
    value: "case-status",
    label: "Case Status Report",
    description: "Open, In Progress, For Follow-up, Closed, and Terminated case counts.",
    icon: "notes",
  },
  {
    value: "counselor-workload",
    label: "Counselor Workload Report",
    description: "Cases assigned to each counselor and their current statuses.",
    icon: "users",
    adminOnly: true,
  },
  {
    value: "individual-case",
    label: "Individual Counseling Case Report",
    description:
      "Confidential case narrative with assessment, intervention, progress, and follow-up.",
    icon: "file",
  },
];

const PERIOD_OPTIONS = [
  { value: "custom", label: "Custom date range" },
  {
    value: "6-months",
    label: "Last 6 months",
  },
  {
    value: "12-months",
    label: "Last 12 months",
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

const CASE_STATUS_OPTIONS = ["Open", "In Progress", "For Follow-up", "Closed", "Terminated"];

const DOMAIN_OPTIONS = ["Personal-Social", "Academic-Educational", "Career-Vocational", "Other"];

export default function ReportsPage() {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [individualId, setIndividualId] = useState("");
  const [individualCase, setIndividualCase] = useState(null);
  const [individualLoading, setIndividualLoading] = useState(false);
  const [individualError, setIndividualError] = useState("");
  const [cases, setCases] = useState([]);

  const [users, setUsers] = useState([]);

  const [reportType, setReportType] = useState("combined-case");

  const [period, setPeriod] = useState("12-months");
  const [customStart, setCustomStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [customEnd, setCustomEnd] = useState(formatFileDate(new Date()));
  const [excelLoading, setExcelLoading] = useState(false);
  const validPeriod =
    period !== "custom" || Boolean(customStart && customEnd && customStart <= customEnd);
  const periodLabel = getPeriodLabel(period, customStart, customEnd);

  const [caseStatus, setCaseStatus] = useState("");

  const [domain, setDomain] = useState("");

  const [college, setCollege] = useState("");

  const [program, setProgram] = useState("");

  const [counselor, setCounselor] = useState("");

  const [includeArchived, setIncludeArchived] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [pageError, setPageError] = useState("");

  const [lastGeneratedAt, setLastGeneratedAt] = useState(null);

  const isAdmin = user?.role === ADMIN_ROLE;

  const isCounselor = user?.role === COUNSELOR_ROLE;

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
    if (!isAdmin && reportType === "counselor-workload") {
      setReportType("case-summary");
    }
  }, [isAdmin, reportType]);

  const handleUnauthorized = useCallback(() => {
    clearUser();

    navigate("/login", {
      replace: true,
    });
  }, [clearUser, navigate]);

  const loadReportData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setPageError("");

    try {
      if (isAdmin) {
        const [caseData, userData] = await Promise.all([
          apiRequest("/cases", {
            method: "GET",
          }),

          apiRequest("/users/counselors/active", {
            method: "GET",
          }).then(data => data.counselors),
        ]);

        if (!Array.isArray(caseData)) {
          throw new Error("The backend returned an invalid cases response.");
        }

        if (!Array.isArray(userData)) {
          throw new Error("The backend returned an invalid users response.");
        }

        setCases(caseData);

        setUsers(
          userData.filter(
            (account) =>
              account.isActive !== false && [ADMIN_ROLE, COUNSELOR_ROLE].includes(account.role)
          )
        );
      } else {
        const caseData = await apiRequest("/cases/my-cases", {
          method: "GET",
        });

        if (!Array.isArray(caseData)) {
          throw new Error("The backend returned an invalid cases response.");
        }

        setCases(caseData);
        setUsers([]);
      }

      setLastGeneratedAt(new Date());
    } catch (error) {
      console.error("Unable to load reports:", error);

      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(error.message || "Unable to load report data.");
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, handleUnauthorized]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const colleges = useMemo(() => {
    return uniqueSorted(cases.map((caseRecord) => caseRecord.student?.college).filter(Boolean));
  }, [cases]);

  const programs = useMemo(() => {
    return uniqueSorted(cases.map((caseRecord) => caseRecord.student?.program).filter(Boolean));
  }, [cases]);

  const accessibleReportTypes = useMemo(() => {
    return REPORT_TYPES.filter((item) => !item.adminOnly || isAdmin);
  }, [isAdmin]);

  const filteredCases = useMemo(() => {
    const periodRange = getPeriodRange(period, customStart, customEnd);

    const normalizedSearch = searchQuery.trim().toLowerCase();

    return cases.filter((caseRecord) => {
      if (!validPeriod) return false;
      if (!includeArchived && caseRecord.isArchived === true) {
        return false;
      }

      const openedDate = new Date(caseRecord.dateOpened || caseRecord.createdAt);

      if (
        reportType !== "accomplishment" &&
        ((periodRange.start &&
          (Number.isNaN(openedDate.getTime()) || openedDate < periodRange.start)) ||
          (periodRange.end &&
            (Number.isNaN(openedDate.getTime()) || openedDate >= periodRange.end)))
      ) {
        return false;
      }

      if (caseStatus && caseRecord.caseStatus !== caseStatus) {
        return false;
      }

      if (domain && caseRecord.problemAssessment?.mainDomain !== domain) {
        return false;
      }

      if (college && caseRecord.student?.college !== college) {
        return false;
      }

      if (program && caseRecord.student?.program !== program) {
        return false;
      }

      if (counselor && getRecordId(caseRecord.assignedCounselor) !== counselor) {
        return false;
      }

      if (normalizedSearch) {
        const searchFields = [
          caseRecord.caseNumber,
          formatName(caseRecord.student),
          caseRecord.student?.studentIdNumber,
          caseRecord.student?.college,
          caseRecord.student?.program,
          caseRecord.problemAssessment?.mainDomain,
          formatName(caseRecord.assignedCounselor),
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        if (!searchFields.some((value) => value.includes(normalizedSearch))) {
          return false;
        }
      }

      return true;
    });
  }, [
    cases,
    period,
    includeArchived,
    caseStatus,
    domain,
    college,
    program,
    counselor,
    searchQuery,
    customStart,
    customEnd,
    validPeriod,
    reportType,
  ]);

  const combinedSections = useMemo(() => buildCombinedCaseReport(filteredCases), [filteredCases]);
  const accomplishment = useMemo(
    () => buildAccomplishmentReport(filteredCases, getPeriodRange(period, customStart, customEnd)),
    [filteredCases, period, customStart, customEnd]
  );

  const reportRows = useMemo(() => {
    if (reportType === "accomplishment") return accomplishment.rows;
    if (reportType === "combined-case")
      return combinedSections.flatMap((section) =>
        section.rows.map((row) => ({ Section: section.title, ...row }))
      );
    return buildReportRows({
      reportType,
      cases: filteredCases,
      users,
    });
  }, [reportType, filteredCases, users, combinedSections, accomplishment]);

  const reportSummary = useMemo(() => {
    if (reportType === "accomplishment") return accomplishment.summary;
    return buildReportSummary({
      reportType,
      rows: reportRows,
      cases: filteredCases,
    });
  }, [reportType, reportRows, filteredCases, accomplishment]);

  const selectedReport =
    accessibleReportTypes.find((item) => item.value === reportType) || accessibleReportTypes[0];

  const individualOptions = filteredCases.filter((record) => {
    const permittedId = isAdmin
      ? getRecordId(record.createdBy)
      : getRecordId(record.assignedCounselor);
    return permittedId === String(user?._id || user?.id) && !record.isArchived;
  });
  const selectedIndividualId = individualOptions.some(
    (record) => getRecordId(record) === individualId
  )
    ? individualId
    : "";
  useEffect(() => {
    let cancelled = false;
    setIndividualCase(null);
    setIndividualError("");
    if (reportType !== "individual-case" || !selectedIndividualId) {
      setIndividualLoading(false);
      return;
    }
    setIndividualLoading(true);
    apiRequest(`/cases/${selectedIndividualId}`)
      .then((data) => {
        if (!cancelled) setIndividualCase(data.case || data);
      })
      .catch((error) => {
        if (!cancelled) setIndividualError(error.message || "Unable to load case report.");
      })
      .finally(() => {
        if (!cancelled) setIndividualLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportType, selectedIndividualId]);

  const resetFilters = () => {
    setPeriod("12-months");
    setCaseStatus("");
    setDomain("");
    setCollege("");
    setProgram("");
    setCounselor("");
    setIncludeArchived(false);
    setSearchQuery("");
  };

  const exportCsv = () => {
    if (reportRows.length === 0) {
      setPageError("There are no report rows to export.");

      return;
    }

    const exportRows =
      reportType === "combined-case"
        ? [
            { Section: "Report information", Metric: "Report", Value: selectedReport.label },
            { Section: "Report information", Metric: "Period", Value: periodLabel },
            {
              Section: "Report information",
              Metric: "Coverage",
              Value: isAdmin ? "Office-wide authorized cases" : "Assigned counseling cases",
            },
            {
              Section: "Report information",
              Metric: "Filters",
              Value: reportFilterDescription({
                caseStatus,
                domain,
                college,
                program,
                counselor,
                users,
                includeArchived,
                searchQuery,
              }),
            },
            {
              Section: "Report information",
              Metric: "Generated",
              Value: formatDateTime(lastGeneratedAt || new Date()),
            },
            ...reportSummary.map((item) => ({
              Section: "Overview",
              Metric: item.label,
              Value: item.value,
            })),
            ...reportRows,
          ]
        : reportRows;
    const csvRows =
      reportType === "combined-case"
        ? exportRows.map((row, index) => {
            const { Category, ...values } = row;
            return {
              ...values,
              ...(Category !== undefined ? { Domain: Category } : {}),
              Section:
                index > 0 && row.Section === exportRows[index - 1].Section ? "" : row.Section,
            };
          })
        : exportRows;
    const csv = convertRowsToCsv(csvRows);

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${reportType}-${formatFileDate(new Date())}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    if (
      reportType === "individual-case" &&
      (!individualCase || individualLoading || getRecordId(individualCase) !== selectedIndividualId)
    ) {
      setPageError("Select a case and wait for its report to load before printing.");
      return;
    }
    window.print();
  };

  const exportExcel = async () => {
    if (!validPeriod || isLoading || pageError) return;
    setExcelLoading(true);
    try {
      const { createAccomplishmentWorkbook } = await import("../utils/accomplishmentWorkbook");
      const workbook = await createAccomplishmentWorkbook({
        report: accomplishment,
        period: periodLabel,
        coverage: isAdmin ? "Office-wide authorized cases" : "Assigned counseling cases",
        filters: reportFilterDescription({
          caseStatus,
          domain,
          college,
          program,
          counselor,
          users,
          includeArchived,
          searchQuery,
        }),
        generatedBy: formatName(user) || user.email || "Counselor",
        generatedAt: formatDateTime(lastGeneratedAt || new Date()),
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `opcr-accomplishment-${formatFileDate(new Date())}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setPageError("Unable to export the Excel report. Refresh the report and try again.");
    } finally {
      setExcelLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  if (!isAdmin && !isCounselor) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F6F4] px-5">
        <section className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-red-700">Reports unavailable</h1>

          <p className="mt-3 text-[15px] text-[#756E69]">
            Your account role is not authorized to access the reports module.
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
    <div className="authenticated-app reports-page min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#292522]">
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="reports-layout min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7 print:hidden">
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
                <h1 className="text-[20px] font-semibold">Reports</h1>

                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  {isAdmin
                    ? "Generate office-wide and counselor workload reports"
                    : "Generate reports from your assigned counseling cases"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadReportData}
              disabled={isLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DDD7D3] bg-white px-3 font-semibold text-[#5E5753] hover:text-[#8C1518] disabled:opacity-50"
              style={{
                fontSize: "15px",
              }}
            >
              <Icon name="history" className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <main className="page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7 lg:w-[calc(100%-240px)]! lg:px-0! print:max-w-none print:bg-white print:px-0 print:py-0">
          {pageError && (
            <div className="print:hidden">
              <Alert tone="error" message={pageError} />
            </div>
          )}

          <section className="print:hidden">
            <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
              Generate counseling reports
            </h2>

            <p className="mt-1 max-w-[900px] text-[14px] leading-4 text-[#89817D]">
              Choose a report type, apply filters, review the report preview, then export the
              visible rows as CSV or print the report. The data is limited to cases your account is
              authorized to access.
            </p>
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 print:hidden">
            {accessibleReportTypes.map((item) => {
              const selected = item.value === reportType;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setReportType(item.value)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? "border-[#8C1518] bg-[#F8EEEE]"
                      : "border-[#E4DFDC] bg-white hover:border-[#CDBBB7]"
                  }`}
                >
                  <div
                    className={`grid h-8 w-8 place-items-center rounded-lg ${
                      selected ? "bg-[#8C1518] text-white" : "bg-[#F4EAEA] text-[#8C1518]"
                    }`}
                  >
                    <Icon name={item.icon} className="h-4 w-4" />
                  </div>

                  <p className="mt-3 text-[14px] font-semibold">{item.label}</p>

                  <p className="mt-1 text-[12px] leading-3 text-[#8F8782]">{item.description}</p>
                </button>
              );
            })}
          </section>

          <section className="mt-5 rounded-2xl border border-[#E4DFDC] bg-white p-4 print:hidden">
            <div
              className={`grid gap-3 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}
            >
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

              {period === "custom" && (
                <>
                  <FilterField label="Start date">
                    <input
                      type="date"
                      value={customStart}
                      max={customEnd || undefined}
                      onChange={(event) => setCustomStart(event.target.value)}
                      className={filterClass}
                    />
                  </FilterField>
                  <FilterField label="End date">
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart || undefined}
                      onChange={(event) => setCustomEnd(event.target.value)}
                      className={filterClass}
                    />
                  </FilterField>
                </>
              )}

              <FilterField label="Case status">
                <select
                  value={caseStatus}
                  onChange={(event) => setCaseStatus(event.target.value)}
                  className={filterClass}
                >
                  <option value="">All statuses</option>

                  {CASE_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Domain">
                <select
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  className={filterClass}
                >
                  <option value="">All domains</option>

                  {DOMAIN_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FilterField>

              {isAdmin ? (
                <FilterField label="College">
                  <select
                    value={college}
                    onChange={(event) => setCollege(event.target.value)}
                    className={filterClass}
                  >
                    <option value="">All colleges</option>

                    {colleges.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </FilterField>
              ) : (
                <FilterField label="Program">
                  <select
                    value={program}
                    onChange={(event) => setProgram(event.target.value)}
                    className={filterClass}
                  >
                    <option value="">All programs</option>

                    {programs.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </FilterField>
              )}

              {isAdmin && (
                <FilterField label="Counselor">
                  <select
                    value={counselor}
                    onChange={(event) => setCounselor(event.target.value)}
                    className={filterClass}
                  >
                    <option value="">All counselors</option>

                    {users.map((account) => (
                      <option
                        key={account._id || account.id}
                        value={String(account._id || account.id)}
                      >
                        {formatName(account) || account.email}
                      </option>
                    ))}
                  </select>
                </FilterField>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-3 border-t border-[#ECE8E5] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => setIncludeArchived(event.target.checked)}
                  className="h-3.5 w-3.5 accent-[#8C1518]"
                />

                <span className="text-[13px] font-medium text-[#5D5652]">
                  Include archived cases
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[13px] font-semibold text-[#5E5753]"
                >
                  Reset filters
                </button>

                <button
                  type="button"
                  onClick={reportType === "accomplishment" ? exportExcel : exportCsv}
                  disabled={
                    isLoading ||
                    !validPeriod ||
                    excelLoading ||
                    Boolean(pageError) ||
                    reportRows.length === 0
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#8C1518] bg-white px-3 text-[13px] font-semibold text-[#8C1518] disabled:opacity-40"
                >
                  <Icon name="file" className="h-3 w-3" />
                  {reportType === "accomplishment"
                    ? excelLoading
                      ? "Preparing Excel…"
                      : "Export Excel"
                    : "Export CSV"}
                </button>

                <button
                  type="button"
                  onClick={printReport}
                  disabled={
                    isLoading ||
                    !validPeriod ||
                    Boolean(pageError) ||
                    (reportType === "individual-case"
                      ? individualLoading ||
                        !individualCase ||
                        getRecordId(individualCase) !== selectedIndividualId
                      : reportRows.length === 0)
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  <Icon name="checkSquare" className="h-3 w-3" />
                  Print report
                </button>
              </div>
            </div>
          </section>

          {!validPeriod && (
            <p role="alert" className="mt-3 text-sm text-red-700 print:hidden">
              Enter both dates, with the end date on or after the start date.
            </p>
          )}

          {reportType === "individual-case" ? (
            <section className="mt-5 print:mt-0">
              <div className="mb-5 rounded-xl border border-[#E4DFDC] bg-white p-4 print:hidden">
                <label className="text-sm font-semibold" htmlFor="individual-report-case">
                  Select a case
                </label>
                <select
                  id="individual-report-case"
                  value={selectedIndividualId}
                  onChange={(event) => setIndividualId(event.target.value)}
                  className={`${filterClass} mt-2`}
                >
                  <option value="">Select an authorized case</option>
                  {individualOptions.map((record) => (
                    <option key={getRecordId(record)} value={getRecordId(record)}>
                      {record.caseNumber} · {formatName(record.student)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-[#827A76]">
                  Individual narratives are available for your assigned cases or cases you created
                  as an administrator.
                </p>
              </div>
              {individualLoading ? (
                <LoadingPanel />
              ) : individualError ? (
                <p role="alert" className="p-4 text-red-700">
                  {individualError}
                </p>
              ) : individualCase && getRecordId(individualCase) === selectedIndividualId ? (
                <IndividualCaseReport
                  record={individualCase}
                  generatedAt={lastGeneratedAt || new Date()}
                />
              ) : (
                <p className="p-5 text-sm text-[#827A76]">
                  Select a case to preview its printable report.
                </p>
              )}
            </section>
          ) : (
            <section className="aggregate-report mt-5 print:mt-0">
              <header className="rounded-2xl border border-[#E4DFDC] bg-white px-5 py-4 print:hidden">
                <div className="flex flex-col justify-between gap-4 sm:flex-row">
                  <div>
                    <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#8C1518]">
                      My.GUIDE Reports
                    </p>
                    <h2 className="mt-1 text-[20px] font-semibold">{selectedReport?.label}</h2>
                    <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[#817A76]">
                      {selectedReport?.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-[13px] leading-6 text-[#756E69] sm:text-right">
                    <p>
                      <strong>Period:</strong> {periodLabel}
                    </p>
                    <p>
                      <strong>Generated by:</strong> {formatName(user) || user.email}
                    </p>
                    <p>
                      <strong>Generated:</strong> {formatDateTime(lastGeneratedAt || new Date())}
                    </p>
                  </div>
                </div>
              </header>
              <ReportHeader
                title={selectedReport?.label || "Counseling report"}
                description={selectedReport?.description || ""}
                period={periodLabel}
                generatedBy={formatName(user) || user.email || "Counselor"}
                generatedAt={lastGeneratedAt || new Date()}
                isAdmin={isAdmin}
                filters={
                  ["combined-case", "accomplishment"].includes(reportType)
                    ? reportFilterDescription({
                        caseStatus,
                        domain,
                        college,
                        program,
                        counselor,
                        users,
                        includeArchived,
                        searchQuery,
                      })
                    : ""
                }
              />

              <div className="aggregate-totals mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {reportSummary.map((item) => (
                  <SummaryCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    note={item.note}
                  />
                ))}
              </div>

              {reportType === "accomplishment" ? (
                isLoading ? (
                  <LoadingPanel />
                ) : (
                  <AccomplishmentPreview report={accomplishment} period={periodLabel} />
                )
              ) : reportType === "combined-case" ? (
                isLoading ? (
                  <LoadingPanel />
                ) : (
                  combinedSections.map((section) => (
                    <section
                      key={section.title}
                      className="aggregate-table mt-4 overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white"
                    >
                      <header className="aggregate-table-heading border-b border-[#ECE8E5] px-4 py-3">
                        <h3 className="text-[17px] font-semibold">{section.title}</h3>
                        {section.description && (
                          <p className="report-section-description mt-1 text-[12px] text-[#827A76]">
                            {section.description}
                          </p>
                        )}
                      </header>
                      <ReportTable rows={section.rows} />
                    </section>
                  ))
                )
              ) : (
                <div className="aggregate-table mt-4 overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
                  <header className="aggregate-table-heading flex items-center justify-between border-b border-[#ECE8E5] px-4 py-3">
                    <div>
                      <h3 className="text-[17px] font-semibold">
                        <span className="print:hidden">Report preview</span>
                        <span className="hidden print:inline">Report details</span>
                      </h3>

                      <p className="mt-1 text-[12px] text-[#99918C]">
                        {reportRows.length} row
                        {reportRows.length === 1 ? "" : "s"} displayed
                      </p>
                    </div>
                  </header>

                  {isLoading ? <LoadingPanel /> : <ReportTable rows={reportRows} />}
                </div>
              )}
              <footer className="case-report-signature hidden print:block">
                <p>Prepared by</p>
                <strong>{formatName(user) || "Authorized Guidance Counselor"}</strong>
                <p>Office of Guidance and Counseling</p>
                <p className="mt-4 text-xs">Confidential · For authorized institutional use only</p>
              </footer>
            </section>
          )}

          <div className="mt-5 rounded-2xl border border-[#E6D9B7] bg-[#FCF8EB] px-4 py-3 print:hidden">
            <div className="flex items-start gap-3">
              <Icon name="alertTriangle" className="mt-0.5 h-4 w-4 shrink-0 text-[#A77A00]" />

              <div>
                <p className="text-[14px] font-semibold text-[#705A1B]">Report privacy reminder</p>

                <p className="mt-1 text-[13px] leading-4 text-[#806E3A]">
                  Reports may contain confidential student and counseling information. Exported or
                  printed copies should be stored securely, shared only with authorized personnel,
                  and disposed of according to office privacy procedures.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function AccomplishmentPreview({ report, period }) {
  const columns = ["No", "Indicator", "Target", "Actual count", "Actual percentage", "Remarks"];
  return (
    <section className="accomplishment-report mt-5">
      <header className="rounded-t-xl border border-yellow-300 bg-yellow-100 px-4 py-4">
        <h3 className="text-lg font-semibold">Office of Guidance &amp; Counseling</h3>
        <p className="font-semibold">OPCR ACCOMPLISHMENT — {period}</p>
        <p className="mt-1 text-sm">Whole-number counts and percentages from My.GUIDE records</p>
      </header>
      <div className="overflow-x-auto rounded-b-xl border border-[#E4DFDC] bg-white">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b bg-[#F4F2F0] px-3 py-3">
                  {column === "No" ? "No." : column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.flatMap((row, index) => [
              ...(index === 0 || row.Group !== report.rows[index - 1].Group
                ? [
                    <tr key={`group-${row.Group}`}>
                      <th colSpan={6} className="border-y bg-yellow-50 px-3 py-3 font-semibold">
                        {row.Group}
                      </th>
                    </tr>,
                  ]
                : []),
              <tr key={`indicator-${index}`}>
                {columns.map((column) => (
                  <td
                    key={column}
                    className={`border-b border-[#ECE8E5] px-3 py-3 align-top ${column === "No" ? "font-semibold text-[#8C1518]" : ""} ${row[column] === "Not tracked" ? "italic text-[#827A76]" : ""}`}
                  >
                    {row[column]}
                  </td>
                ))}
              </tr>,
            ])}
          </tbody>
        </table>
      </div>
      <div className="mt-4 rounded-xl border border-[#E4DFDC] bg-white p-4 text-sm leading-6">
        <h3 className="font-semibold">Calculation notes</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ReportHeader({ title, description, period, generatedAt, isAdmin, filters }) {
  return (
    <header className="aggregate-header hidden print:block">
      <div className="case-report-letterhead">
        <p>MINDANAO STATE UNIVERSITY – ILIGAN INSTITUTE OF TECHNOLOGY</p>
        <p>Office of Guidance and Counseling</p>
        <h2>{title}</h2>
        <span>CONFIDENTIAL</span>
      </div>
      <dl className="aggregate-metadata">
        <div>
          <dt>Reporting period</dt>
          <dd>{period}</dd>
        </div>
        <div>
          <dt>Date generated</dt>
          <dd>{formatDateTime(generatedAt)}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{isAdmin ? "Office-wide authorized cases" : "Assigned counseling cases"}</dd>
        </div>
      </dl>
      <p className="aggregate-description">{description}</p>
      {filters && (
        <p className="aggregate-description">
          <strong>Filters:</strong> {filters}
        </p>
      )}
    </header>
  );
}

function SummaryCard({ label, value, note }) {
  return (
    <article className="rounded-xl border border-[#E4DFDC] bg-white p-4 print:border-black">
      <p className="text-[13px] text-[#8D8580]">{label}</p>

      <p className="mt-1 text-[20px] font-semibold tracking-[-0.04em]">{value}</p>

      {note && <p className="mt-1 text-[12px] text-[#99918D]">{note}</p>}
    </article>
  );
}

function ReportTable({ rows }) {
  if (rows.length === 0) {
    return (
      <div className="grid min-h-[260px] place-items-center px-5 text-center">
        <div>
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
            <Icon name="folder" className="h-4 w-4" />
          </div>

          <p className="mt-3 text-[14px] text-[#8C847F]">
            No report records match the selected filters.
          </p>
        </div>
      </div>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="border-b border-[#ECE8E5] bg-[#FCFBFA] text-left">
            {columns.map((column) => (
              <th
                key={column}
                className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8E8681]"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[#F0ECE9] last:border-b-0">
              {columns.map((column) => (
                <td
                  key={column}
                  className="max-w-[260px] px-4 py-3 text-left align-top text-[13px] leading-4 text-[#504A46]"
                >
                  <span className="break-words">{String(row[column] ?? "—")}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <div className="grid min-h-[260px] place-items-center">
      <div className="text-center">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />

        <p className="mt-3 text-[13px] text-[#8C847F]">Preparing report...</p>
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

function buildReportRows({ reportType, cases, users }) {
  if (["case-summary", "case-trends", "case-status"].includes(reportType))
    return aggregateCaseReport(reportType, cases);
  if (reportType === "case-summary") {
    return cases.map((caseRecord) => ({
      "Case Number": caseRecord.caseNumber || "—",
      Student: formatName(caseRecord.student) || "Unknown student",
      "Student ID": caseRecord.student?.studentIdNumber || "—",
      College: caseRecord.student?.college || "Not recorded",
      Program: caseRecord.student?.program || "Not recorded",
      "Year Level": formatYearLevel(caseRecord.student?.yearLevel),
      Domain: caseRecord.problemAssessment?.mainDomain || "Other",
      Priority: caseRecord.priorityLevel || "Moderate",
      Status: caseRecord.caseStatus || "Unknown",
      Counselor: formatName(caseRecord.assignedCounselor) || "Not assigned",
      Opened: formatDate(caseRecord.dateOpened || caseRecord.createdAt),
    }));
  }

  if (reportType === "follow-up") {
    return cases.flatMap((caseRecord) =>
      (caseRecord.followUps || []).map((followUp) => ({
        "Case Number": caseRecord.caseNumber || "—",
        Student: formatName(caseRecord.student) || "Unknown student",
        Type: followUp.followUpType || "Follow-up",
        Purpose: followUp.purpose || "—",
        Priority: followUp.priority || "Moderate",
        Status: followUp.status || "Pending",
        "Due Date": formatDateTime(followUp.followUpDate),
        Reminder: getFollowUpReminderLabel(followUp),
        Counselor: formatName(caseRecord.assignedCounselor) || "Not assigned",
      }))
    );
  }

  if (reportType === "intervention-plan") {
    return cases.flatMap((caseRecord) =>
      (caseRecord.interventionPlans || []).map((plan) => ({
        "Case Number": caseRecord.caseNumber || "—",
        Student: formatName(caseRecord.student) || "Unknown student",
        Problem: plan.problem || "—",
        Goal: plan.goal || "—",
        "Plan Status": plan.status || "Planned",
        "Approval Status": plan.approvalStatus || "Pending Review",
        Sent: plan.isSentToStudent ? "Yes" : "No",
        "Resource Count": plan.resources?.length || 0,
        Created: formatDate(plan.createdAt),
        Counselor: formatName(caseRecord.assignedCounselor) || "Not assigned",
      }))
    );
  }

  if (reportType === "progress-note") {
    return cases.flatMap((caseRecord) =>
      (caseRecord.progressNotes || []).map((note) => ({
        "Case Number": caseRecord.caseNumber || "—",
        Student: formatName(caseRecord.student) || "Unknown student",
        "Session Number": note.sessionNumber || "—",
        "Session Date": formatDateTime(note.sessionDate || note.createdAt),
        "Attending Counselor":
          formatName(note.attendingCounselor) ||
          formatName(caseRecord.assignedCounselor) ||
          "Not recorded",
        Summary: note.sessionSummary || note.progressSummary || note.notes || "—",
      }))
    );
  }

  if (reportType === "counselor-workload") {
    return buildCounselorWorkloadRows(cases, users);
  }

  return [];
}

function buildReportSummary({ reportType, rows, cases }) {
  if (["combined-case", "case-summary", "case-trends", "case-status"].includes(reportType))
    return [
      { label: "Total cases", value: cases.length, note: "Selected period and filters" },
      {
        label: "Active cases",
        value: cases.filter((record) =>
          ["Open", "In Progress", "For Follow-up"].includes(record.caseStatus)
        ).length,
        note: "Open or ongoing",
      },
      {
        label: "Closed",
        value: cases.filter((record) => record.caseStatus === "Closed").length,
        note: "Completed cases",
      },
      {
        label: "Terminated",
        value: cases.filter((record) => record.caseStatus === "Terminated").length,
        note: "Terminated cases",
      },
    ];
  if (reportType === "case-summary") {
    const active = cases.filter((caseRecord) =>
      ["Open", "In Progress", "For Follow-up"].includes(caseRecord.caseStatus)
    ).length;

    const highUrgent = cases.filter((caseRecord) =>
      ["High", "Urgent"].includes(caseRecord.priorityLevel)
    ).length;

    const uniqueStudents = new Set(
      cases.map((caseRecord) => getRecordId(caseRecord.student)).filter(Boolean)
    ).size;

    return [
      {
        label: "Cases",
        value: rows.length,
        note: "Filtered records",
      },
      {
        label: "Active",
        value: active,
        note: "Open or ongoing",
      },
      {
        label: "High/Urgent",
        value: highUrgent,
        note: "Closer monitoring",
      },
      {
        label: "Students",
        value: uniqueStudents,
        note: "Unique students",
      },
    ];
  }

  if (reportType === "follow-up") {
    return [
      {
        label: "Follow-ups",
        value: rows.length,
      },
      {
        label: "Pending",
        value: rows.filter((row) => row.Status === "Pending").length,
      },
      {
        label: "Overdue",
        value: rows.filter((row) => row.Reminder === "Overdue").length,
      },
      {
        label: "Completed",
        value: rows.filter((row) => row.Status === "Completed").length,
      },
    ];
  }

  if (reportType === "intervention-plan") {
    return [
      {
        label: "Plans",
        value: rows.length,
      },
      {
        label: "Pending Review",
        value: rows.filter((row) => row["Approval Status"] === "Pending Review").length,
      },
      {
        label: "Approved",
        value: rows.filter((row) => row["Approval Status"] === "Approved").length,
      },
      {
        label: "Sent",
        value: rows.filter((row) => row.Sent === "Yes").length,
      },
    ];
  }

  if (reportType === "progress-note") {
    return [
      {
        label: "Progress Notes",
        value: rows.length,
      },
      {
        label: "Cases Documented",
        value: new Set(rows.map((row) => row["Case Number"])).size,
      },
      {
        label: "Students",
        value: new Set(rows.map((row) => row.Student)).size,
      },
      {
        label: "Counselors",
        value: new Set(rows.map((row) => row["Attending Counselor"])).size,
      },
    ];
  }

  if (reportType === "counselor-workload") {
    return [
      {
        label: "Counselors",
        value: rows.length,
      },
      {
        label: "Active Cases",
        value: rows.reduce((sum, row) => sum + Number(row["Active Cases"] || 0), 0),
      },
      {
        label: "High/Urgent",
        value: rows.reduce((sum, row) => sum + Number(row["High/Urgent"] || 0), 0),
      },
      {
        label: "Pending Follow-ups",
        value: rows.reduce((sum, row) => sum + Number(row["Pending Follow-ups"] || 0), 0),
      },
    ];
  }

  return [];
}

function buildCounselorWorkloadRows(cases, users) {
  return users
    .map((account) => {
      const accountId = String(account._id || account.id);

      const assignedCases = cases.filter(
        (caseRecord) => getRecordId(caseRecord.assignedCounselor) === accountId
      );

      const activeCases = assignedCases.filter((caseRecord) =>
        ["Open", "In Progress", "For Follow-up"].includes(caseRecord.caseStatus)
      );

      const highUrgent = activeCases.filter((caseRecord) =>
        ["High", "Urgent"].includes(caseRecord.priorityLevel)
      ).length;

      const pendingFollowUps = assignedCases.reduce(
        (total, caseRecord) =>
          total +
          (caseRecord.followUps || []).filter((followUp) => followUp.status === "Pending").length,
        0
      );

      const closedCases = assignedCases.filter(
        (caseRecord) => caseRecord.caseStatus === "Closed"
      ).length;

      return {
        Counselor: formatName(account) || account.email || "Counselor",
        Email: account.email || "Not recorded",
        "Colleges Handled": (account.collegesHandled || []).join(", ") || "Not assigned",
        Open: assignedCases.filter((record) => record.caseStatus === "Open").length,
        "In Progress": assignedCases.filter((record) => record.caseStatus === "In Progress").length,
        "For Follow-up": assignedCases.filter((record) => record.caseStatus === "For Follow-up")
          .length,
        Terminated: assignedCases.filter((record) => record.caseStatus === "Terminated").length,
        "Active Cases": activeCases.length,
        "High/Urgent": highUrgent,
        "Pending Follow-ups": pendingFollowUps,
        "Closed Cases": closedCases,
        "Total Cases": assignedCases.length,
      };
    })
    .sort((first, second) => second["Active Cases"] - first["Active Cases"]);
}

function convertRowsToCsv(rows) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];

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

function reportFilterDescription({
  caseStatus,
  domain,
  college,
  program,
  counselor,
  users,
  includeArchived,
  searchQuery,
}) {
  return [
    `Status: ${caseStatus || "All statuses"}`,
    `Domain: ${domain || "All domains"}`,
    `College: ${college || "All colleges"}`,
    `Program: ${program || "All programs"}`,
    counselor &&
      `Counselor: ${formatName(users.find((account) => getRecordId(account) === counselor)) || "Selected counselor"}`,
    `Archived cases: ${includeArchived ? "Included" : "Excluded"}`,
    searchQuery.trim() && `Search: ${searchQuery.trim()}`,
  ]
    .filter(Boolean)
    .join("; ");
}

function getFollowUpReminderLabel(followUp) {
  if (followUp.status !== "Pending") {
    return followUp.status || "Unknown";
  }

  const date = new Date(followUp.followUpDate);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  const today = startOfDay(new Date());

  const tomorrow = new Date(today);

  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date < today) {
    return "Overdue";
  }

  if (date >= today && date < tomorrow) {
    return "Due today";
  }

  return "Upcoming";
}

function formatYearLevel(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "Not recorded";
  }

  const normalized = String(value).trim().toLowerCase();

  const labels = {
    1: "1st Year",
    "1st": "1st Year",
    "1st year": "1st Year",
    "first year": "1st Year",

    2: "2nd Year",
    "2nd": "2nd Year",
    "2nd year": "2nd Year",
    "second year": "2nd Year",

    3: "3rd Year",
    "3rd": "3rd Year",
    "3rd year": "3rd Year",
    "third year": "3rd Year",

    4: "4th Year",
    "4th": "4th Year",
    "4th year": "4th Year",
    "fourth year": "4th Year",

    5: "5th Year",
    "5th": "5th Year",
    "5th year": "5th Year",
    "fifth year": "5th Year",

    graduate: "Graduate",
    postgraduate: "Graduate",
    other: "Other",
  };

  return labels[normalized] || "Other";
}

function getPeriodLabel(period, customStart, customEnd) {
  if (period === "custom")
    return customStart && customEnd
      ? `${formatDate(`${customStart}T00:00:00+08:00`)} – ${formatDate(`${customEnd}T00:00:00+08:00`)}`
      : "Custom date range";
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
  return [person?.firstName, person?.lastName].filter(Boolean).join(" ");
}

function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "Not recorded";
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

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((first, second) => first.localeCompare(second));
}

const filterClass =
  "h-8 w-full rounded-lg border border-[#DDD8D4] bg-white px-2.5 text-[13px] text-[#302B28] outline-none focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";
