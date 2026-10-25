import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";
const ADMIN_ROLE = "Counselor-Admin";
const COUNSELOR_ROLE = "Counselor-User";
const ACTIVE_STATUSES = ["Open", "In Progress", "For Follow-up"];
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const isAdmin = user?.role === ADMIN_ROLE;
  const isCounselor = user?.role === COUNSELOR_ROLE;
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);
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
  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setPageError("");
    try {
      if (isAdmin) {
        const [caseData, userData] = await Promise.all([
          apiRequest("/cases", { method: "GET" }),
          apiRequest("/users?isActive=true", { method: "GET" }),
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
    } catch (error) {
      console.error("Unable to load dashboard:", error);
      if (error.status === 401) {
        clearUser();
        navigate("/login", { replace: true });
        return;
      }
      setPageError(error.message || "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, clearUser, navigate]);
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);
  if (!user || user.mustChangePassword === true || user.profileCompleted === false) {
    return null;
  }
  if (!isAdmin && !isCounselor) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F6F4] px-5">
        <section className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
          <h1 className="text-[32px] font-semibold text-red-700">Unrecognized account role</h1>
          <p className="mt-3 text-[22px] text-[#756E69]">Your account returned the role:</p>
          <p className="mt-1 text-[22px] font-semibold text-[#2E2926]">{String(user.role)}</p>
          <button
            type="button"
            onClick={() => {
              clearUser();
              navigate("/login", { replace: true });
            }}
            className="mt-6 rounded-xl bg-[#8C1518] px-5 py-3 text-[22px] font-semibold text-white"
          >
            Return to login
          </button>
        </section>
      </main>
    );
  }
  const summaryCards = isAdmin ? getAdminCards(cases, users) : getCounselorCards(cases);
  const attentionCases = getAttentionCases(cases);
  const highPriorityCaseCount = cases.filter(
    (item) =>
      ACTIVE_STATUSES.includes(item.caseStatus) &&
      item.isArchived !== true &&
      ["High", "Urgent"].includes(item.priorityLevel)
  ).length;
  const counselorLoads = isAdmin ? getCounselorLoads(cases, users) : [];
  const monthlyTrend = getMonthlyTrend(cases);
  const followUpReminders = getFollowUpReminders(cases);
  const {
    overdue: overdueFollowUps,
    dueToday: dueTodayFollowUps,
    upcoming: upcomingFollowUps,
  } = followUpReminders;
  const quickActions = isAdmin
    ? [
        { icon: "plus", label: "New case", path: "/cases/new" },
        { icon: "search", label: "Retrieve case", path: "/cases" },
        { icon: "userPlus", label: "Create user", path: "/users" },
        { icon: "heart", label: "Interventions", path: "/intervention-plans" },
      ]
    : [
        { icon: "plus", label: "New case", path: "/cases/new" },
        { icon: "search", label: "Retrieve case", path: "/cases" },
        { icon: "student", label: "Student records", path: "/students" },
        { icon: "notes", label: "Progress notes", path: "/progress-notes" },
      ];
  return (
    <div className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#262220]">
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex w-full items-center justify-between gap-4">
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
                <h1 className="text-[20px] font-semibold">Dashboard</h1>
                <p className="hidden text-[15px] text-[#99918C] sm:block">
                  {isAdmin
                    ? "Office-wide case and counselor overview"
                    : "Overview of your assigned cases"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadDashboardData}
                disabled={isLoading}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#E4DFDC] bg-white text-[#625C58] hover:text-[#8C1518] disabled:opacity-50"
                aria-label="Refresh dashboard"
              >
                <Icon name="history" className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </header>
        <main className="page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7">
          {pageError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-700">
              {pageError}
            </div>
          )}
          <section>
            <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[32px]">
              {isAdmin
                ? `Welcome to My.GUIDE, ${user.firstName}!`
                : `${greeting}, ${user.firstName}.`}
            </h2>
            <p className="mt-1 text-[16px] leading-5 text-[#8A837F]">
              {isAdmin
                ? "Here is the current office-wide counseling overview."
                : "Here is the current overview of your assigned cases."}{" "}
              {formatCurrentDate()}.
            </p>
          </section>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <SummaryCard key={card.label} card={card} loading={isLoading} />
            ))}
          </div>
          <section className="mt-5">
            <h3 className="text-[17px] font-semibold text-[#49433F]">Quick actions</h3>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="group flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-xl border border-[#E5E1DE] bg-white px-3 py-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(45,30,25,0.06)]"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#F5EAEA] text-[#8C1518] group-hover:bg-[#8C1518] group-hover:text-white">
                    <Icon name={action.icon} className="h-4 w-4" />
                  </div>
                  <span className="text-[16px] font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="mt-5">
            <div className="mb-2.5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-[17px] font-semibold text-[#49433F]">Follow-up reminders</h3>
                <p className="mt-1 text-[14px] text-[#938B86]">
                  Review overdue, due-today, and upcoming follow-up actions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/follow-ups")}
                className="self-start !text-[20px] font-medium text-[#9A171B] sm:self-auto"
              >
                View all follow-ups →
              </button>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <FollowUpReminderPanel
                title="Overdue"
                count={overdueFollowUps.length}
                tone="red"
                emptyText="No overdue follow-ups."
                items={overdueFollowUps}
                loading={isLoading}
                onOpen={(item) => navigate(`/follow-ups?caseId=${item.caseId}`)}
              />
              <FollowUpReminderPanel
                title="Due today"
                count={dueTodayFollowUps.length}
                tone="gold"
                emptyText="No follow-ups are due today."
                items={dueTodayFollowUps}
                loading={isLoading}
                onOpen={(item) => navigate(`/follow-ups?caseId=${item.caseId}`)}
              />
              <FollowUpReminderPanel
                title="Upcoming"
                count={upcomingFollowUps.length}
                tone="blue"
                emptyText="No upcoming follow-ups are scheduled."
                items={upcomingFollowUps}
                loading={isLoading}
                onOpen={(item) => navigate(`/follow-ups?caseId=${item.caseId}`)}
              />
            </div>
          </section>
          {isAdmin && !isLoading && highPriorityCaseCount > 0 && (
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#A61E23] text-white">
                  <Icon name="alertTriangle" className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[17px] font-semibold text-[#912127]">
                    {highPriorityCaseCount} high-priority case
                    {highPriorityCaseCount === 1 ? " needs" : "s need"} attention
                  </p>
                  <p className="mt-1 text-[15px] text-[#A6575A]">
                    Active cases marked High or Urgent require attention.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/cases")}
                className="rounded-lg bg-[#A61E23] px-4 py-2 font-semibold text-white"
                style={{ fontSize: "15px" }}
              >
                Review cases
              </button>
            </div>
          )}
          <div className="mt-3 grid gap-5 xl:grid-cols-[1.25fr_0.85fr] !text-[20px]">
            <Panel
              title={isAdmin ? "Cases needing attention" : "Needs your attention"}
              action="View all"
              onAction={() => navigate("/cases")}
            >
              {isLoading ? (
                <LoadingPanel />
              ) : attentionCases.length === 0 ? (
                <EmptyPanel text="No follow-up cases need attention." />
              ) : (
                <div className="divide-y divide-[#EEEAE7]">
                  {attentionCases.map((caseItem) => (
                    <button
                      key={caseItem._id || caseItem.id}
                      type="button"
                      onClick={() => navigate(`/cases/${caseItem._id || caseItem.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#FCFBFA]"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold">
                          {formatName(caseItem.student) || "Student unavailable"} ·{" "}
                          {caseItem.caseNumber || "Case"}
                        </p>
                        <p className="mt-1 truncate text-[14px] text-[#99918D]">
                          {caseItem.problemAssessment?.mainDomain || "No domain"} ·{" "}
                          {caseItem.caseStatus || "Open"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
            <Panel
              title={isAdmin ? "Counselor caseload" : "Your cases at a glance"}
              action={isAdmin ? "Manage users" : null}
              onAction={isAdmin ? () => navigate("/users") : undefined}
            >
              {isLoading ? (
                <LoadingPanel />
              ) : isAdmin ? (
                counselorLoads.length === 0 ? (
                  <EmptyPanel text="No active counselors were returned." />
                ) : (
                  <div className="divide-y divide-[#EEEAE7]">
                    {counselorLoads.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-[#8C1518] text-[14px] font-semibold text-white">
                          {getInitials(item.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[16px] font-semibold">{item.name}</p>
                          <p className="mt-1 text-[14px] text-[#99918D]">
                            {item.activeCases} active · {item.highPriority} high or urgent
                          </p>
                        </div>
                        <div className="w-16">
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#EEEAE7]">
                            <div
                              className="h-full rounded-full bg-[#8C1518]"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="divide-y divide-[#EEEAE7]">
                  {summaryCards.map((card) => (
                    <div key={card.label} className="flex items-center justify-between px-4 py-3">
                      <span className="text-[15px] text-[#847D79]">{card.label}</span>
                      <span className="text-[17px] font-semibold text-[#8C1518]">{card.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
          {!isAdmin && (
            <div className="mt-5">
              <Panel
                title="Cases opened in the last six months"
                action="Full analytics"
                onAction={() => navigate("/analytics")}
              >
                {isLoading ? <LoadingPanel /> : <TrendChart data={monthlyTrend} />}
              </Panel>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
function FollowUpReminderPanel({ title, count, tone, emptyText, items, loading, onOpen }) {
  const toneStyles = {
    red: {
      border: "border-red-200",
      header: "bg-red-50",
      icon: "bg-red-100 text-red-700",
      count: "bg-red-100 text-red-700",
      date: "text-red-700",
    },
    gold: {
      border: "border-amber-200",
      header: "bg-amber-50",
      icon: "bg-amber-100 text-amber-700",
      count: "bg-amber-100 text-amber-700",
      date: "text-amber-700",
    },
    blue: {
      border: "border-blue-200",
      header: "bg-blue-50",
      icon: "bg-blue-100 text-blue-700",
      count: "bg-blue-100 text-blue-700",
      date: "text-blue-700",
    },
  };
  const styles = toneStyles[tone] || toneStyles.blue;
  return (
    <section className={`overflow-hidden rounded-xl border bg-white ${styles.border}`}>
      <header
        className={`flex h-[48px] items-center justify-between border-b px-4 ${styles.header} ${styles.border}`}
      >
        <div className="flex items-center gap-2">
          <div className={`grid h-7 w-7 place-items-center rounded-lg ${styles.icon}`}>
            <Icon name={tone === "red" ? "alertTriangle" : "calendar"} className="h-3.5 w-3.5" />
          </div>
          <h4 className="text-[16px] font-semibold">{title}</h4>
        </div>
        <span className={`rounded-full px-2 py-1 text-[14px] font-semibold ${styles.count}`}>
          {count}
        </span>
      </header>
      {loading ? (
        <div className="grid min-h-[170px] place-items-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />
        </div>
      ) : items.length === 0 ? (
        <div className="grid min-h-[170px] place-items-center px-5 text-center">
          <p className="text-[15px] text-[#8C847F]">{emptyText}</p>
        </div>
      ) : (
        <div className="max-h-[285px] divide-y divide-[#EEEAE7] overflow-y-auto">
          {items.map((item) => (
            <button
              key={`${item.caseId}-${item.followUpId}`}
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#FCFBFA]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{item.studentName}</p>
                <p className="mt-1 truncate text-[14px] text-[#99918D]">
                  {item.caseNumber} · {item.followUpType}
                </p>
                <p className="mt-1 truncate text-[14px] text-[#756E69]">{item.purpose}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-[14px] font-semibold ${styles.date}`}>
                  {formatFollowUpDate(item.followUpDate)}
                </p>
                <p className="mt-1 text-[14px] text-[#99918D]">
                  {formatFollowUpTime(item.followUpDate)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function SummaryCard({ card, loading }) {
  const tones = {
    maroon: "border-[#A62A2E]/60 bg-[#F4E8E8] text-[#8C1518]",
    green: "border-[#5E8F3A]/60 bg-[#EAF4E5] text-[#398322]",
    gold: "border-[#D2A92D]/60 bg-[#FAF3DC] text-[#A47900]",
    blue: "border-[#3E79BA]/60 bg-[#EAF1F8] text-[#316FAE]",
    red: "border-[#D05A5E]/60 bg-[#FBE7E8] text-[#B1252A]",
  };
  const [border, background, text] = tones[card.tone].split(" ");
  return (
    <article className={`rounded-xl border bg-white p-4 ${border}`}>
      <div className="flex items-start justify-between">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${background} ${text}`}>
          <Icon name={card.icon} className="h-4 w-4" />
        </div>
        <span className="text-[14px] font-medium text-[#8C1518]">{card.note}</span>
      </div>
      <p className="mt-3 text-[15px] text-[#8D8580]">{card.label}</p>
      {loading ? (
        <div className="mt-2 h-6 w-12 animate-pulse rounded bg-[#EEEAE7]" />
      ) : (
        <p className="mt-1 text-[32px] font-semibold">{card.value}</p>
      )}
    </article>
  );
}
function Panel({ title, action, onAction, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#E6E2DF] bg-white">
      <header className="flex h-[46px] items-center justify-between border-b border-[#ECE8E5] px-4">
        <h3 className="text-[17px] font-semibold">{title}</h3>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="text-[15px] font-medium text-[#9A171B]"
          >
            {action} →
          </button>
        )}
      </header>
      {children}
    </section>
  );
}
function LoadingPanel() {
  return (
    <div className="grid min-h-[180px] place-items-center">
      <div className="text-center">
        <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />
        <p className="mt-3 text-[15px] text-[#8C847F]">Loading...</p>
      </div>
    </div>
  );
}
function EmptyPanel({ text }) {
  return (
    <div className="grid min-h-[180px] place-items-center px-5 text-center">
      <div>
        <div className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
          <Icon name="folder" className="h-4 w-4" />
        </div>
        <p className="mt-3 text-[15px] text-[#8C847F]">{text}</p>
      </div>
    </div>
  );
}
function TrendChart({ data }) {
  const maximum = Math.max(...data.map((item) => item.value), 1);
  const hasData = data.some((item) => item.value > 0);
  if (!hasData) {
    return <EmptyPanel text="No cases were opened during the displayed months." />;
  }
  return (
    <div className="px-4 pb-4 pt-5">
      <div className="flex h-[140px] items-end gap-3">
        {data.map((item) => (
          <div key={item.key} className="flex h-full flex-1 flex-col justify-end">
            <div className="flex flex-1 items-end">
              <div
                className="w-full rounded-t-md bg-[#A93D40]"
                style={{
                  height:
                    item.value === 0 ? "0%" : `${Math.max((item.value / maximum) * 100, 12)}%`,
                }}
                title={`${item.month}: ${item.value} cases`}
              />
            </div>
            <p className="mt-2 text-center text-[14px] text-[#9D9691]">{item.month}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
function getFollowUpReminders(cases) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const followUps = cases
    .filter((caseItem) => caseItem.isArchived !== true && caseItem.caseStatus !== "Terminated")
    .flatMap((caseItem) =>
      (caseItem.followUps || [])
        .filter((followUp) => followUp.status === "Pending")
        .map((followUp) => ({
          caseId: caseItem._id || caseItem.id,
          caseNumber: caseItem.caseNumber || "Case",
          studentName: formatName(caseItem.student) || "Student unavailable",
          followUpId: followUp._id,
          followUpDate: followUp.followUpDate,
          followUpType: followUp.followUpType || "Follow-up",
          purpose: followUp.purpose || "No purpose recorded",
        }))
    )
    .filter((item) => {
      const date = new Date(item.followUpDate);
      return !Number.isNaN(date.getTime());
    });
  const overdue = followUps
    .filter((item) => {
      const date = new Date(item.followUpDate);
      return date < startOfToday;
    })
    .sort((first, second) => new Date(first.followUpDate) - new Date(second.followUpDate))
    .slice(0, 5);
  const dueToday = followUps
    .filter((item) => {
      const date = new Date(item.followUpDate);
      return date >= startOfToday && date < startOfTomorrow;
    })
    .sort((first, second) => new Date(first.followUpDate) - new Date(second.followUpDate))
    .slice(0, 5);
  const upcoming = followUps
    .filter((item) => {
      const date = new Date(item.followUpDate);
      return date >= startOfTomorrow;
    })
    .sort((first, second) => new Date(first.followUpDate) - new Date(second.followUpDate))
    .slice(0, 5);
  return {
    overdue,
    dueToday,
    upcoming,
  };
}
function formatFollowUpDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const isSameDay = (first, second) =>
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();
  if (isSameDay(date, today)) {
    return "Today";
  }
  if (isSameDay(date, tomorrow)) {
    return "Tomorrow";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  }).format(date);
}
function formatFollowUpTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
function getAdminCards(cases, users) {
  return [
    {
      label: "Active cases",
      value: cases.filter((item) => ACTIVE_STATUSES.includes(item.caseStatus)).length,
      icon: "folder",
      tone: "maroon",
      note: "Current",
    },
    {
      label: "Pending follow-up",
      value: cases.filter((item) => item.caseStatus === "For Follow-up").length,
      icon: "calendar",
      tone: "gold",
      note: "Current",
    },
    {
      label: "Closed cases",
      value: cases.filter((item) => item.caseStatus === "Closed").length,
      icon: "checkSquare",
      tone: "green",
      note: "Current",
    },
    {
      label: "Active counselors",
      value: users.length,
      icon: "users",
      tone: "blue",
      note: "Current",
    },
  ];
}
function getCounselorCards(cases) {
  return [
    {
      label: "My active cases",
      value: cases.filter((item) => ACTIVE_STATUSES.includes(item.caseStatus)).length,
      icon: "folder",
      tone: "maroon",
      note: "Current",
    },
    {
      label: "High-priority cases",
      value: cases.filter(
        (item) =>
          ACTIVE_STATUSES.includes(item.caseStatus) &&
          ["High", "Urgent"].includes(item.priorityLevel)
      ).length,
      icon: "alertTriangle",
      tone: "red",
      note: "Active",
    },
    {
      label: "Pending follow-up",
      value: cases.filter((item) => item.caseStatus === "For Follow-up").length,
      icon: "calendar",
      tone: "gold",
      note: "Current",
    },
    {
      label: "Recent updates",
      value: cases.filter((item) => isWithinDays(item.updatedAt, 7)).length,
      icon: "history",
      tone: "blue",
      note: "Last 7 days",
    },
  ];
}
function getAttentionCases(cases) {
  return cases
    .filter((item) => item.caseStatus === "For Follow-up" && item.isArchived !== true)
    .sort((first, second) => new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0))
    .slice(0, 5);
}
function getCounselorLoads(cases, users) {
  const records = new Map();
  users.forEach((account) => {
    const id = account._id || account.id;
    records.set(String(id), {
      id,
      name: formatName(account) || account.email || "Counselor",
      activeCases: 0,
      highPriority: 0,
    });
  });
  cases.forEach((caseItem) => {
    if (!ACTIVE_STATUSES.includes(caseItem.caseStatus)) {
      return;
    }
    const counselor = caseItem.assignedCounselor;
    const id = typeof counselor === "object" ? counselor?._id || counselor?.id : counselor;
    if (!id) return;
    const key = String(id);
    if (!records.has(key)) {
      records.set(key, {
        id,
        name:
          typeof counselor === "object"
            ? formatName(counselor) || counselor.email || "Counselor"
            : "Counselor",
        activeCases: 0,
        highPriority: 0,
      });
    }
    const record = records.get(key);
    record.activeCases += 1;
    if (["High", "Urgent"].includes(caseItem.priorityLevel)) {
      record.highPriority += 1;
    }
  });
  const result = Array.from(records.values());
  const maximum = Math.max(...result.map((item) => item.activeCases), 1);
  return result
    .map((item) => ({
      ...item,
      percentage: (item.activeCases / maximum) * 100,
    }))
    .sort((first, second) => second.activeCases - first.activeCases)
    .slice(0, 5);
}
function getMonthlyTrend(cases) {
  const today = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: formatter.format(date),
      value: 0,
    };
  });
  const map = new Map(months.map((item) => [item.key, item]));
  cases.forEach((caseItem) => {
    const date = new Date(caseItem.dateOpened || caseItem.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const item = map.get(key);
    if (item) item.value += 1;
  });
  return months;
}
function isWithinDays(value, days) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const difference = Date.now() - date.getTime();
  return difference >= 0 && difference <= days * 24 * 60 * 60 * 1000;
}
function formatName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(" ");
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
function formatCurrentDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}
