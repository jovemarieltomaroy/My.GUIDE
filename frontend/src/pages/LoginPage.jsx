import { useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Icon from "../components/Icon";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../config/api";

const VALID_ROLES = [
  "Counselor-Admin",
  "Counselor-User",
];

function extractUserFromResponse(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  if (data.user && typeof data.user === "object") {
    return data.user;
  }

  if (
    data.loggedInUser &&
    typeof data.loggedInUser === "object"
  ) {
    return data.loggedInUser;
  }

  if (
    data.authenticatedUser &&
    typeof data.authenticatedUser === "object"
  ) {
    return data.authenticatedUser;
  }

  if (data.role && data.email) {
    return data;
  }

  return null;
}

function getRequiredRoute(user) {
  if (user?.mustChangePassword === true) {
    return "/change-password";
  }

  if (user?.profileCompleted === false) {
    return "/complete-profile";
  }

  return "/dashboard";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user,
    isAuthenticated,
    setUser,
  } = useAuth();

  const [showPassword, setShowPassword] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState({});

  /*
    Important:
    An already authenticated first-time user must not be sent
    directly to the dashboard.
  */
  if (isAuthenticated && user) {
    return (
      <Navigate
        to={getRequiredRoute(user)}
        replace
      />
    );
  }

  const updateField = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setFormData((current) => ({
      ...current,
      [name]:
        type === "checkbox" ? checked : value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
      general: "",
    }));
  };

  const validateForm = () => {
    const validationErrors = {};
    const normalizedEmail =
      formData.email.trim();

    if (!normalizedEmail) {
      validationErrors.email =
        "Institutional email is required.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail,
      )
    ) {
      validationErrors.email =
        "Enter a valid institutional email address.";
    }

    if (!formData.password) {
      validationErrors.password =
        "Password is required.";
    }

    return validationErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validateForm();

    if (
      Object.keys(validationErrors).length > 0
    ) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const data = await apiRequest("/auth", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email
            .trim()
            .toLowerCase(),
          password: formData.password,
        }),
      });

      const authenticatedUser =
        extractUserFromResponse(data);

      if (!authenticatedUser) {
        console.error(
          "Unexpected login response:",
          data,
        );

        setErrors({
          general:
            "Login succeeded, but the backend did not return the authenticated user.",
        });

        return;
      }

      if (
        !VALID_ROLES.includes(
          authenticatedUser.role,
        )
      ) {
        setErrors({
          general:
            "Your account does not have a recognized My.GUIDE role.",
        });

        return;
      }

      /*
        Save the real authenticated user first so the required
        setup pages can read the account from AuthContext.
      */
      setUser(authenticatedUser);

      if (
        authenticatedUser.mustChangePassword ===
        true
      ) {
        navigate("/change-password", {
          replace: true,
        });
        return;
      }

      if (
        authenticatedUser.profileCompleted ===
        false
      ) {
        navigate("/complete-profile", {
          replace: true,
        });
        return;
      }

      const requestedPath =
        location.state?.from;

      navigate(
        requestedPath &&
          ![
            "/login",
            "/change-password",
            "/complete-profile",
          ].includes(requestedPath)
          ? requestedPath
          : "/dashboard",
        {
          replace: true,
        },
      );
    } catch (error) {
      console.error("Login error:", error);

      if (error.status === 401) {
        setErrors({
          general:
            "The email or password you entered is incorrect.",
        });
        return;
      }

      if (error.status === 403) {
        setErrors({
          general:
            error.message ||
            "This account is not allowed to access My.GUIDE.",
        });
        return;
      }

      setErrors({
        general:
          error.message ||
          "Unable to connect to the server. Confirm that the backend is running.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F5F3] lg:grid lg:grid-cols-[1.02fr_0.98fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#731216] lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-36 h-[430px] w-[430px] rounded-full border-[75px] border-white/[0.035]" />
          <div className="absolute -bottom-44 -right-24 h-[440px] w-[440px] rounded-full bg-[#C9A84C]/10 blur-[110px]" />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/20" />
        </div>

        <div className="relative z-10 flex items-center justify-between px-12 pt-10 xl:px-16 xl:pt-12">

          <div className="flex items-center gap-2 text-[16px] font-medium text-white/55">
            <Icon
              name="shield"
              className="h-4 w-4"
            />
            Secure counselor portal
          </div>
        </div>

        <div className="relative z-10 flex flex-1 items-center px-12 py-16 xl:px-16">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DFC066]" />
              <span className="text-[15px] font-semibold uppercase tracking-[0.18em] text-white/70">
                MSU-IIT Guidance Case Management
              </span>
            </div>

            <h1 className="mt-8 text-5xl font-semibold leading-[1.08] tracking-[-0.05em] text-white xl:text-[4rem]">
              Guidance work,
              <span className="block text-[#E0C268]">
                organized securely.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-8 text-white/60">
              Manage counseling cases, document
              progress, review intervention
              recommendations, and access
              meaningful insights from one focused
              workspace.
            </p>

            <div className="mt-12 grid max-w-lg gap-3 sm:grid-cols-2">
              <FeaturePreview
                icon="folder"
                title="Structured cases"
                description="Keep counseling records organized."
              />
              <FeaturePreview
                icon="sparkle"
                title="Counselor-reviewed AI"
                description="Recommendations remain under counselor control."
              />
              <FeaturePreview
                icon="shield"
                title="Controlled access"
                description="Protect confidential information."
              />
              <FeaturePreview
                icon="chart"
                title="Useful insights"
                description="Understand cases and counseling trends."
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 px-12 pb-10 xl:px-16 xl:pb-12">
          <div className="flex items-center gap-3 border-t border-white/10 pt-6">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-[#DFC066]">
              <Icon
                name="check"
                className="h-4 w-4"
              />
            </div>
            <p className="text-[13px] leading-6 text-white/45">
              AI-assisted recommendations.
              Counselor-reviewed decisions.
            </p>
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen flex-col bg-[#FAF9F8] px-5 py-5 sm:px-10 lg:px-12 xl:px-20">
        <header className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo
              onClick={() => navigate("/")}
            />
          </div>

          <div className="hidden lg:block" />

          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-[#68625F] transition hover:bg-white hover:text-[#8C1518]"
          >
            <Icon
              name="arrowLeft"
              className="h-4 w-4"
            />
            Back to home
          </button>
        </header>

        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-14">
          <div className="mb-9">
            <div className="mb-7 hidden lg:block">
              <Logo
                onClick={() => navigate("/")}
              />
            </div>

            <p className="text-[16px] font-semibold uppercase tracking-[0.2em] text-[#9A171B]">
              Authorized access
            </p>

            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[#201D1C] sm:text-[2.75rem]">
              Welcome back
            </h2>

            <p className="mt-4 text-[15px] leading-7 text-[#746E6A] sm:text-base">
              Enter your authorized counselor
              account to continue to My.GUIDE.
            </p>
          </div>

          {errors.general && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5"
            >
              <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-100 text-[13px] font-bold text-red-700">
                !
              </div>

              <p className="text-[15px] font-medium leading-6 text-red-700">
                {errors.general}
              </p>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            noValidate
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[13px] font-semibold text-[#3C3835]"
              >
                Institutional email
              </label>

              <div
                className={`group flex min-h-[54px] items-center rounded-xl border bg-white transition focus-within:ring-4 ${
                  errors.email
                    ? "border-red-400 focus-within:ring-red-100"
                    : "border-[#DDD8D4] focus-within:border-[#8C1518] focus-within:ring-[#8C1518]/[0.08]"
                }`}
              >
                <span className="pl-4 text-[#A39D98] group-focus-within:text-[#8C1518]">
                  <Icon
                    name="mail"
                    className="h-[18px] w-[18px]"
                  />
                </span>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={updateField}
                  placeholder="counselor@msuiit.edu.ph"
                  autoComplete="email"
                  aria-invalid={Boolean(
                    errors.email,
                  )}
                  className="min-w-0 flex-1 bg-transparent px-3.5 py-3.5 text-[15px] text-[#262321] outline-none placeholder:text-[#B1ABA7]"
                />
              </div>

              {errors.email && (
                <p className="mt-2 text-[13px] font-medium text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-[13px] font-semibold text-[#3C3835]"
                >
                  Password
                </label>

              </div>

              <div
                className={`group flex min-h-[54px] items-center rounded-xl border bg-white transition focus-within:ring-4 ${
                  errors.password
                    ? "border-red-400 focus-within:ring-red-100"
                    : "border-[#DDD8D4] focus-within:border-[#8C1518] focus-within:ring-[#8C1518]/[0.08]"
                }`}
              >
                <span className="pl-4 text-[#A39D98] group-focus-within:text-[#8C1518]">
                  <Icon
                    name="lock"
                    className="h-[18px] w-[18px]"
                  />
                </span>

                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={formData.password}
                  onChange={updateField}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(
                    errors.password,
                  )}
                  className="min-w-0 flex-1 bg-transparent px-3.5 py-3.5 text-[15px] text-[#262321] outline-none placeholder:text-[#B1ABA7]"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current,
                    )
                  }
                  className="mr-2 grid h-9 w-9 place-items-center rounded-lg text-[#9C9692] hover:bg-[#F5F2F0]"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  <Icon
                    name={
                      showPassword
                        ? "eyeOff"
                        : "eye"
                    }
                    className="h-[18px] w-[18px]"
                  />
                </button>
              </div>

              {errors.password && (
                <p className="mt-2 text-[13px] font-medium text-red-600">
                  {errors.password}
                </p>
              )}

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="text-[13px] font-medium text-[#8C1518] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <label className="mt-5 inline-flex cursor-pointer items-center gap-3 text-[13px] text-[#6E6864]">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={updateField}
                className="h-4 w-4 accent-[#8C1518]"
              />
              Keep me signed in on this device
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group mt-7 inline-flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#8C1518] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in
                </>
              ) : (
                <>
                  Sign in
                  <Icon
                    name="arrowRight"
                    className="h-4 w-4"
                  />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-start gap-3 border-t border-[#E8E3DF] pt-6">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
              <Icon
                name="shield"
                className="h-4 w-4"
              />
            </div>

            <p className="text-[16px] leading-6 text-[#7E7874]">
              My.GUIDE is restricted to authorized
              MSU-IIT guidance personnel. Access
              and activity may be recorded to
              protect confidential counseling
              information.
            </p>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[#E6E1DE] py-5 text-[15px] text-[#9B9591] sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()}{" "}
            My.GUIDE
          </p>

          <p>
            MSU-IIT Office of Guidance and
            Counseling
          </p>
        </footer>
      </section>
    </main>
  );
}

function FeaturePreview({
  icon,
  title,
  description,
}) {
  return (
    <article className="rounded-xl border border-white/[0.09] bg-white/[0.055] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.08] text-[#DFC066]">
          <Icon
            name={icon}
            className="h-4 w-4"
          />
        </div>

        <div>
          <h3 className="text-[17px] font-semibold text-white/90">
            {title}
          </h3>

          <p className="mt-1.5 text-[15px] leading-5 text-white/45">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}