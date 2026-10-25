import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

export default function ChangeOwnPasswordPage({ open = true, onClose, onSuccess }) {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();

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
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSubmitting) {
        closeModal();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isSubmitting]);

  if (!open || !user) {
    return null;
  }

  const resetForm = () => {
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    });
    setErrors({});
    setSuccessMessage("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const closeModal = () => {
    if (isSubmitting) return;

    resetForm();

    if (onClose) {
      onClose();
    } else {
      navigate("/me");
    }
  };

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

    setSuccessMessage("");
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

    if (
      formData.currentPassword &&
      formData.newPassword &&
      formData.currentPassword === formData.newPassword
    ) {
      validationErrors.newPassword = "New password must be different from your current password.";
    }

    if (!formData.confirmNewPassword) {
      validationErrors.confirmNewPassword = "Confirm your new password.";
    } else if (formData.newPassword !== formData.confirmNewPassword) {
      validationErrors.confirmNewPassword = "New passwords do not match.";
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
    setSuccessMessage("");

    try {
      await apiRequest("/users/change-password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
          confirmNewPassword: formData.confirmNewPassword,
        }),
      });

      resetForm();
      setSuccessMessage("Your password was changed successfully.");

      if (onSuccess) {
        onSuccess("Your password was changed successfully.");
      }

      window.setTimeout(() => {
        if (onClose) onClose();
      }, 900);
    } catch (error) {
      console.error("Change password error:", error);

      if (error.status === 401) {
        setErrors({
          currentPassword: error.message || "Your current password is incorrect.",
        });
        return;
      }

      if (error.status === 403) {
        clearUser();
        navigate("/login", { replace: true });
        return;
      }

      setErrors({
        general: error.message || "Unable to change your password.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#211A18]/45 px-4 py-6 backdrop-blur-[5px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <button
        type="button"
        aria-label="Close change password window"
        onClick={closeModal}
        className="absolute inset-0 cursor-default"
      />

      <section className="relative z-10 w-full max-w-[430px] overflow-hidden rounded-2xl border border-[#E3DEDA] bg-white shadow-[0_24px_70px_rgba(34,20,17,0.28)]">
        <header className="flex items-start justify-between border-b border-[#EEE9E6] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F4E8E8] text-[#8C1518]">
              <Icon name="lock" className="h-4.5 w-4.5" />
            </div>

            <div>
              <h2 id="change-password-title" className="text-[20px] font-semibold text-[#302B28]">
                Change password
              </h2>

              <p className="mt-1 text-[14px] leading-4 text-[#8D8580]">
                Enter your current password and choose a new one.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={isSubmitting}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#89817D] transition hover:bg-[#F5F2F0] hover:text-[#8C1518] disabled:opacity-50"
            aria-label="Close"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="px-5 py-5" noValidate>
          {successMessage && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[14px] text-emerald-700">
              {successMessage}
            </div>
          )}

          {errors.general && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[14px] text-red-700">
              {errors.general}
            </div>
          )}

          <PasswordField
            id="currentPassword"
            name="currentPassword"
            label="Current password"
            value={formData.currentPassword}
            onChange={updateField}
            showPassword={showCurrentPassword}
            onToggle={() => setShowCurrentPassword((current) => !current)}
            error={errors.currentPassword}
            autoComplete="current-password"
          />

          <div className="mt-4">
            <PasswordField
              id="newPassword"
              name="newPassword"
              label="New password"
              value={formData.newPassword}
              onChange={updateField}
              showPassword={showNewPassword}
              onToggle={() => setShowNewPassword((current) => !current)}
              error={errors.newPassword}
              autoComplete="new-password"
            />
          </div>

          <div className="mt-4">
            <PasswordField
              id="confirmNewPassword"
              name="confirmNewPassword"
              label="Confirm new password"
              value={formData.confirmNewPassword}
              onChange={updateField}
              showPassword={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((current) => !current)}
              error={errors.confirmNewPassword}
              autoComplete="new-password"
            />
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#FAF6F6] px-3 py-2.5">
            <Icon name="check" className="mt-0.5 h-3 w-3 shrink-0 text-[#8C1518]" />
            <p className="text-[13px] leading-4 text-[#7F7672]">
              Use at least 8 characters and avoid reusing a password from another account.
            </p>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={isSubmitting}
              className="h-9 rounded-lg border border-[#DDD7D3] bg-white px-4 text-[15px] font-medium text-[#5E5753] transition hover:bg-[#F8F6F4] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#8C1518] px-4 text-[15px] font-semibold text-white transition hover:bg-[#701013] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating
                </>
              ) : (
                <>
                  <Icon name="check" className="h-3.5 w-3.5" />
                  Change password
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  showPassword,
  onToggle,
  error,
  autoComplete,
}) {
  return (
    <label className="block">
      <span className="text-[14px] font-semibold text-[#4B4541]">{label}</span>

      <div
        className={`mt-1.5 flex h-10 items-center rounded-lg border bg-white transition focus-within:ring-4 ${
          error
            ? "border-red-300 focus-within:ring-red-100"
            : "border-[#DDD8D4] focus-within:border-[#8C1518] focus-within:ring-[#8C1518]/[0.07]"
        }`}
      >
        <span className="pl-3 text-[#9C9692]">
          <Icon name="lock" className="h-3.5 w-3.5" />
        </span>

        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none"
        />

        <button
          type="button"
          onClick={onToggle}
          className="mr-1.5 grid h-7 w-7 place-items-center rounded-md text-[#9C9692] hover:bg-[#F5F2F0]"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          <Icon name={showPassword ? "eyeOff" : "eye"} className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && <p className="mt-1.5 text-[13px] text-red-600">{error}</p>}
    </label>
  );
}
