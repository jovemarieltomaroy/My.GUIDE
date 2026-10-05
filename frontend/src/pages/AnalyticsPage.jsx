import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";
const COUNSELOR_ROLE = "Counselor-User";

const ACTIVE_CASE_STATUSES = [
  "Open",
  "In Progress",
  "For Follow-up",
];

const DOMAIN_ORDER = [
  "Personal-Social",
  "Academic-Educational",
  "Career-Vocational",
  "Other",
];

const PRIORITY_ORDER = [
  "Urgent",
  "High",
  "Moderate",
  "Low",
];

const STATUS_ORDER = [
  "Open",
  "In Progress",
  "For Follow-up",
  "Closed",
  "Terminated",
];

const PERIOD_OPTIONS = [
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

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [cases, setCases] =
    useState([]);

  const [users, setUsers] =
    useState([]);

  const [period, setPeriod] =
    useState("12-months");

  const [collegeFilter, setCollegeFilter] =
    useState("");

  const [programFilter, setProgramFilter] =
    useState("");

  const [counselorFilter, setCounselorFilter] =
    useState("");

  const [domainFilter, setDomainFilter] =
    useState("");

  const [includeArchived, setIncludeArchived] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const isAdmin =
    user?.role === ADMIN_ROLE;

  const isCounselor =
    user?.role === COUNSELOR_ROLE;

  useEffect(() => {
    if (!user) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    if (
      user.mustChangePassword === true
    ) {
      navigate("/change-password", {
        replace: true,
      });

      return;
    }

    if (
      user.profileCompleted === false
    ) {
      navigate("/complete-profile", {
        replace: true,
      });
    }
  }, [user, navigate]);

  const handleUnauthorized =
    useCallback(() => {
      clearUser();

      navigate("/login", {
        replace: true,
      });
    }, [clearUser, navigate]);

  const loadAnalyticsData =
    useCallback(async () => {
      if (!user) return;

      setIsLoading(true);
      setPageError("");

      try {
        if (isAdmin) {
          const [
            caseData,
            userData,
          ] = await Promise.all([
            apiRequest("/cases", {
              method: "GET",
            }),

            apiRequest(
              "/users?isActive=true",
              {
                method: "GET",
              },
            ),
          ]);

          if (!Array.isArray(caseData)) {
            throw new Error(
              "The backend returned an invalid cases response.",
            );
          }

          if (!Array.isArray(userData)) {
            throw new Error(
              "The backend returned an invalid users response.",
            );
          }

          setCases(caseData);

          setUsers(
            userData.filter(
              (account) =>
                account.isActive !==
                  false &&
                [
                  ADMIN_ROLE,
                  COUNSELOR_ROLE,
                ].includes(
                  account.role,
                ),
            ),
          );
        } else {
          const caseData =
            await apiRequest(
              "/cases/my-cases",
              {
                method: "GET",
              },
            );

          if (
            !Array.isArray(caseData)
          ) {
            throw new Error(
              "The backend returned an invalid cases response.",
            );
          }

          setCases(caseData);
          setUsers([]);
        }
      } catch (error) {
        console.error(
          "Unable to load analytics:",
          error,
        );

        if (error.status === 401) {
          handleUnauthorized();
          return;
        }

        setPageError(
          error.message ||
            "Unable to load analytics data.",
        );
      } finally {
        setIsLoading(false);
      }
    }, [
      user,
      isAdmin,
      handleUnauthorized,
    ]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  const colleges = useMemo(() => {
    return Array.from(
      new Set(
        cases
          .map(
            (caseRecord) =>
              caseRecord.student?.college,
          )
          .filter(Boolean),
      ),
    ).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [cases]);

  const programs = useMemo(() => {
    return Array.from(
      new Set(
        cases
          .map(
            (caseRecord) =>
              caseRecord.student?.program,
          )
          .filter(Boolean),
      ),
    ).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [cases]);

  const filteredCases = useMemo(() => {
    const periodRange =
      getPeriodRange(period);

    return cases.filter(
      (caseRecord) => {
        if (
          !includeArchived &&
          caseRecord.isArchived === true
        ) {
          return false;
        }

        const date =
          new Date(
            caseRecord.dateOpened ||
              caseRecord.createdAt,
          );

        if (
          periodRange.start &&
          (!Number.isNaN(
            date.getTime(),
          ) &&
            date <
              periodRange.start)
        ) {
          return false;
        }

        if (
          collegeFilter &&
          caseRecord.student?.college !==
            collegeFilter
        ) {
          return false;
        }

        if (
          programFilter &&
          caseRecord.student?.program !==
            programFilter
        ) {
          return false;
        }

        const assignedCounselorId =
          getRecordId(
            caseRecord.assignedCounselor,
          );

        if (
          counselorFilter &&
          assignedCounselorId !==
            counselorFilter
        ) {
          return false;
        }

        if (
          domainFilter &&
          caseRecord
            .problemAssessment
            ?.mainDomain !==
            domainFilter
        ) {
          return false;
        }

        return true;
      },
    );
  }, [
    cases,
    period,
    collegeFilter,
    programFilter,
    counselorFilter,
    domainFilter,
    includeArchived,
  ]);

  const analytics = useMemo(
    () =>
      buildAnalytics(
        filteredCases,
        users,
        period,
      ),
    [
      filteredCases,
      users,
      period,
    ],
  );

  const hasFilters =
    collegeFilter ||
    programFilter ||
    counselorFilter ||
    domainFilter ||
    includeArchived ||
    period !== "12-months";

  const resetFilters = () => {
    setPeriod("12-months");
    setCollegeFilter("");
    setProgramFilter("");
    setCounselorFilter("");
    setDomainFilter("");
    setIncludeArchived(false);
  };

  if (!user) {
    return null;
  }

  if (
    !isAdmin &&
    !isCounselor
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F6F4] px-5">
        <section className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-red-700">
            Analytics unavailable
          </h1>

          <p className="mt-3 text-[15px] text-[#756E69]">
            Your account role is not
            authorized to access the
            analytics module.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/dashboard")
            }
            className="mt-6 rounded-xl bg-[#8C1518] px-5 py-3 text-[15px] font-semibold text-white"
          >
            Return to dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#292522]">
      <AppSidebar
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="min-h-screen lg:pl-[220px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex w-full items-center justify-between gap-3">
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

              <div>
                <h1 className="text-[20px] font-semibold">
                  Analytics
                </h1>

                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  {isAdmin
                    ? "Office-wide counseling case trends and counselor workload"
                    : "Trends from your assigned counseling cases"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadAnalyticsData}
              disabled={isLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DDD7D3] bg-white px-3 font-semibold text-[#5E5753] hover:text-[#8C1518] disabled:opacity-50"
              style={{
                fontSize: "15px",
              }}
            >
              <Icon
                name="history"
                className={`h-3 w-3 ${
                  isLoading
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7">
          {pageError && (
            <Alert
              tone="error"
              message={pageError}
            />
          )}

          <section className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
                Counseling case trends
              </h2>

              <p className="mt-1 max-w-[850px] text-[14px] leading-4 text-[#89817D]">
                Monitor changes in case
                volume, student concerns,
                case status, priorities,
                follow-up activity, and
                intervention planning.
                Analytics shown here are
                limited to records your
                account is authorized to
                access.
              </p>
            </div>

            <p className="text-[13px] text-[#9B938E]">
              Last refreshed{" "}
              {formatDateTime(
                new Date(),
              )}
            </p>
          </section>

          <section className="mt-5 rounded-2xl border border-[#E4DFDC] bg-white p-4 !text-[15px] ">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <FilterField label="Period">
                <select
                  value={period}
                  onChange={(event) =>
                    setPeriod(
                      event.target.value,
                    )
                  }
                  className={filterClass}
                >
                  {PERIOD_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </FilterField>

              {isAdmin ? (
                <FilterField label="College">
                  <select
                    value={collegeFilter}
                    onChange={(event) =>
                      setCollegeFilter(
                        event.target.value,
                      )
                    }
                    className={filterClass}
                  >
                    <option value="">
                      All colleges
                    </option>

                    {colleges.map(
                      (college) => (
                        <option
                          key={college}
                          value={college}
                        >
                          {college}
                        </option>
                      ),
                    )}
                  </select>
                </FilterField>
              ) : (
                <FilterField label="Program">
                  <select
                    value={programFilter}
                    onChange={(event) =>
                      setProgramFilter(
                        event.target.value,
                      )
                    }
                    className={filterClass}
                  >
                    <option value="">
                      All programs
                    </option>

                    {programs.map(
                      (program) => (
                        <option
                          key={program}
                          value={program}
                        >
                          {program}
                        </option>
                      ),
                    )}
                  </select>
                </FilterField>
              )}

              {isAdmin && (
                <FilterField label="Counselor">
                  <select
                    value={
                      counselorFilter
                    }
                    onChange={(event) =>
                      setCounselorFilter(
                        event.target.value,
                      )
                    }
                    className={filterClass}
                  >
                    <option value="">
                      All counselors
                    </option>

                    {users.map(
                      (account) => (
                        <option
                          key={
                            account._id ||
                            account.id
                          }
                          value={String(
                            account._id ||
                              account.id,
                          )}
                        >
                          {formatName(
                            account,
                          ) ||
                            account.email}
                        </option>
                      ),
                    )}
                  </select>
                </FilterField>
              )}

              <FilterField label="Domain">
                <select
                  value={domainFilter}
                  onChange={(event) =>
                    setDomainFilter(
                      event.target.value,
                    )
                  }
                  className={filterClass}
                >
                  <option value="">
                    All domains
                  </option>

                  {DOMAIN_ORDER.map(
                    (domain) => (
                      <option
                        key={domain}
                        value={domain}
                      >
                        {domain}
                      </option>
                    ),
                  )}
                </select>
              </FilterField>

              <div className="flex items-end gap-2">
                <label className="flex h-8 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[#DDD8D4] bg-white px-2.5">
                  <input
                    type="checkbox"
                    checked={
                      includeArchived
                    }
                    onChange={(event) =>
                      setIncludeArchived(
                        event.target
                          .checked,
                      )
                    }
                    className="h-3.5 w-3.5 accent-[#8C1518]"
                  />

                  <span className="text-[13px] font-medium text-[#5D5652]">
                    Include archived
                  </span>
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

          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total cases"
              value={
                analytics.summary.totalCases
              }
              note={getPeriodLabel(
                period,
              )}
              icon="folder"
              tone="maroon"
              loading={isLoading}
            />

            <MetricCard
              label="Active cases"
              value={
                analytics.summary.activeCases
              }
              note={`${analytics.summary.activeRate}% of filtered cases`}
              icon="history"
              tone="blue"
              loading={isLoading}
            />

            <MetricCard
              label="Closed cases"
              value={
                analytics.summary.closedCases
              }
              note={`${analytics.summary.closureRate}% closure rate`}
              icon="checkSquare"
              tone="green"
              loading={isLoading}
            />

            <MetricCard
              label="High or urgent"
              value={
                analytics.summary.highRiskCases
              }
              note={`${analytics.summary.highRiskRate}% need closer monitoring`}
              icon="alertTriangle"
              tone="red"
              loading={isLoading}
            />
          </section>

          <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Students served"
              value={
                analytics.summary.uniqueStudents
              }
              note="Unique students"
              icon="student"
              tone="gold"
              loading={isLoading}
            />

            <MetricCard
              label="Pending follow-ups"
              value={
                analytics.summary.pendingFollowUps
              }
              note={`${analytics.summary.overdueFollowUps} overdue`}
              icon="calendar"
              tone="gold"
              loading={isLoading}
            />

            <MetricCard
              label="Progress notes"
              value={
                analytics.summary.progressNotes
              }
              note="Documented sessions"
              icon="notes"
              tone="blue"
              loading={isLoading}
            />

            <MetricCard
              label="Intervention plans"
              value={
                analytics.summary.interventionPlans
              }
              note={`${analytics.summary.approvedPlans} approved`}
              icon="heart"
              tone="green"
              loading={isLoading}
            />
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
            <Panel
              title="Case volume over time"
              subtitle="Cases opened within the selected period"
            >
              {isLoading ? (
                <LoadingPanel />
              ) : (
                <TrendChart
                  data={
                    analytics.monthlyTrend
                  }
                />
              )}
            </Panel>

            <Panel
              title="Case status distribution"
              subtitle="Current status of filtered cases"
            >
              {isLoading ? (
                <LoadingPanel />
              ) : (
                <DistributionList
                  items={
                    analytics.statusDistribution
                  }
                  emptyText="No case-status data is available."
                />
              )}
            </Panel>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Panel
              title="Concern domains"
              subtitle="Most common counseling case categories"
            >
              {isLoading ? (
                <LoadingPanel />
              ) : (
                <HorizontalBars
                  items={
                    analytics.domainDistribution
                  }
                  emptyText="No domain data is available."
                />
              )}
            </Panel>

            <Panel
              title="Priority levels"
              subtitle="Current case priority distribution"
            >
              {isLoading ? (
                <LoadingPanel />
              ) : (
                <HorizontalBars
                  items={
                    analytics.priorityDistribution
                  }
                  emptyText="No priority data is available."
                />
              )}
            </Panel>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Panel
              title={
                isAdmin
                  ? "Student distribution by college"
                  : "Student distribution by program"
              }
              subtitle={
                isAdmin
                  ? "Colleges with the highest number of counseling cases"
                  : "Programs represented in your assigned counseling cases"
              }
            >
              {isLoading ? (
                <LoadingPanel />
              ) : (
                <HorizontalBars
                  items={
                    isAdmin
                      ? analytics.collegeDistribution
                      : analytics.programDistribution
                  }
                  emptyText={
                    isAdmin
                      ? "No college data is available."
                      : "No program data is available."
                  }
                  limit={8}
                />
              )}
            </Panel>

            <Panel
              title="Year-level distribution"
              subtitle="Student year levels represented in counseling cases"
            >
              {isLoading ? (
                <LoadingPanel />
              ) : (
                <HorizontalBars
                  items={
                    analytics.yearLevelDistribution
                  }
                  emptyText="No year-level data is available."
                />
              )}
            </Panel>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <Panel
              title="Follow-up monitoring"
              subtitle="Pending follow-up workload and overdue actions"
            >
              {isLoading ? (
                <LoadingPanel />
              ) : (
                <FollowUpOverview
                  data={
                    analytics.followUpOverview
                  }
                  onOpen={() =>
                    navigate(
                      "/follow-ups",
                    )
                  }
                />
              )}
            </Panel>

            <Panel
              title="Intervention plan monitoring"
              subtitle="Review and implementation status of intervention plans"
            >
              {isLoading ? (
                <LoadingPanel />
              ) : (
                <DistributionList
                  items={
                    analytics.planDistribution
                  }
                  emptyText="No intervention plans are available."
                />
              )}
            </Panel>
          </div>

          {isAdmin && (
            <div className="mt-5 !text-[15px] ">
              <Panel
                title="Counselor workload"
                subtitle="Active cases and high-priority workload per active counselor"
                action="Manage users"
                onAction={() =>
                  navigate("/users")
                }
              >
                {isLoading ? (
                  <LoadingPanel />
                ) : (
                  <CounselorWorkloadTable
                    rows={
                      analytics.counselorWorkload
                    }
                    onOpenUser={() =>
                      navigate("/users")
                    }
                  />
                )}
              </Panel>
            </div>
          )}

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Panel
              title="Common primary concerns"
              subtitle="Top 10 frequently recorded primary problems"
            >
              {isLoading ? (
                <LoadingPanel />
              ) : (
                <RankedList
                  items={
                    analytics.primaryProblems
                  }
                  emptyText="No primary problems have been recorded."
                />
              )}
            </Panel>

            <Panel
              title="Helpful monitoring indicators"
              subtitle="Additional signals for office planning and case review"
            >
              {isLoading ? (
                <LoadingPanel />
              ) : (
                <InsightList
                  insights={
                    analytics.insights
                  }
                />
              )}
            </Panel>
          </div>

          <div className="mt-5 rounded-2xl border border-[#E6D9B7] bg-[#FCF8EB] px-4 py-3">
            <div className="flex items-start gap-3">
              <Icon
                name="alertTriangle"
                className="mt-0.5 h-4 w-4 shrink-0 text-[#A77A00]"
              />

              <div>
                <p className="text-[14px] font-semibold text-[#705A1B]">
                  Analytics are decision-support summaries
                </p>

                <p className="mt-1 text-[13px] leading-4 text-[#806E3A]">
                  These results describe
                  patterns in recorded
                  counseling cases. They
                  should support case
                  monitoring, staffing,
                  outreach planning, and
                  program development, but
                  they should not be used to
                  diagnose students or
                  replace professional
                  counseling judgment.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone,
  loading,
}) {
  const tones = {
    maroon: {
      border:
        "border-[#A62A2E]/50",
      icon:
        "bg-[#F4E8E8] text-[#8C1518]",
    },

    green: {
      border:
        "border-[#5E8F3A]/50",
      icon:
        "bg-[#EAF4E5] text-[#398322]",
    },

    gold: {
      border:
        "border-[#D2A92D]/50",
      icon:
        "bg-[#FAF3DC] text-[#A47900]",
    },

    blue: {
      border:
        "border-[#3E79BA]/50",
      icon:
        "bg-[#EAF1F8] text-[#316FAE]",
    },

    red: {
      border:
        "border-[#D05A5E]/50",
      icon:
        "bg-[#FBE7E8] text-[#B1252A]",
    },
  };

  const selected =
    tones[tone] || tones.maroon;

  return (
    <article
      className={`rounded-xl border bg-white p-4 ${selected.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`grid h-8 w-8 place-items-center rounded-lg ${selected.icon}`}
        >
          <Icon
            name={icon}
            className="h-4 w-4"
          />
        </div>

        <span className="text-right text-[12px] leading-3 text-[#948C87]">
          {note}
        </span>
      </div>

      <p className="mt-3 text-[13px] text-[#8D8580]">
        {label}
      </p>

      {loading ? (
        <div className="mt-2 h-7 w-14 animate-pulse rounded bg-[#EEEAE7]" />
      ) : (
        <p className="mt-1 text-[22px] font-semibold tracking-[-0.04em]">
          {value}
        </p>
      )}
    </article>
  );
}

function Panel({
  title,
  subtitle,
  action,
  onAction,
  children,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
      <header className="flex min-h-[54px] items-center justify-between gap-3 border-b border-[#ECE8E5] px-4 py-3">
        <div>
          <h3 className="text-[17px] font-semibold">
            {title}
          </h3>

          {subtitle && (
            <p className="mt-1 text-[12px] text-[#99918C]">
              {subtitle}
            </p>
          )}
        </div>

        {action && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 text-[13px] font-semibold text-[#8C1518]"
          >
            {action} →
          </button>
        )}
      </header>

      {children}
    </section>
  );
}

function TrendChart({ data }) {
  const maximum = Math.max(
    ...data.map(
      (item) => item.value,
    ),
    1,
  );

  const hasData = data.some(
    (item) => item.value > 0,
  );

  if (!hasData) {
    return (
      <EmptyPanel text="No cases were opened during the selected period." />
    );
  }

  return (
    <div className="overflow-x-auto px-4 pb-4 pt-5">
      <div
        className="flex h-[230px] min-w-[620px] items-end gap-2"
        role="img"
        aria-label="Case volume by month"
      >
        {data.map((item) => {
          const height =
            item.value === 0
              ? 0
              : Math.max(
                  (item.value /
                    maximum) *
                    100,
                  8,
                );

          return (
            <div
              key={item.key}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <div className="flex flex-1 items-end">
                <div
                  className="relative w-full rounded-t-lg bg-[#A93D40] transition hover:bg-[#8C1518]"
                  style={{
                    height: `${height}%`,
                  }}
                  title={`${item.label}: ${item.value} cases`}
                >
                  {item.value > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[12px] font-semibold text-[#5A534F]">
                      {item.value}
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-2 text-center text-[12px] text-[#958D88]">
                {item.shortLabel}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HorizontalBars({
  items,
  emptyText,
  limit,
}) {
  const displayedItems =
    typeof limit === "number"
      ? items.slice(0, limit)
      : items;

  if (
    displayedItems.length === 0 ||
    !displayedItems.some(
      (item) => item.value > 0,
    )
  ) {
    return (
      <EmptyPanel text={emptyText} />
    );
  }

  const maximum = Math.max(
    ...displayedItems.map(
      (item) => item.value,
    ),
    1,
  );

  return (
    <div className="space-y-3 p-4">
      {displayedItems.map(
        (item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-[#5B544F]">
                {item.label}
              </span>

              <span className="text-[13px] font-semibold text-[#8C1518]">
                {item.value}
              </span>
            </div>

            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EFEAE7]">
              <div
                className="h-full rounded-full bg-[#A83C40]"
                style={{
                  width: `${
                    (item.value /
                      maximum) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function DistributionList({
  items,
  emptyText,
}) {
  const total = items.reduce(
    (sum, item) =>
      sum + item.value,
    0,
  );

  if (total === 0) {
    return (
      <EmptyPanel text={emptyText} />
    );
  }

  return (
    <div className="divide-y divide-[#EEEAE7]">
      {items.map((item) => {
        const percentage =
          total === 0
            ? 0
            : Math.round(
                (item.value /
                  total) *
                  100,
              );

        return (
          <div
            key={item.label}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${getDistributionTone(
                item.label,
              )}`}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[#5C5550]">
                {item.label}
              </p>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEEAE7]">
                <div
                  className="h-full rounded-full bg-[#A83C40]"
                  style={{
                    width: `${percentage}%`,
                  }}
                />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[14px] font-semibold">
                {item.value}
              </p>

              <p className="mt-0.5 text-[12px] text-[#99918D]">
                {percentage}%
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FollowUpOverview({
  data,
  onOpen,
}) {
  const items = [
    {
      label: "Overdue",
      value: data.overdue,
      tone:
        "border-red-200 bg-red-50 text-red-700",
    },
    {
      label: "Due today",
      value: data.dueToday,
      tone:
        "border-amber-200 bg-amber-50 text-amber-700",
    },
    {
      label: "Upcoming",
      value: data.upcoming,
      tone:
        "border-blue-200 bg-blue-50 text-blue-700",
    },
    {
      label: "Completed",
      value: data.completed,
      tone:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <div className="p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.label}
            className={`rounded-xl border p-3 ${item.tone}`}
          >
            <p className="text-[13px] font-medium">
              {item.label}
            </p>

            <p className="mt-1 text-[18px] font-semibold">
              {item.value}
            </p>
          </article>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-4 h-8 w-full rounded-lg border border-[#8C1518] bg-white text-[13px] font-semibold text-[#8C1518] hover:bg-[#F8EEEE]"
      >
        Open follow-up workspace
      </button>
    </div>
  );
}

function CounselorWorkloadTable({
  rows,
  onOpenUser,
}) {
  if (rows.length === 0) {
    return (
      <EmptyPanel text="No active counselors were returned." />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[760px] w-full border-collapse">
        <thead>
          <tr className="border-b border-[#ECE8E5] bg-[#FCFBFA] text-left">
            <th className={tableHeadClass}>
              Counselor
            </th>

            <th className={tableHeadClass}>
              Colleges handled
            </th>

            <th className={`${tableHeadClass} text-center`}>
              Active
            </th>

            <th className={`${tableHeadClass} text-center`}>
              High/Urgent
            </th>

            <th className={`${tableHeadClass} text-center`}>
              Follow-ups
            </th>

            <th className={`${tableHeadClass} text-center`}>
              Closed
            </th>

            <th className={`${tableHeadClass} text-right`}>
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[#F0ECE9] last:border-b-0"
            >
              <td className={tableCellClass}>
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#8C1518] text-[13px] font-semibold text-white">
                    {getInitials(
                      row.name,
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">
                      {row.name}
                    </p>

                    <p className="mt-0.5 truncate text-[12px] text-[#99918D]">
                      {row.email ||
                        "No email"}
                    </p>
                  </div>
                </div>
              </td>

              <td className={tableCellClass}>
                <span className="text-[13px] text-[#6E6763]">
                  {row.colleges ||
                    "Not assigned"}
                </span>
              </td>

              <td className={`${tableCellClass} text-center text-[14px] font-semibold`}>
                {row.activeCases}
              </td>

              <td className={`${tableCellClass} text-center text-[14px] font-semibold text-red-600`}>
                {row.highPriority}
              </td>

              <td className={`${tableCellClass} text-center text-[14px] font-semibold text-amber-700`}>
                {row.pendingFollowUps}
              </td>

              <td className={`${tableCellClass} text-center text-[14px] font-semibold text-emerald-700`}>
                {row.closedCases}
              </td>

              <td className={`${tableCellClass} text-right`}>
                <button
                  type="button"
                  onClick={onOpenUser}
                  className="!text-[15px] font-semibold text-[#8C1518]"
                >
                  Manage
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankedList({
  items,
  emptyText,
}) {
  if (items.length === 0) {
    return (
      <EmptyPanel text={emptyText} />
    );
  }

  return (
    <div className="divide-y divide-[#EEEAE7]">
      {items
        .slice(0, 10)
        .map((item, index) => (
          <div
            key={item.label}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[13px] font-semibold text-[#8C1518]">
              {index + 1}
            </span>

            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#5B544F]">
              {item.label}
            </p>

            <span className="text-[14px] font-semibold text-[#8C1518]">
              {item.value}
            </span>
          </div>
        ))}
    </div>
  );
}

function InsightList({
  insights,
}) {
  return (
    <div className="space-y-3 p-4">
      {insights.map((insight) => (
        <article
          key={insight.title}
          className={`rounded-xl border px-3 py-3 ${insight.tone}`}
        >
          <div className="flex items-start gap-3">
            <Icon
              name={insight.icon}
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
            />

            <div>
              <p className="text-[14px] font-semibold">
                {insight.title}
              </p>

              <p className="mt-1 text-[13px] leading-4 opacity-80">
                {insight.message}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function FilterField({
  label,
  children,
}) {
  return (
    <label>
      <span className="text-[13px] font-semibold text-[#5B544F]">
        {label}
      </span>

      <div className="mt-1.5">
        {children}
      </div>
    </label>
  );
}

function LoadingPanel() {
  return (
    <div className="grid min-h-[220px] place-items-center">
      <div className="text-center">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />

        <p className="mt-3 text-[13px] text-[#8C847F]">
          Loading analytics...
        </p>
      </div>
    </div>
  );
}

function EmptyPanel({ text }) {
  return (
    <div className="grid min-h-[180px] place-items-center px-5 text-center">
      <div>
        <div className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
          <Icon
            name="folder"
            className="h-4 w-4"
          />
        </div>

        <p className="mt-3 text-[13px] leading-4 text-[#8C847F]">
          {text}
        </p>
      </div>
    </div>
  );
}

function Alert({
  tone,
  message,
}) {
  const success =
    tone === "success";

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

function buildAnalytics(
  cases,
  users,
  period,
) {
  const totalCases =
    cases.length;

  const activeCases =
    cases.filter((item) =>
      ACTIVE_CASE_STATUSES.includes(
        item.caseStatus,
      ),
    ).length;

  const closedCases =
    cases.filter(
      (item) =>
        item.caseStatus ===
        "Closed",
    ).length;

  const highRiskCases =
    cases.filter(
      (item) =>
        ACTIVE_CASE_STATUSES.includes(
          item.caseStatus,
        ) &&
        ["High", "Urgent"].includes(
          item.priorityLevel,
        ),
    ).length;

  const uniqueStudents =
    new Set(
      cases
        .map((item) =>
          getRecordId(item.student),
        )
        .filter(Boolean),
    ).size;

  const allFollowUps =
    cases.flatMap(
      (item) =>
        item.followUps || [],
    );

  const pendingFollowUps =
    allFollowUps.filter(
      (item) =>
        item.status ===
        "Pending",
    ).length;

  const overdueFollowUps =
    allFollowUps.filter(
      (item) =>
        item.status ===
          "Pending" &&
        isOverdue(
          item.followUpDate,
        ),
    ).length;

  const progressNotes =
    cases.reduce(
      (total, item) =>
        total +
        (item.progressNotes
          ?.length || 0),
      0,
    );

  const allPlans =
    cases.flatMap(
      (item) =>
        item.interventionPlans ||
        [],
    );

  const interventionPlans =
    allPlans.length;

  const approvedPlans =
    allPlans.filter(
      (plan) =>
        plan.approvalStatus ===
        "Approved",
    ).length;

  return {
    summary: {
      totalCases,
      activeCases,
      closedCases,
      highRiskCases,
      uniqueStudents,
      pendingFollowUps,
      overdueFollowUps,
      progressNotes,
      interventionPlans,
      approvedPlans,

      activeRate:
        percentage(
          activeCases,
          totalCases,
        ),

      closureRate:
        percentage(
          closedCases,
          totalCases,
        ),

      highRiskRate:
        percentage(
          highRiskCases,
          activeCases,
        ),
    },

    monthlyTrend:
      getMonthlyTrend(
        cases,
        period,
      ),

    statusDistribution:
      countByOrder(
        cases,
        (item) =>
          item.caseStatus ||
          "Unknown",
        STATUS_ORDER,
      ),

    domainDistribution:
      countByOrder(
        cases,
        (item) =>
          item.problemAssessment
            ?.mainDomain ||
          "Other",
        DOMAIN_ORDER,
      ),

    priorityDistribution:
      countByOrder(
        cases,
        (item) =>
          item.priorityLevel ||
          "Moderate",
        PRIORITY_ORDER,
      ),

    collegeDistribution:
      countAndSort(
        cases,
        (item) =>
          item.student?.college ||
          "Not recorded",
      ),

    programDistribution:
      countAndSort(
        cases,
        (item) =>
          item.student?.program ||
          "Not recorded",
      ),

    yearLevelDistribution:
        getYearLevelDistribution(cases),

    followUpOverview:
      getFollowUpOverview(
        allFollowUps,
      ),

    planDistribution:
      getPlanDistribution(
        allPlans,
      ),

    counselorWorkload:
      getCounselorWorkload(
        cases,
        users,
      ),

    primaryProblems:
      getPrimaryProblemCounts(
        cases,
      ),

    insights:
      buildInsights({
        cases,
        totalCases,
        activeCases,
        highRiskCases,
        overdueFollowUps,
        pendingFollowUps,
        interventionPlans,
        approvedPlans,
      }),
  };
}

function getMonthlyTrend(
  cases,
  period,
) {
  const today = new Date();

  let numberOfMonths = 12;

  if (period === "6-months") {
    numberOfMonths = 6;
  }

  if (
    period === "current-year"
  ) {
    numberOfMonths =
      today.getMonth() + 1;
  }

  if (period === "all-time") {
    const validDates =
      cases
        .map(
          (item) =>
            new Date(
              item.dateOpened ||
                item.createdAt,
            ),
        )
        .filter(
          (date) =>
            !Number.isNaN(
              date.getTime(),
            ),
        );

    if (validDates.length > 0) {
      const earliest =
        new Date(
          Math.min(
            ...validDates.map(
              (date) =>
                date.getTime(),
            ),
          ),
        );

      numberOfMonths =
        Math.min(
          monthsBetween(
            earliest,
            today,
          ) + 1,
          24,
        );
    } else {
      numberOfMonths = 12;
    }
  }

  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
      },
    );

  const months =
    Array.from(
      {
        length:
          numberOfMonths,
      },
      (_, index) => {
        const date =
          new Date(
            today.getFullYear(),
            today.getMonth() -
              (numberOfMonths -
                1 -
                index),
            1,
          );

        return {
          key: `${date.getFullYear()}-${date.getMonth()}`,
          shortLabel:
            formatter.format(date),
          label:
            new Intl.DateTimeFormat(
              "en-US",
              {
                month: "long",
                year: "numeric",
              },
            ).format(date),
          value: 0,
        };
      },
    );

  const map =
    new Map(
      months.map((item) => [
        item.key,
        item,
      ]),
    );

  cases.forEach((item) => {
    const date =
      new Date(
        item.dateOpened ||
          item.createdAt,
      );

    if (
      Number.isNaN(date.getTime())
    ) {
      return;
    }

    const key = `${date.getFullYear()}-${date.getMonth()}`;

    const month =
      map.get(key);

    if (month) {
      month.value += 1;
    }
  });

  return months;
}

function getFollowUpOverview(
  followUps,
) {
  const today =
    startOfDay(new Date());

  const tomorrow =
    new Date(today);

  tomorrow.setDate(
    tomorrow.getDate() + 1,
  );

  return {
    overdue:
      followUps.filter(
        (item) => {
          const date =
            new Date(
              item.followUpDate,
            );

          return (
            item.status ===
              "Pending" &&
            !Number.isNaN(
              date.getTime(),
            ) &&
            date < today
          );
        },
      ).length,

    dueToday:
      followUps.filter(
        (item) => {
          const date =
            new Date(
              item.followUpDate,
            );

          return (
            item.status ===
              "Pending" &&
            !Number.isNaN(
              date.getTime(),
            ) &&
            date >= today &&
            date < tomorrow
          );
        },
      ).length,

    upcoming:
      followUps.filter(
        (item) => {
          const date =
            new Date(
              item.followUpDate,
            );

          return (
            item.status ===
              "Pending" &&
            !Number.isNaN(
              date.getTime(),
            ) &&
            date >= tomorrow
          );
        },
      ).length,

    completed:
      followUps.filter(
        (item) =>
          item.status ===
          "Completed",
      ).length,
  };
}

function getPlanDistribution(
  plans,
) {
  const labels = [
    "Pending Review",
    "Approved",
    "Revised",
    "Rejected",
    "Sent to Student",
  ];

  const counts =
    new Map(
      labels.map((label) => [
        label,
        0,
      ]),
    );

  plans.forEach((plan) => {
    const approvalStatus =
      plan.approvalStatus ||
      "Pending Review";

    if (
      counts.has(
        approvalStatus,
      )
    ) {
      counts.set(
        approvalStatus,
        counts.get(
          approvalStatus,
        ) + 1,
      );
    }

    if (
      plan.isSentToStudent
    ) {
      counts.set(
        "Sent to Student",
        counts.get(
          "Sent to Student",
        ) + 1,
      );
    }
  });

  return labels.map(
    (label) => ({
      label,
      value:
        counts.get(label),
    }),
  );
}

function getCounselorWorkload(
  cases,
  users,
) {
  const records =
    new Map();

  users.forEach(
    (account) => {
      const id =
        String(
          account._id ||
            account.id,
        );

      records.set(id, {
        id,
        name:
          formatName(account) ||
          account.email ||
          "Counselor",
        email:
          account.email || "",
        colleges:
          (
            account.collegesHandled ||
            []
          ).join(", "),
        activeCases: 0,
        highPriority: 0,
        pendingFollowUps: 0,
        closedCases: 0,
      });
    },
  );

  cases.forEach(
    (caseRecord) => {
      const counselor =
        caseRecord.assignedCounselor;

      const id =
        getRecordId(
          counselor,
        );

      if (!id) return;

      if (!records.has(id)) {
        records.set(id, {
          id,
          name:
            typeof counselor ===
            "object"
              ? formatName(
                  counselor,
                ) ||
                counselor.email ||
                "Counselor"
              : "Counselor",
          email:
            typeof counselor ===
            "object"
              ? counselor.email ||
                ""
              : "",
          colleges: "",
          activeCases: 0,
          highPriority: 0,
          pendingFollowUps: 0,
          closedCases: 0,
        });
      }

      const record =
        records.get(id);

      if (
        ACTIVE_CASE_STATUSES.includes(
          caseRecord.caseStatus,
        )
      ) {
        record.activeCases += 1;
      }

      if (
        ACTIVE_CASE_STATUSES.includes(
          caseRecord.caseStatus,
        ) &&
        ["High", "Urgent"].includes(
          caseRecord.priorityLevel,
        )
      ) {
        record.highPriority += 1;
      }

      if (
        caseRecord.caseStatus ===
        "Closed"
      ) {
        record.closedCases += 1;
      }

      record.pendingFollowUps +=
        (
          caseRecord.followUps ||
          []
        ).filter(
          (item) =>
            item.status ===
            "Pending",
        ).length;
    },
  );

  return Array.from(
    records.values(),
  ).sort(
    (first, second) =>
      second.activeCases -
      first.activeCases,
  );
}

function getPrimaryProblemCounts(
  cases,
) {
  const counts =
    new Map();

  cases.forEach(
    (caseRecord) => {
      const problems =
        caseRecord
          .problemAssessment
          ?.primaryProblems ||
        [];

      problems.forEach(
        (problem) => {
          const original =
            String(problem || "")
              .trim();

          if (!original) return;

          const normalized =
            original
              .toLowerCase()
              .replace(
                /\s+/g,
                " ",
              );

          const existing =
            counts.get(normalized);

          counts.set(
            normalized,
            {
              label:
                existing?.label ||
                toTitleCase(
                  original,
                ),
              value:
                (existing?.value ||
                  0) + 1,
            },
          );
        },
      );
    },
  );

  return Array.from(
    counts.values(),
  ).sort(
    (first, second) =>
      second.value -
        first.value ||
      first.label.localeCompare(
        second.label,
      ),
  );
}

function buildInsights({
  cases,
  totalCases,
  activeCases,
  highRiskCases,
  overdueFollowUps,
  pendingFollowUps,
  interventionPlans,
  approvedPlans,
}) {
  const topDomain =
    countAndSort(
      cases,
      (item) =>
        item.problemAssessment
          ?.mainDomain ||
        "Other",
    )[0];

  const casesWithoutPlans =
    cases.filter(
      (item) =>
        ACTIVE_CASE_STATUSES.includes(
          item.caseStatus,
        ) &&
        (
          item.interventionPlans ||
          []
        ).length === 0,
    ).length;

  const casesWithoutNotes =
    cases.filter(
      (item) =>
        ACTIVE_CASE_STATUSES.includes(
          item.caseStatus,
        ) &&
        (
          item.progressNotes ||
          []
        ).length === 0,
    ).length;

  return [
    {
      title:
        "Most common domain",
      message:
        topDomain
          ? `${topDomain.label} currently has the highest number of filtered cases with ${topDomain.value}.`
          : "No case-domain data is available for the selected filters.",
      icon: "folder",
      tone:
        "border-violet-200 bg-violet-50 text-violet-800",
    },

    {
      title:
        "Follow-up attention",
      message:
        pendingFollowUps > 0
          ? `${pendingFollowUps} pending follow-ups remain, including ${overdueFollowUps} overdue.`
          : "There are no pending follow-ups in the filtered records.",
      icon: "calendar",
      tone:
        overdueFollowUps > 0
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
    },

    {
      title:
        "Intervention planning coverage",
      message:
        activeCases > 0
          ? `${casesWithoutPlans} active cases currently have no intervention plan. ${approvedPlans} of ${interventionPlans} plans are approved.`
          : "There are no active cases in the selected filters.",
      icon: "heart",
      tone:
        "border-blue-200 bg-blue-50 text-blue-800",
    },

    {
      title:
        "Documentation coverage",
      message:
        activeCases > 0
          ? `${casesWithoutNotes} active cases currently have no progress notes.`
          : "There are no active cases in the selected filters.",
      icon: "notes",
      tone:
        "border-amber-200 bg-amber-50 text-amber-800",
    },

    {
      title:
        "High-priority monitoring",
      message:
        totalCases > 0
          ? `${highRiskCases} active cases are marked High or Urgent and may require closer monitoring.`
          : "No cases match the selected filters.",
      icon:
        "alertTriangle",
      tone:
        highRiskCases > 0
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
  ];
}

function countByOrder(
  records,
  accessor,
  order,
) {
  const counts =
    new Map(
      order.map((label) => [
        label,
        0,
      ]),
    );

  records.forEach(
    (record) => {
      const label =
        accessor(record);

      if (!counts.has(label)) {
        counts.set(label, 0);
      }

      counts.set(
        label,
        counts.get(label) + 1,
      );
    },
  );

  return Array.from(
    counts.entries(),
  ).map(
    ([label, value]) => ({
      label,
      value,
    }),
  );
}

function countAndSort(
  records,
  accessor,
) {
  const counts =
    new Map();

  records.forEach(
    (record) => {
      const label =
        accessor(record);

      counts.set(
        label,
        (counts.get(label) ||
          0) + 1,
      );
    },
  );

  return Array.from(
    counts.entries(),
  )
    .map(
      ([label, value]) => ({
        label,
        value,
      }),
    )
    .sort(
      (first, second) =>
        second.value -
        first.value,
    );
}
function getYearLevelDistribution(cases) {
  const YEAR_LEVEL_ORDER = [
    "1st Year",
    "2nd Year",
    "3rd Year",
    "4th Year",
    "5th Year",
    "Graduate",
    "Other",
    "Not recorded",
  ];

  const counts = new Map(
    YEAR_LEVEL_ORDER.map((label) => [
      label,
      0,
    ]),
  );

  cases.forEach((caseRecord) => {
    const label = formatYearLevel(
      caseRecord.student?.yearLevel,
    );

    if (!counts.has(label)) {
      counts.set(label, 0);
    }

    counts.set(
      label,
      counts.get(label) + 1,
    );
  });

  return Array.from(counts.entries())
    .map(([label, value]) => ({
      label,
      value,
    }))
    .filter((item) => item.value > 0);
}

function formatYearLevel(value) {
    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {
        return "Not recorded";
    }

    const normalized = String(value)
        .trim()
        .toLowerCase();

    const labels = {
        "1": "1st Year",
        "1st": "1st Year",
        "1st year": "1st Year",
        "first year": "1st Year",

        "2": "2nd Year",
        "2nd": "2nd Year",
        "2nd year": "2nd Year",
        "second year": "2nd Year",

        "3": "3rd Year",
        "3rd": "3rd Year",
        "3rd year": "3rd Year",
        "third year": "3rd Year",

        "4": "4th Year",
        "4th": "4th Year",
        "4th year": "4th Year",
        "fourth year": "4th Year",

        "5": "5th Year",
        "5th": "5th Year",
        "5th year": "5th Year",
        "fifth year": "5th Year",

        graduate: "Graduate",
        postgraduate: "Graduate",

        other: "Other",
    };

    return labels[normalized] || "Other";
}
function getPeriodRange(
  period,
) {
  const now = new Date();

  if (
    period === "all-time"
  ) {
    return {
      start: null,
    };
  }

  if (
    period === "current-year"
  ) {
    return {
      start: new Date(
        now.getFullYear(),
        0,
        1,
      ),
    };
  }

  const months =
    period === "6-months"
      ? 6
      : 12;

  return {
    start: new Date(
      now.getFullYear(),
      now.getMonth() -
        (months - 1),
      1,
    ),
  };
}

function getPeriodLabel(
  period,
) {
  return (
    PERIOD_OPTIONS.find(
      (option) =>
        option.value === period,
    )?.label || "Filtered period"
  );
}

function percentage(
  value,
  total,
) {
  if (!total) return 0;

  return Math.round(
    (value / total) * 100,
  );
}

function isOverdue(value) {
  if (!value) return false;

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return false;
  }

  return (
    date <
    startOfDay(new Date())
  );
}

function startOfDay(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

function monthsBetween(
  first,
  second,
) {
  return (
    (second.getFullYear() -
      first.getFullYear()) *
      12 +
    second.getMonth() -
    first.getMonth()
  );
}

function getRecordId(record) {
  if (!record) return "";

  if (
    typeof record === "string"
  ) {
    return record;
  }

  return String(
    record._id ||
      record.id ||
      "",
  );
}

function formatName(person) {
  return [
    person?.firstName,
    person?.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDateTime(value) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function getDistributionTone(label) {
  const tones = {
    Open: "bg-blue-500",
    "In Progress":
      "bg-amber-500",
    "For Follow-up":
      "bg-violet-500",
    Closed:
      "bg-emerald-500",
    Terminated:
      "bg-red-500",
    "Pending Review":
      "bg-amber-500",
    Approved:
      "bg-emerald-500",
    Revised:
      "bg-blue-500",
    Rejected:
      "bg-red-500",
    "Sent to Student":
      "bg-violet-500",
  };

  return (
    tones[label] ||
    "bg-slate-400"
  );
}

const filterClass =
  "h-8 w-full rounded-lg border border-[#DDD8D4] bg-white px-2.5 text-[13px] text-[#302B28] outline-none focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";

const tableHeadClass =
  "px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8E8681]";

const tableCellClass =
  "px-4 py-3";