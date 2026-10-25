import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Icon from "../components/Icon";
import Logo from "../components/Logo";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, setUser, clearUser } = useAuth();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const [showNewPassword, setShowNewPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!user) {
      navigate("/login", {
        replace: true,
      });
    }
  }, [user, navigate]);

  const updateField = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
      general: "",
    }));
  };

  const validateForm = () => {
    const validationErrors = {};

    if (!formData.currentPassword) {
      validationErrors.currentPassword = "Current password is required.";
    }

    if (!formData.newPassword) {
      validationErrors.newPassword = "New password is required.";
    } else if (formData.newPassword.length < 8) {
      validationErrors.newPassword = "New password must contain at least 8 characters.";
    }

    if (!formData.confirmNewPassword) {
      validationErrors.confirmNewPassword = "Please confirm your new password.";
    } else if (formData.newPassword !== formData.confirmNewPassword) {
      validationErrors.confirmNewPassword = "New passwords do not match.";
    }

    if (
      formData.currentPassword &&
      formData.newPassword &&
      formData.currentPassword === formData.newPassword
    ) {
      validationErrors.newPassword = "New password cannot be the same as your current password.";
    }

    return validationErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await apiRequest("/users/me/change-password", {
        method: "PATCH",

        body: JSON.stringify({
          currentPassword: formData.currentPassword,

          newPassword: formData.newPassword,

          confirmNewPassword: formData.confirmNewPassword,
        }),
      });

      const updatedUser = {
        ...user,
        mustChangePassword: false,
      };

      setUser(updatedUser);

      if (updatedUser.profileCompleted === false) {
        navigate("/complete-profile", {
          replace: true,
        });

        return;
      }

      navigate("/dashboard", {
        replace: true,
      });
    } catch (error) {
      console.error("Password change error:", error);

      if (error.status === 401) {
        setErrors({
          currentPassword: error.message || "Your current password is incorrect.",
        });

        return;
      }

      if (error.status === 403) {
        clearUser();

        navigate("/login", {
          replace: true,
        });

        return;
      }

      setErrors({
        general: error.message || "Unable to change your password.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#F7F5F3] font-[Poppins] lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      {/* LEFT INFORMATION PANEL */}
      <section className="relative hidden min-h-screen overflow-hidden bg-[#731216] lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-36 h-[430px] w-[430px] rounded-full border-[75px] border-white/[0.035]" />

          <div className="absolute -bottom-44 -right-24 h-[440px] w-[440px] rounded-full bg-[#C9A84C]/10 blur-[110px]" />

          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20" />
        </div>

        <header className="relative z-10 px-12 pt-10 xl:px-16 xl:pt-12">
          <Logo variant="icon" light />
        </header>

        <div className="relative z-10 flex flex-1 items-center px-12 py-16 xl:px-16">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DFC066]" />

              <span className="text-[15px] font-semibold uppercase tracking-[0.18em] text-white/70">
                First-time account setup
              </span>
            </div>

            <h1 className="mt-8 text-5xl font-semibold leading-[1.08] tracking-[-0.05em] text-white xl:text-[4rem]">
              Secure your
              <span className="block text-[#E0C268]">My.GUIDE account.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-8 text-white/60">
              Replace the temporary password provided by your administrator before continuing to the
              system.
            </p>

            <div className="mt-10 space-y-3">
              <SecurityItem
                title="Use at least 8 characters"
                description="Use a password that is difficult for others to guess."
              />

              <SecurityItem
                title="Avoid reused passwords"
                description="Do not reuse a password from another account."
              />

              <SecurityItem
                title="Keep it confidential"
                description="Never share your My.GUIDE password with another person."
              />
            </div>
          </div>
        </div>

        <footer className="relative z-10 px-12 pb-10 text-[15px] text-white/35 xl:px-16 xl:pb-12">
          MSU-IIT Office of Guidance and Counseling
        </footer>
      </section>

      {/* PASSWORD FORM */}
      <section className="flex min-h-screen flex-col bg-[#FAF9F8] px-5 py-5 sm:px-10 lg:px-14 xl:px-24">
        <header className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="hidden lg:block" />

          <button
            type="button"
            onClick={() => {
              clearUser();

              navigate("/login", {
                replace: true,
              });
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-[#68625F] transition hover:bg-white hover:text-[#8C1518]"
          >
            <Icon name="logout" className="h-4 w-4" />
            Sign out
          </button>
        </header>

        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-14">
          <div className="mb-8">
            <div className="mb-7 hidden lg:block">
              <Logo />
            </div>

            <p className="text-[16px] font-semibold uppercase tracking-[0.2em] text-[#9A171B]">
              Required action
            </p>

            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[#201D1C] sm:text-[2.65rem]">
              Change your password
            </h2>

            <p className="mt-4 text-[15px] leading-7 text-[#746E6A]">
              You are currently using a temporary password. Create a new password to secure your
              account.
            </p>
          </div>

          <ProgressSteps currentStep={1} />

          {errors.general && <ErrorAlert message={errors.general} />}

          <form onSubmit={handleSubmit} className="mt-8" noValidate>
            <PasswordField
              id="currentPassword"
              name="currentPassword"
              label="Current temporary password"
              value={formData.currentPassword}
              onChange={updateField}
              showPassword={showCurrentPassword}
              onToggleVisibility={() => setShowCurrentPassword((current) => !current)}
              error={errors.currentPassword}
              autoComplete="current-password"
            />

            <div className="mt-5">
              <PasswordField
                id="newPassword"
                name="newPassword"
                label="New password"
                value={formData.newPassword}
                onChange={updateField}
                showPassword={showNewPassword}
                onToggleVisibility={() => setShowNewPassword((current) => !current)}
                error={errors.newPassword}
                autoComplete="new-password"
              />
            </div>

            <div className="mt-5">
              <PasswordField
                id="confirmNewPassword"
                name="confirmNewPassword"
                label="Confirm new password"
                value={formData.confirmNewPassword}
                onChange={updateField}
                showPassword={showConfirmPassword}
                onToggleVisibility={() => setShowConfirmPassword((current) => !current)}
                error={errors.confirmNewPassword}
                autoComplete="new-password"
              />
            </div>

            <PasswordStrength password={formData.newPassword} />

            <button
              type="submit"
              disabled={isSubmitting}
              className="group mt-7 inline-flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#8C1518] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#701013] focus:outline-none focus:ring-4 focus:ring-[#8C1518]/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating password
                </>
              ) : (
                <>
                  Change password and continue
                  <Icon
                    name="arrowRight"
                    className="h-4 w-4 transition group-hover:translate-x-0.5"
                  />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 flex items-start gap-3 border-t border-[#E8E3DF] pt-6">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
              <Icon name="shield" className="h-4 w-4" />
            </div>

            <p className="text-[16px] leading-6 text-[#7E7874]">
              After changing your password, you will be asked to complete your counselor profile
              before accessing the dashboard.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  showPassword,
  onToggleVisibility,
  error,
  autoComplete,
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] font-semibold text-[#3C3835]">
        {label}
      </label>

      <div
        className={`group flex min-h-[54px] items-center rounded-xl border bg-white transition focus-within:ring-4 ${
          error
            ? "border-red-400 focus-within:ring-red-100"
            : "border-[#DDD8D4] focus-within:border-[#8C1518] focus-within:ring-[#8C1518]/[0.08]"
        }`}
      >
        <span className="pl-4 text-[#A39D98] group-focus-within:text-[#8C1518]">
          <Icon name="lock" className="h-[18px] w-[18px]" />
        </span>

        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent px-3.5 py-3.5 text-[15px] text-[#262321] outline-none"
        />

        <button
          type="button"
          onClick={onToggleVisibility}
          className="mr-2 grid h-9 w-9 place-items-center rounded-lg text-[#9C9692] hover:bg-[#F5F2F0]"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          <Icon name={showPassword ? "eyeOff" : "eye"} className="h-[18px] w-[18px]" />
        </button>
      </div>

      {error && <p className="mt-2 text-[13px] font-medium text-red-600">{error}</p>}
    </div>
  );
}

function PasswordStrength({ password }) {
  const requirements = [
    {
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      label: "Contains an uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      label: "Contains a lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      label: "Contains a number",
      met: /\d/.test(password),
    },
  ];

  if (!password) {
    return null;
  }

  return (
    <div className="mt-5 rounded-xl border border-[#E5E0DC] bg-white p-4">
      <p className="text-[15px] font-semibold text-[#4B4541]">Password recommendations</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {requirements.map((requirement) => (
          <div key={requirement.label} className="flex items-center gap-2">
            <span
              className={`grid h-4 w-4 place-items-center rounded-full ${
                requirement.met ? "bg-emerald-100 text-emerald-700" : "bg-[#F1EEEC] text-[#AAA29D]"
              }`}
            >
              <Icon name="check" className="h-2.5 w-2.5" />
            </span>

            <span
              className={`text-[15px] ${requirement.met ? "text-emerald-700" : "text-[#837C78]"}`}
            >
              {requirement.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityItem({ title, description }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.05] p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-[#DFC066]">
        <Icon name="check" className="h-4 w-4" />
      </div>

      <div>
        <p className="text-[13px] font-semibold text-white/90">{title}</p>

        <p className="mt-1 text-[15px] leading-5 text-white/45">{description}</p>
      </div>
    </div>
  );
}

function ProgressSteps({ currentStep }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E5E0DC] bg-white p-4">
      <Step
        number="1"
        label="Change password"
        active={currentStep === 1}
        complete={currentStep > 1}
      />

      <div className="h-px flex-1 bg-[#DED9D5]" />

      <Step
        number="2"
        label="Complete profile"
        active={currentStep === 2}
        complete={currentStep > 2}
      />

      <div className="h-px flex-1 bg-[#DED9D5]" />

      <Step number="3" label="Dashboard" active={currentStep === 3} complete={false} />
    </div>
  );
}

function Step({ number, label, active, complete }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        className={`grid h-6 w-6 place-items-center rounded-full text-[15px] font-semibold ${
          active || complete ? "bg-[#8C1518] text-white" : "bg-[#F0EDEB] text-[#99918C]"
        }`}
      >
        {complete ? <Icon name="check" className="h-3 w-3" /> : number}
      </span>

      <span
        className={`hidden text-[15px] font-medium sm:block ${
          active ? "text-[#8C1518]" : "text-[#88817D]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function ErrorAlert({ message }) {
  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-6 text-red-700">
      {message}
    </div>
  );
}
