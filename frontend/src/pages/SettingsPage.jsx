import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [activeSection, setActiveSection] = useState("account");

  const [currentPassword, setCurrentPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const [showNewPassword, setShowNewPassword] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [passwordError, setPasswordError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

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
    if (!successMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const displayName = useMemo(() => {
    return formatName(user) || user?.email || "Counselor";
  }, [user]);

  const initials = useMemo(() => {
    return getInitials(displayName);
  }, [displayName]);

  const changePassword = async (event) => {
    event.preventDefault();

    setPasswordError("");
    setSuccessMessage("");

    if (!currentPassword) {
      setPasswordError("Current password is required.");

      return;
    }

    if (!newPassword) {
      setPasswordError("New password is required.");

      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must contain at least 8 characters.");

      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");

      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from the current password.");

      return;
    }

    setIsChangingPassword(true);

    try {
      const data = await apiRequest("/users/me/change-password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setSuccessMessage(data?.message || "Password changed successfully.");
    } catch (error) {
      if (error.status === 401) {
        clearUser();

        navigate("/login", {
          replace: true,
        });

        return;
      }

      setPasswordError(error.message || "Unable to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const signOut = () => {
    clearUser();

    navigate("/login", {
      replace: true,
    });
  };

  if (!user) {
    return null;
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
                <h1 className="text-[22px] font-semibold">Settings</h1>

                <p className="hidden text-[16px] text-[#99918C] sm:block">
                  Manage your account and password
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[16px] font-semibold text-red-700 hover:bg-red-50"
            >
              <Icon name="arrowLeft" className="h-3 w-3" />
              Sign out
            </button>
          </div>
        </header>

        <main className="page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7 lg:w-[calc(100%-240px)]! lg:px-0!">
          {successMessage && <Alert tone="success" message={successMessage} />}

          <section>
            <h2 className="text-[30px] font-semibold tracking-[-0.03em]">Account settings</h2>

            <p className="mt-1 max-w-[850px] text-[17px] leading-6 text-[#89817D]">
              Review your counselor account and update your password.
            </p>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="h-fit overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
              <div className="border-b border-[#ECE8E5] p-4">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    user={user}
                    initials={initials}
                    sizeClass="h-11 w-11"
                    textClass="text-[17px]"
                  />

                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-semibold">{displayName}</p>

                    <p className="mt-0.5 truncate text-[16px] text-[#958D88]">{user.email}</p>
                  </div>
                </div>
              </div>

              <nav className="p-2 ">
                <SettingsNavButton
                  label="Account information"
                  description="Profile and role"
                  icon="student"
                  active={activeSection === "account"}
                  onClick={() => setActiveSection("account")}
                />

                <SettingsNavButton
                  label="Security"
                  description="Change password"
                  icon="folder"
                  active={activeSection === "security"}
                  onClick={() => setActiveSection("security")}
                />

                <SettingsNavButton
                  label="System access"
                  description="Role and permissions"
                  icon="checkSquare"
                  active={activeSection === "access"}
                  onClick={() => setActiveSection("access")}
                />
              </nav>
            </aside>

            <section className="min-w-0">
              {activeSection === "account" && (
                <AccountSection user={user} displayName={displayName} initials={initials} />
              )}

              {activeSection === "security" && (
                <SecuritySection
                  currentPassword={currentPassword}
                  setCurrentPassword={setCurrentPassword}
                  newPassword={newPassword}
                  setNewPassword={setNewPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  showCurrentPassword={showCurrentPassword}
                  setShowCurrentPassword={setShowCurrentPassword}
                  showNewPassword={showNewPassword}
                  setShowNewPassword={setShowNewPassword}
                  error={passwordError}
                  saving={isChangingPassword}
                  onSubmit={changePassword}
                />
              )}

              {activeSection === "access" && (
                <AccessSection
                  user={user}
                  isAdmin={isAdmin}
                  onOpenActivity={() => navigate("/activity-logs")}
                />
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function AccountSection({ user, displayName, initials }) {
  return (
    <SettingsPanel
      title="Account information"
      subtitle="Information connected to your counselor account"
    >
      <div className="flex flex-col gap-4 border-b border-[#ECE8E5] p-5 sm:flex-row sm:items-center">
        <UserAvatar user={user} initials={initials} sizeClass="h-16 w-16" textClass="text-[20px]" />

        <div>
          <h3 className="text-[19px] font-semibold">{displayName}</h3>

          <p className="mt-1 text-[17px] text-[#8E8681]">
            {user.designation || "Guidance counselor"}
          </p>

          <RoleBadge role={user.role} />
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <InformationCard label="Email address" value={user.email || "Not recorded"} />

        <InformationCard
          label="Institute ID number"
          value={user.instituteIdNumber || "Not recorded"}
        />

        <InformationCard label="Contact number" value={user.contactNumber || "Not recorded"} />

        <InformationCard label="Designation" value={user.designation || "Not recorded"} />

        <InformationCard
          label="Colleges handled"
          value={(user.collegesHandled || []).join(", ") || "Not assigned"}
        />

        <InformationCard
          label="Date joined as counselor"
          value={formatDate(user.dateJoinedAsCounselor)}
        />
      </div>

      <div className="border-t border-[#ECE8E5] bg-[#FCFBFA] px-5 py-4">
        <p className="text-[16px] leading-6 text-[#817A76]">
          Profile information is managed through the user-management workflow. Contact a
          Counselor-Admin when your institutional details need to be corrected.
        </p>
      </div>
    </SettingsPanel>
  );
}

function SecuritySection({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  showCurrentPassword,
  setShowCurrentPassword,
  showNewPassword,
  setShowNewPassword,
  error,
  saving,
  onSubmit,
}) {
  return (
    <SettingsPanel title="Security" subtitle="Change the password used to access My.GUIDE">
      <form onSubmit={onSubmit} className="p-5">
        {error && <Alert tone="error" message={error} />}

        <div className="w-full space-y-4">
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            visible={showCurrentPassword}
            onToggle={() => setShowCurrentPassword((current) => !current)}
            autoComplete="current-password"
          />

          <PasswordField
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            visible={showNewPassword}
            onToggle={() => setShowNewPassword((current) => !current)}
            autoComplete="new-password"
          />

          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showNewPassword}
            onToggle={() => setShowNewPassword((current) => !current)}
            autoComplete="new-password"
          />

          <div className="rounded-xl border border-[#E6D9B7] bg-[#FCF8EB] px-4 py-3">
            <p className="text-[16px] font-semibold text-[#705A1B]">Password guidance</p>

            <p className="mt-1 text-[16px] leading-6 text-[#806E3A]">
              Use at least eight characters and avoid reusing your institutional email password.
              Never share your account with another counselor.
            </p>
          </div>

          <div className="flex justify-end border-t border-[#ECE8E5] pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#8C1518] px-4 !text-[17px] font-semibold text-white hover:bg-[#701013] disabled:opacity-50"
            >
              {saving && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white " />
              )}

              {saving ? "Changing password..." : "Change password"}
            </button>
          </div>
        </div>
      </form>
    </SettingsPanel>
  );
}

function AccessSection({ user, isAdmin, onOpenActivity }) {
  const permissions = isAdmin
    ? [
        "Access all counseling cases",
        "Create and assign cases",
        "View office-wide analytics and reports",
        "Review case activity logs",
      ]
    : [
        "Access assigned counseling cases",
        "Access cases with active temporary permission",
        "Add progress notes and follow-ups",
        "Review and manage assigned intervention plans",
        "View analytics and reports for accessible cases",
      ];

  return (
    <SettingsPanel title="System access" subtitle="Role and permission summary for your account">
      <div className="p-5">
        <div className="flex flex-col gap-3 rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[16px] text-[#958D88]">Current role</p>

            <p className="mt-1 text-[17px] font-semibold">{user.role}</p>
          </div>

          <RoleBadge role={user.role} />
        </div>

        <section className="mt-5">
          <h3 className="text-[19px] font-semibold">Available permissions</h3>

          <div className="mt-3 space-y-2">
            {permissions.map((permission) => (
              <div
                key={permission}
                className="flex items-start gap-3 rounded-lg border border-[#ECE8E5] bg-white px-3 py-3"
              >
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                  ✓
                </span>

                <p className="text-[16px] leading-6 text-[#5E5753]">{permission}</p>
              </div>
            ))}
          </div>
        </section>

        {isAdmin && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onOpenActivity}
              className="rounded-xl border border-[#E4DFDC] bg-white p-4 text-left hover:border-[#8C1518]"
            >
              <p className="text-[17px] font-semibold">Open activity log</p>

              <p className="mt-1 text-[16px] leading-6 text-[#8D8580]">
                Review actions performed across counseling cases.
              </p>
            </button>
          </div>
        )}
      </div>
    </SettingsPanel>
  );
}

function SettingsPanel({ title, subtitle, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
      <header className="border-b border-[#ECE8E5] px-5 py-4">
        <h2 className="text-[22px] font-semibold">{title}</h2>

        {subtitle && <p className="mt-1 text-[16px] text-[#938B86]">{subtitle}</p>}
      </header>

      {children}
    </section>
  );
}

function SettingsNavButton({ label, description, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
        active ? "bg-[#F5EAEA] text-[#8C1518]" : "text-[#5E5753] hover:bg-[#FAF8F7]"
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          active ? "bg-[#8C1518] text-white" : "bg-[#F1EEEC] text-[#706965]"
        }`}
      >
        <Icon name={icon} className="h-3.5 w-3.5" />
      </span>

      <span className="min-w-0">
        <span className="block text-[19px] leading-6 font-semibold">{label}</span>

        <span className="mt-0.5 block text-[14px] leading-5 opacity-70">{description}</span>
      </span>
    </button>
  );
}

function UserAvatar({ user, initials, sizeClass, textClass }) {
  const profilePictureUrl = getProfilePictureUrl(user?.profilePicture);

  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [profilePictureUrl]);

  if (profilePictureUrl && !imageFailed) {
    return (
      <img
        src={profilePictureUrl}
        alt={`${formatName(user) || "Counselor"} profile`}
        onError={() => setImageFailed(true)}
        className={`${sizeClass} shrink-0 rounded-full border border-[#E4DFDC] bg-white object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${textClass} grid shrink-0 place-items-center rounded-full bg-[#8C1518] font-semibold text-white`}
      aria-label={`${formatName(user) || "Counselor"} initials`}
    >
      {initials}
    </div>
  );
}

function InformationCard({ label, value }) {
  return (
    <article className="rounded-xl border border-[#E7E2DF] bg-[#FCFBFA] p-4">
      <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p className="mt-2 break-words text-[17px] font-medium text-[#4E4844]">{value}</p>
    </article>
  );
}

function PasswordField({ label, value, onChange, visible, onToggle, autoComplete }) {
  return (
    <label className="block">
      <span className="text-[17px] font-semibold text-[#4B4541]">{label}</span>

      <div className="relative mt-1.5">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          className="h-12 w-full rounded-lg border border-[#DDD8D4] bg-white px-3 pr-16 text-[17px] outline-none focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 !text-[17px] font-semibold text-[#8C1518]"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

function RoleBadge({ role }) {
  const isAdmin = role === ADMIN_ROLE;

  return (
    <span
      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[16px] font-semibold ${
        isAdmin ? "bg-[#F5E5B8] text-[#7A5700]" : "bg-[#EAF1F8] text-[#316FAE]"
      }`}
    >
      {role || "Unknown role"}
    </span>
  );
}

function Alert({ tone, message }) {
  const success = tone === "success";

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-[17px] ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

function getProfilePictureUrl(profilePicture) {
  if (!profilePicture) {
    return "";
  }

  const value = String(profilePicture).trim();

  if (!value) {
    return "";
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  const apiOrigin = import.meta.env.VITE_API_ORIGIN || "/api";

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;

  return `${apiOrigin}${normalizedPath}`;
}

function formatName(person) {
  return [person?.firstName, person?.middleName, person?.lastName].filter(Boolean).join(" ");
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
