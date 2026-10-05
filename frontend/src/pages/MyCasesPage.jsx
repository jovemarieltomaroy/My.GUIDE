import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";
const COUNSELOR_CASES_ENDPOINT = "/cases/my-cases";
const TEMPORARY_CASES_ENDPOINT = "/cases/temporary-access";
const ADMIN_CASES_ENDPOINT = "/cases";

const STATUS_OPTIONS = [
  "Open",
  "In Progress",
  "For Follow-up",
  "Closed",
  "Terminated",
];

const PRIORITY_OPTIONS = [
  "Low",
  "Moderate",
  "High",
  "Urgent",
];

export default function MyCasesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    clearUser,
  } = useAuth();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);
  const [assignedCases, setAssignedCases] =
    useState([]);
  const [temporaryCases, setTemporaryCases] =
    useState([]);
  const [searchInput, setSearchInput] =
    useState("");
  const [searchQuery, setSearchQuery] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState("");
  const [priorityFilter, setPriorityFilter] =
    useState("");
  const [isLoading, setIsLoading] =
    useState(true);
  const [pageError, setPageError] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState(
      location.state?.successMessage || "",
    );

  const isAdmin =
    user?.role === ADMIN_ROLE;

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
      setSearchQuery(searchInput.trim());
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [successMessage]);

  const fetchCases = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setPageError("");

    try {
      const parameters = new URLSearchParams();

      if (searchQuery) {
        parameters.set("search", searchQuery);
      }

      const queryString = parameters.toString();
      const querySuffix = queryString ? `?${queryString}` : "";

      if (isAdmin) {
        const data = await apiRequest(
          `${ADMIN_CASES_ENDPOINT}${querySuffix}`,
          {
            method: "GET",
          },
        );

        if (!Array.isArray(data)) {
          throw new Error(
            "The backend returned an invalid cases response.",
          );
        }

        setAssignedCases(
          data.map((caseItem) => ({
            ...caseItem,
            accessType: "Admin access",
          })),
        );

        setTemporaryCases([]);
      } else {
        const [assignedResult, temporaryResult] =
          await Promise.allSettled([
            apiRequest(
              `${COUNSELOR_CASES_ENDPOINT}${querySuffix}`,
              {
                method: "GET",
              },
            ),
            apiRequest(
              `${TEMPORARY_CASES_ENDPOINT}${querySuffix}`,
              {
                method: "GET",
              },
            ),
          ]);

        if (
          assignedResult.status === "rejected" &&
          assignedResult.reason?.status === 401
        ) {
          clearUser();
          navigate("/login", {
            replace: true,
          });
          return;
        }

        if (
          temporaryResult.status === "rejected" &&
          temporaryResult.reason?.status === 401
        ) {
          clearUser();
          navigate("/login", {
            replace: true,
          });
          return;
        }

        const assignedData =
          assignedResult.status === "fulfilled" &&
          Array.isArray(assignedResult.value)
            ? assignedResult.value
            : [];

        const temporaryData =
          temporaryResult.status === "fulfilled" &&
          Array.isArray(temporaryResult.value)
            ? temporaryResult.value
            : [];

        if (assignedResult.status === "rejected") {
          console.error(
            "Unable to retrieve assigned cases:",
            assignedResult.reason,
          );
        }

        if (temporaryResult.status === "rejected") {
          console.error(
            "Unable to retrieve temporary-access cases:",
            temporaryResult.reason,
          );
        }

        const assignedIds = new Set(
          assignedData.map((caseItem) =>
            String(caseItem._id || caseItem.id),
          ),
        );

        const uniqueTemporaryCases =
          temporaryData.filter(
            (caseItem) =>
              !assignedIds.has(
                String(caseItem._id || caseItem.id),
              ),
          );

        setAssignedCases(
          assignedData.map((caseItem) => ({
            ...caseItem,
            accessType: "Assigned",
          })),
        );

        setTemporaryCases(
          uniqueTemporaryCases.map((caseItem) => {
            const activeAccess =
              getCurrentUserTemporaryAccess(
                caseItem,
                user._id,
              );

            return {
              ...caseItem,
              accessType: "Temporary",
              activeTemporaryAccess:
                activeAccess || null,
            };
          }),
        );

        if (
          assignedResult.status === "rejected" &&
          temporaryResult.status === "rejected"
        ) {
          throw new Error(
            "Unable to retrieve assigned or temporary-access cases.",
          );
        }
      }
    } catch (error) {
      console.error(
        "Unable to retrieve cases:",
        error,
      );

      if (error.status === 401) {
        clearUser();

        navigate("/login", {
          replace: true,
        });

        return;
      }

      setPageError(
        error.message ||
          "Unable to retrieve cases.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    user,
    isAdmin,
    searchQuery,
    clearUser,
    navigate,
  ]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  if (!user) {
    return null;
  }

  const filteredAssignedCases =
    useMemo(() => {
      return assignedCases.filter(
        (caseItem) => {
          const matchesStatus =
            !statusFilter ||
            caseItem.caseStatus === statusFilter;

          const matchesPriority =
            !priorityFilter ||
            caseItem.priorityLevel === priorityFilter;

          return matchesStatus && matchesPriority;
        },
      );
    }, [
      assignedCases,
      statusFilter,
      priorityFilter,
    ]);

  const filteredTemporaryCases =
    useMemo(() => {
      return temporaryCases.filter(
        (caseItem) => {
          const matchesStatus =
            !statusFilter ||
            caseItem.caseStatus === statusFilter;

          const matchesPriority =
            !priorityFilter ||
            caseItem.priorityLevel === priorityFilter;

          return matchesStatus && matchesPriority;
        },
      );
    }, [
      temporaryCases,
      statusFilter,
      priorityFilter,
    ]);

  const allVisibleCases = useMemo(
    () => [
      ...filteredAssignedCases,
      ...filteredTemporaryCases,
    ],
    [
      filteredAssignedCases,
      filteredTemporaryCases,
    ],
  );

  const summary = useMemo(() => {
    const allCases = [
      ...assignedCases,
      ...temporaryCases,
    ];

    return allCases.reduce(
      (result, caseItem) => {
        result.total += 1;

        if (
          [
            "Open",
            "In Progress",
            "For Follow-up",
          ].includes(caseItem.caseStatus)
        ) {
          result.active += 1;
        }

        if (
          caseItem.caseStatus ===
          "For Follow-up"
        ) {
          result.followUp += 1;
        }

        if (
          ["High", "Urgent"].includes(
            caseItem.priorityLevel,
          )
        ) {
          result.highPriority += 1;
        }

        if (
          caseItem.accessType ===
          "Temporary"
        ) {
          result.temporary += 1;
        }

        return result;
      },
      {
        total: 0,
        active: 0,
        followUp: 0,
        highPriority: 0,
        temporary: 0,
      },
    );
  }, [assignedCases, temporaryCases]);

  return (
    <div className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#2F2A27]">
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

              <div>
                <h1 className="text-[20px] font-semibold">
                  {isAdmin
                    ? "All Cases"
                    : "My Cases"}
                </h1>

                <p className="hidden text-[15px] text-[#99918C] sm:block">
                  {isAdmin
                    ? "View active cases across the counseling office"
                    : "View your assigned cases and cases shared through temporary access"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/cases/new")
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013]"
              style={{ fontSize: "15px" }}
            >
              <Icon
                name="plus"
                className="h-3 w-3"
              />
              New case
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7">
          {successMessage && (
            <Alert
              type="success"
              message={successMessage}
            />
          )}

          {pageError && (
            <Alert
              type="error"
              message={pageError}
            />
          )}

          <section>
            <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
              {isAdmin
                ? "Case management"
                : "Your case access"}
            </h2>

            <p className="mt-1 text-[15px] leading-4 text-[#89817D]">
              Search records, filter the list, and open a case to continue documentation.
            </p>
          </section>

          <div
            className={`mt-5 grid gap-3 sm:grid-cols-2 ${
              isAdmin
                ? "xl:grid-cols-4"
                : "xl:grid-cols-5"
            }`}
          >
            <SummaryCard
              label="Total cases"
              value={summary.total}
              icon="folder"
              tone="maroon"
            />

            <SummaryCard
              label="Active cases"
              value={summary.active}
              icon="checkSquare"
              tone="green"
            />

            <SummaryCard
              label="For follow-up"
              value={summary.followUp}
              icon="calendar"
              tone="gold"
            />

            <SummaryCard
              label="High or urgent"
              value={summary.highPriority}
              icon="alertTriangle"
              tone="red"
            />

            {!isAdmin && (
              <SummaryCard
                label="Temporary access"
                value={summary.temporary}
                icon="user"
                tone="blue"
              />
            )}
          </div>

          <section className="mt-5 space-y-5">
            <div className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
              <div className="flex flex-col gap-3 border-b border-[#ECE8E5] p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-[17px] font-semibold">
                    Case records
                  </h3>

                  <p className="mt-1 text-[14px] text-[#938B86]">
                    {allVisibleCases.length} record
                    {allVisibleCases.length === 1
                      ? ""
                      : "s"}{" "}
                    displayed
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
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
                      className="h-8 w-full rounded-lg border border-[#E1DCD8] bg-[#FAF9F8] pl-8 pr-2.5 text-[#302B28] outline-none focus:border-[#8C1518] sm:w-[240px]"
                      style={{ fontSize: "15px" }}
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value,
                      )
                    }
                    className="h-8 rounded-lg border border-[#E1DCD8] bg-white px-2.5 text-[#4F4945] outline-none focus:border-[#8C1518]"
                    style={{ fontSize: "15px" }}
                  >
                    <option value="">
                      All statuses
                    </option>

                    {STATUS_OPTIONS.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      ),
                    )}
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(event) =>
                      setPriorityFilter(
                        event.target.value,
                      )
                    }
                    className="h-8 rounded-lg border border-[#E1DCD8] bg-white px-2.5 text-[#4F4945] outline-none focus:border-[#8C1518]"
                    style={{ fontSize: "15px" }}
                  >
                    <option value="">
                      All priorities
                    </option>

                    {PRIORITY_OPTIONS.map(
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
              </div>
            </div>

            <CaseSection
              title={
                isAdmin
                  ? "All active cases"
                  : "Assigned cases"
              }
              description={
                isAdmin
                  ? "Cases available across the counseling office."
                  : "Cases permanently assigned to your account."
              }
              cases={filteredAssignedCases}
              isLoading={isLoading}
              onOpen={(caseItem) =>
                navigate(
                  `/cases/${
                    caseItem._id ||
                    caseItem.id
                  }`,
                )
              }
              onRefresh={fetchCases}
              emptyTitle={
                isAdmin
                  ? "No cases found"
                  : "No assigned cases found"
              }
              emptyMessage={
                isAdmin
                  ? "Adjust the filters or search again."
                  : "No cases are currently assigned to your account."
              }
            />

            {!isAdmin && (
              <CaseSection
                title="Temporary access cases"
                description="Cases shared with you for a limited period. Access ends automatically on the displayed expiration date or when revoked."
                cases={filteredTemporaryCases}
                isLoading={isLoading}
                onOpen={(caseItem) =>
                  navigate(
                    `/cases/${
                      caseItem._id ||
                      caseItem.id
                    }`,
                  )
                }
                onRefresh={fetchCases}
                emptyTitle="No temporary-access cases"
                emptyMessage="Cases granted to you temporarily will appear here."
                temporary
              />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function CaseSection({
  title,
  description,
  cases,
  isLoading,
  onOpen,
  onRefresh,
  emptyTitle,
  emptyMessage,
  temporary = false,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
      <div className="flex flex-col gap-2 border-b border-[#ECE8E5] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-semibold">
              {title}
            </h3>

            {temporary && (
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[14px] font-semibold text-blue-700">
                Limited access
              </span>
            )}
          </div>

          <p className="mt-1 text-[14px] leading-4 text-[#938B86]">
            {description}
          </p>
        </div>

        <p className="text-[14px] text-[#938B86]">
          {cases.length} record
          {cases.length === 1 ? "" : "s"}
        </p>
      </div>

      <CasesContent
        cases={cases}
        isLoading={isLoading}
        onOpen={onOpen}
        onRefresh={onRefresh}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
        temporary={temporary}
      />
    </section>
  );
}

function CasesContent({
  cases,
  isLoading,
  onOpen,
  onRefresh,
  emptyTitle = "No cases found",
  emptyMessage = "Adjust the filters, search again, or create a new case.",
  temporary = false,
}) {
  if (isLoading) {
    return (
      <div className="grid min-h-[320px] place-items-center">
        <div className="text-center">
          <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />

          <p className="mt-3 text-[15px] text-[#827B77]">
            Loading cases...
          </p>
        </div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="grid min-h-[320px] place-items-center px-5 text-center">
        <div>
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
            <Icon
              name="folder"
              className="h-5 w-5"
            />
          </div>

          <p className="mt-4 text-[17px] font-semibold">
            {emptyTitle}
          </p>

          <p className="mt-1 text-[15px] leading-4 text-[#938C87]">
            {emptyMessage}
          </p>

          <button
            type="button"
            onClick={onRefresh}
            className="mt-4 h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 font-semibold text-[#5D5652] hover:border-[#8C1518] hover:text-[#8C1518]"
            style={{ fontSize: "15px" }}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse">
          <thead className="bg-[#FAF9F8]">
            <tr className="border-b border-[#ECE8E5] text-left">
              <TableHeading>Case</TableHeading>
              <TableHeading>Student</TableHeading>
              <TableHeading>Status</TableHeading>
              <TableHeading>Assigned counselor</TableHeading>
              <TableHeading>Updated</TableHeading>
              <TableHeading>Access</TableHeading>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#EEEAE7]">
            {cases.map((caseItem) => (
              <CaseRow
                key={
                  caseItem._id ||
                  caseItem.id
                }
                caseItem={caseItem}
                temporary={temporary}
                onOpen={() =>
                  onOpen(caseItem)
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[#EEEAE7] md:hidden">
        {cases.map((caseItem) => (
          <CaseCard
            key={
              caseItem._id ||
              caseItem.id
            }
            caseItem={caseItem}
            temporary={temporary}
            onOpen={() =>
              onOpen(caseItem)
            }
          />
        ))}
      </div>
    </>
  );
}

function CaseRow({
  caseItem,
  temporary,
  onOpen,
}) {
  const student =
    caseItem.student || {};

  const counselor =
    caseItem.assignedCounselor || {};

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer transition hover:bg-[#FCFBFA]"
    >
      <td className="px-4 py-4 align-middle">
        <p className="whitespace-nowrap text-[14px] font-semibold text-[#37322F]">
          {caseItem.caseNumber ||
            "Pending number"}
        </p>

        <p className="mt-1 text-[13px] text-[#958D88]">
          Opened{" "}
          {formatDate(
            caseItem.dateOpened ||
              caseItem.createdAt,
          )}
        </p>
      </td>

      <td className="px-4 py-4 align-middle">
        <p className="max-w-[180px] truncate text-[14px] font-semibold text-[#403A37]">
          {formatPersonName(student) ||
            "Student unavailable"}
        </p>

        <p className="mt-1 text-[13px] text-[#958D88]">
          {student.studentIdNumber ||
            "No student ID"}
        </p>
      </td>

      <td className="px-4 py-4 align-middle">
        <StatusBadge
          status={
            caseItem.caseStatus
          }
        />
      </td>

      <td className="px-4 py-4 align-middle text-[14px] text-[#625B57]">
        {formatPersonName(
          counselor,
        ) || "—"}
      </td>

      <td className="px-4 py-4 align-middle whitespace-nowrap text-[13px] text-[#736C68]">
        {formatDate(
          caseItem.updatedAt,
        )}
      </td>

      <td className="px-4 py-4 align-middle">
        {temporary ? (
          <div>
            <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-[12px] font-medium text-blue-700">
              Temporary
            </span>

            <p className="mt-1 text-[13px] text-[#958D88]">
              Until{" "}
              {formatDateTime(
                caseItem.activeTemporaryAccess
                  ?.accessUntil,
              )}
            </p>
          </div>
        ) : (
          <span className="inline-flex whitespace-nowrap rounded-full bg-[#F1EEEC] px-2 py-1 text-[12px] font-medium text-[#6E6763]">
            {caseItem.accessType ||
              "Assigned"}
          </span>
        )}
      </td>
    </tr>
  );
}

function CaseCard({
  caseItem,
  temporary,
  onOpen,
}) {
  const student =
    caseItem.student || {};

  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#8C1518]">
            {caseItem.caseNumber ||
              "Pending number"}
          </p>

          <h3 className="mt-1 truncate text-[16px] font-semibold">
            {formatPersonName(student) ||
              "Student unavailable"}
          </h3>

          <p className="mt-1 text-[13px] text-[#938B86]">
            {student.studentIdNumber ||
              "No student ID"}
          </p>
        </div>

        <PriorityBadge
          priority={
            caseItem.priorityLevel
          }
        />
      </div>

      {temporary && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-[12px] font-medium text-blue-700">
            Temporary access
          </p>

          <p className="mt-1 text-[13px] text-blue-700">
            Expires{" "}
            {formatDateTime(
              caseItem.activeTemporaryAccess
                ?.accessUntil,
            )}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <StatusBadge
          status={
            caseItem.caseStatus
          }
        />

        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#DCD6D2] bg-white px-2.5 font-semibold text-[#5A534F]"
          style={{ fontSize: "14px" }}
        >
          Open case
          <Icon
            name="arrowRight"
            className="h-3 w-3"
          />
        </button>
      </div>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}) {
  const tones = {
    maroon:
      "border-[#A62A2E]/55 bg-[#F4E8E8] text-[#8C1518]",
    green:
      "border-[#5E8F3A]/55 bg-[#EAF4E5] text-[#398322]",
    gold:
      "border-[#D2A92D]/55 bg-[#FAF3DC] text-[#A47900]",
    red:
      "border-[#D05A5E]/55 bg-[#FBE7E8] text-[#B1252A]",
    blue:
      "border-[#6B8FD6]/55 bg-[#EAF0FB] text-[#315FA8]",
  };

  const [
    borderClass,
    backgroundClass,
    textClass,
  ] = tones[tone].split(" ");

  return (
    <article
      className={`rounded-xl border bg-white p-4 ${borderClass}`}
    >
      <div
        className={`grid h-8 w-8 place-items-center rounded-lg ${backgroundClass} ${textClass}`}
      >
        <Icon
          name={icon}
          className="h-4 w-4"
        />
      </div>

      <p className="mt-3 text-[15px] text-[#8D8580]">
        {label}
      </p>

      <p className="mt-1 text-[30px] font-semibold">
        {value}
      </p>
    </article>
  );
}

function TableHeading({
  children,
  align = "left",
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-[12px] font-semibold tracking-[0.04em] text-[#8E8782] ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Open:
      "bg-blue-50 text-blue-700",
    "In Progress":
      "bg-violet-50 text-violet-700",
    "For Follow-up":
      "bg-amber-50 text-amber-700",
    Closed:
      "bg-emerald-50 text-emerald-700",
    Terminated:
      "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium leading-4 ${
        styles[status] ||
        "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

function PriorityBadge({
  priority,
}) {
  const styles = {
    Low:
      "bg-emerald-50 text-emerald-700",
    Moderate:
      "bg-amber-50 text-amber-700",
    High:
      "bg-orange-50 text-orange-700",
    Urgent:
      "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium leading-4 ${
        styles[priority] ||
        "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {priority || "Unknown"}
    </span>
  );
}

function Alert({
  type,
  message,
}) {
  const success =
    type === "success";

  return (
    <div
      className={`mb-5 rounded-xl border px-4 py-3 text-[15px] ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

function formatPersonName(
  person,
) {
  return [
    person?.firstName,
    person?.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function getCurrentUserTemporaryAccess(
  caseItem,
  userId,
) {
  const now = new Date();

  return (
    caseItem.temporaryCounselor || []
  ).find((access) => {
    const counselorId =
      access.counselor?._id ||
      access.counselor;

    const accessUntil =
      new Date(access.accessUntil);

    return (
      counselorId?.toString() ===
        userId?.toString() &&
      access.isActive === true &&
      !access.revokedAt &&
      !Number.isNaN(
        accessUntil.getTime(),
      ) &&
      accessUntil > now
    );
  });
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}