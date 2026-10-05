import { useLocation, useNavigate } from "react-router-dom";

import Icon from "./Icon";
import sidebarLogo from "../assets/myguide-sidebar-icon.png";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";

const ADMIN_MENU = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", icon: "dashboard", path: "/dashboard" },
    ],
  },
  {
    label: "Case Management",
    items: [
      { name: "All Cases", icon: "folder", path: "/cases" },
      { name: "New Case", icon: "plus", path: "/cases/new" },
      { name: "Student Records", icon: "student", path: "/students" },
      { name: "Intervention Plans", icon: "heart", path: "/intervention-plans" },
      { name: "Progress Notes", icon: "notes", path: "/progress-notes" },
      { name: "Follow-ups", icon: "calendar", path: "/follow-ups" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { name: "LLM Recommendations", icon: "sparkle", path: "/llm-recommendations" },
      { name: "Knowledge Base", icon: "file", path: "/knowledge-base" },
      { name: "Analytics", icon: "chart", path: "/analytics" },
      { name: "Reports", icon: "file", path: "/reports" },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "User Management", icon: "users", path: "/users" },
      { name: "Activity Logs", icon: "history", path: "/activity-logs" },
      { name: "Settings", icon: "settings", path: "/settings" },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "My Profile", icon: "user", path: "/me" },
    ],
  },
];

const COUNSELOR_MENU = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", icon: "dashboard", path: "/dashboard" },
    ],
  },
  {
    label: "Case Management",
    items: [
      { name: "My Cases", icon: "folder", path: "/cases" },
      { name: "New Case", icon: "plus", path: "/cases/new" },
      { name: "Student Records", icon: "student", path: "/students" },
      { name: "Intervention Plans", icon: "heart", path: "/intervention-plans" },
      { name: "Progress Notes", icon: "notes", path: "/progress-notes" },
      { name: "Follow-ups", icon: "calendar", path: "/follow-ups" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { name: "LLM Recommendations", icon: "sparkle", path: "/llm-recommendations" },
      { name: "Analytics", icon: "chart", path: "/analytics" },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "My Profile", icon: "user", path: "/me" },
      { name: "Settings", icon: "settings", path: "/settings" },
    ],
  },
];

export default function AppSidebar({ user, sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearUser } = useAuth();

  const isAdmin = user?.role === ADMIN_ROLE;
  const menuGroups = isAdmin ? ADMIN_MENU : COUNSELOR_MENU;

  const goTo = (path) => {
    setSidebarOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    clearUser();
    navigate("/", { replace: true });
  };

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[220px] flex-col overflow-hidden bg-[#7D1718] text-white transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-white/[0.08] px-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={sidebarLogo}
              alt="My.GUIDE"
              className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12"
            />

            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-none text-white">
                My.GUIDE
              </p>
              <p className="mt-1 truncate text-[12px] leading-none text-white/35">
                Guidance Case Management
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="grid h-7 w-7 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => goTo("/me")}
          className="w-full shrink-0 border-b border-white/[0.08] px-3.5 py-2.5 text-left transition hover:bg-white/[0.05]"
        >
          <div className="flex items-center gap-2.5">
            <UserAvatar user={user} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold leading-5 text-white">
                {formatUserName(user)}
              </p>
              <p className="truncate text-[12px] leading-4 text-white/55">
                {user?.designation || (isAdmin ? "Counselor Administrator" : "Guidance Counselor")}
              </p>
              <p className="truncate text-[12px] font-medium leading-4 text-[#E2C15D]">
                {user?.role}
              </p>
            </div>

            <Icon name="arrowRight" className="h-3 w-3 shrink-0 text-white/35" />
          </div>
        </button>

        <nav className="min-h-0 flex-1 overflow-hidden px-2 py-2">
          {menuGroups.map((group) => (
            <div key={group.label} className="mb-1.5 last:mb-0">
              <p className="mb-0.5 px-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/30">
                {group.label}
              </p>

              <div className="space-y-px">
                {group.items.map((item) => {
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== "/dashboard" &&
                      item.path !== "/me" &&
                      location.pathname.startsWith(`${item.path}/`));

                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => goTo(item.path)}
                      className={`group flex h-[25px] w-full items-center gap-2 rounded-md px-2 text-left text-[14px] transition ${
                        isActive
                          ? "bg-white/[0.12] font-semibold text-white"
                          : "font-medium text-white/55 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <Icon
                        name={item.icon}
                        className={`h-[11px] w-[11px] shrink-0 ${
                          isActive
                            ? "text-[#E4C45D]"
                            : "text-white/40 group-hover:text-white/80"
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/[0.08] px-2 py-1.5">
          <button
            type="button"
            onClick={handleLogout}
            className="group flex h-[27px] w-full items-center gap-2 rounded-md px-2 text-left text-[14px] font-medium text-white/45 transition hover:bg-white/[0.07] hover:text-white"
          >
            <Icon name="logout" className="h-[11px] w-[11px] shrink-0 text-white/35 group-hover:text-white" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function UserAvatar({ user }) {
  if (user?.profilePicture) {
    return (
      <img
        src={user.profilePicture}
        alt={formatUserName(user)}
        className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/15"
      />
    );
  }

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();

  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.11] text-[14px] font-semibold text-white ring-1 ring-white/[0.10]">
      {initials}
    </div>
  );
}

function formatUserName(user) {
  return [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ");
}