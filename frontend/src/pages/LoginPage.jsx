import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import Icon from "../components/Icon";
import brandIcon from "../assets/myguide-brand-icon.svg";
import buildingImage from "../assets/ogc-building.jpg";
import "./LoginPage.css";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../config/api";

const VALID_ROLES = ["Super-Admin", "Counselor-Admin", "Counselor-User"];

function extractUserFromResponse(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  if (data.user && typeof data.user === "object") {
    return data.user;
  }

  if (data.loggedInUser && typeof data.loggedInUser === "object") {
    return data.loggedInUser;
  }

  if (data.authenticatedUser && typeof data.authenticatedUser === "object") {
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

  if (user?.role === "Super-Admin") {
    return "/system";
  }

  if (user?.profileCompleted === false) {
    return "/complete-profile";
  }

  return "/dashboard";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, isAuthenticated, setUser } = useAuth();

  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState({});
  const [assistance, setAssistance] = useState("");

  /*
    Important:
    An already authenticated first-time user must not be sent
    directly to the dashboard.
  */
  if (isAuthenticated && user) {
    return <Navigate to={getRequiredRoute(user)} replace />;
  }

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
      general: "",
    }));
  };

  const validateForm = () => {
    const validationErrors = {};
    const normalizedEmail = formData.email.trim();

    if (!normalizedEmail) {
      validationErrors.email = "Institutional email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      validationErrors.email = "Enter a valid institutional email address.";
    }

    if (!formData.password) {
      validationErrors.password = "Password is required.";
    }

    return validationErrors;
  };

  const completeLogin = (data) => {
    const authenticatedUser = extractUserFromResponse(data);

    if (!authenticatedUser) {
      console.error("Unexpected login response:", data);

      setErrors({
        general: "Login succeeded, but the backend did not return the authenticated user.",
      });

      return;
    }

    if (!VALID_ROLES.includes(authenticatedUser.role)) {
      setErrors({
        general: "Your account does not have a recognized My.GUIDE role.",
      });

      return;
    }

    /*
        Save the real authenticated user first so the required
        setup pages can read the account from AuthContext.
      */
    setUser(authenticatedUser);

    if (authenticatedUser.mustChangePassword === true) {
      navigate("/change-password", {
        replace: true,
      });
      return;
    }

    if (authenticatedUser.role === "Super-Admin") {
      navigate("/system", { replace: true });
      return;
    }

    if (authenticatedUser.profileCompleted === false) {
      navigate("/complete-profile", {
        replace: true,
      });
      return;
    }

    const requestedPath = location.state?.from;

    navigate(
      requestedPath && !["/login", "/change-password", "/complete-profile"].includes(requestedPath)
        ? requestedPath
        : "/dashboard",
      {
        replace: true,
      }
    );
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
      const data = await apiRequest("/auth", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });

      completeLogin(data);
    } catch (error) {
      console.error("Login error:", error);

      if (error.status === 401) {
        setErrors({
          general: "The email or password you entered is incorrect.",
        });
        return;
      }

      if (error.status === 403) {
        setErrors({
          general: error.message || "This account is not allowed to access My.GUIDE.",
        });
        return;
      }

      setErrors({
        general:
          error.message || "Unable to connect to the server. Confirm that the backend is running.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section
        className="login-brand"
        aria-label="My.GUIDE"
        style={{ "--login-building": `url("${buildingImage}")` }}
      >
        <div className="login-top-lines" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="login-brand-content">
          <img src={brandIcon} alt="" className="login-brand-icon" />
          <p className="login-wordmark">
            My.<span>GUIDE</span>
          </p>
          <p className="login-brand-description">
            Guidance, Unified Intervention, Documentation,
            <br /> Evaluation system
          </p>
        </div>
        <div className="login-circles" aria-hidden="true" />
      </section>
      <section className="login-panel">
        <button type="button" className="login-back" onClick={() => navigate("/")}>
          <span aria-hidden="true">←</span> Back to Home
        </button>
        <div className="login-form-content">
          <h1>Welcome back!</h1>
          <p className="login-subtitle">
            Sign in to your <span>My.GUIDE</span> account to continue.
          </p>
          {errors.general && (
            <p className="login-error login-general-error" role="alert">
              {errors.general}
            </p>
          )}
          <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
            <div className="login-field">
              <label htmlFor="email">Email Address</label>
              <div className={`login-input-wrap${errors.email ? " has-error" : ""}`}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={updateField}
                  autoComplete="username"
                  required
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="login-error" role="alert">
                  {errors.email}
                </p>
              )}
            </div>
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className={`login-input-wrap${errors.password ? " has-error" : ""}`}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={updateField}
                  autoComplete="current-password"
                  required
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} className="h-5 w-5" />
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="login-error" role="alert">
                  {errors.password}
                </p>
              )}
            </div>
            <div className="login-options">
              <label className="login-remember">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={updateField}
                />
                Keep me signed in
              </label>
              <button
                type="button"
                className="login-forgot"
                onClick={() => setAssistance("password")}
              >
                Forgot Password?
              </button>
            </div>
            <button type="submit" className="login-submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <p className="login-signup">
            Don’t have an account yet?{" "}
            <button type="button" onClick={() => setAssistance("account")}>
              Sign up here.
            </button>
          </p>
          {assistance && (
            <div className="login-assistance" role="status">
              <p>
                {assistance === "password"
                  ? "For password reset assistance, please contact your designated My.GUIDE system administrator at the MSU-IIT Office of Guidance and Counseling."
                  : "Accounts are created and managed by authorized system administrators. Contact your designated administrator at the MSU-IIT Office of Guidance and Counseling for account access."}
              </p>
              <button type="button" onClick={() => setAssistance("")}>
                Dismiss
              </button>
            </div>
          )}
        </div>
        <div className="login-bottom-lines" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>
    </main>
  );
}
