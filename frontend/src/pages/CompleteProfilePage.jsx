import { useEffect, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import Icon from "../components/Icon";
import Logo from "../components/Logo";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const COLLEGES = ["CASS", "CEBA", "CED", "CCS", "COE", "CSM", "CHS"];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAXIMUM_IMAGE_SIZE = 3 * 1024 * 1024;

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const { user, setUser, clearUser } = useAuth();

  const initialForm = useMemo(
    () => ({
      firstName: user?.firstName || "",
      middleName: user?.middleName || "",
      lastName: user?.lastName || "",

      designation: user?.designation || "Guidance Counselor",

      instituteIdNumber: user?.instituteIdNumber || "",

      contactNumber: user?.contactNumber || "",

      collegesHandled: Array.isArray(user?.collegesHandled) ? user.collegesHandled : [],

      profilePictureFile: null,

      profilePicturePreview: user?.profilePicture || "",
    }),
    [user]
  );

  const [formData, setFormData] = useState(initialForm);

  const [errors, setErrors] = useState({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData(initialForm);
  }, [initialForm]);

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

    if (user.profileCompleted === true) {
      navigate("/dashboard", {
        replace: true,
      });
    }
  }, [user, navigate]);

  useEffect(() => {
    return () => {
      if (formData.profilePicturePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(formData.profilePicturePreview);
      }
    };
  }, [formData.profilePicturePreview]);

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

  const toggleCollege = (college) => {
    setFormData((current) => {
      const isSelected = current.collegesHandled.includes(college);

      return {
        ...current,

        collegesHandled: isSelected
          ? current.collegesHandled.filter((item) => item !== college)
          : [...current.collegesHandled, college],
      };
    });

    setErrors((current) => ({
      ...current,
      collegesHandled: "",
      general: "",
    }));
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors((current) => ({
        ...current,

        profilePicture: "Select a JPG, PNG, or WEBP image.",
      }));

      event.target.value = "";
      return;
    }

    if (file.size > MAXIMUM_IMAGE_SIZE) {
      setErrors((current) => ({
        ...current,

        profilePicture: "The profile picture must not exceed 3 MB.",
      }));

      event.target.value = "";
      return;
    }

    setFormData((current) => {
      if (current.profilePicturePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(current.profilePicturePreview);
      }

      return {
        ...current,
        profilePictureFile: file,
        profilePicturePreview: URL.createObjectURL(file),
      };
    });

    setErrors((current) => ({
      ...current,
      profilePicture: "",
      general: "",
    }));
  };

  const removeSelectedPicture = () => {
    setFormData((current) => {
      if (current.profilePicturePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(current.profilePicturePreview);
      }

      return {
        ...current,
        profilePictureFile: null,
        profilePicturePreview: user?.profilePicture || "",
      };
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setErrors((current) => ({
      ...current,
      profilePicture: "",
    }));
  };

  const validateForm = () => {
    const validationErrors = {};

    if (!formData.firstName.trim()) {
      validationErrors.firstName = "First name is required.";
    }

    if (!formData.lastName.trim()) {
      validationErrors.lastName = "Last name is required.";
    }

    if (!formData.designation.trim()) {
      validationErrors.designation = "Designation is required.";
    }

    if (!formData.instituteIdNumber.trim()) {
      validationErrors.instituteIdNumber = "Institute ID number is required.";
    }

    if (!Array.isArray(formData.collegesHandled) || formData.collegesHandled.length === 0) {
      validationErrors.collegesHandled = "Select at least one college.";
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
      const payload = new FormData();

      payload.append("firstName", formData.firstName.trim());

      payload.append("middleName", formData.middleName.trim());

      payload.append("lastName", formData.lastName.trim());

      payload.append("designation", formData.designation.trim());

      payload.append("instituteIdNumber", formData.instituteIdNumber.trim().toUpperCase());

      payload.append("contactNumber", formData.contactNumber.trim());

      payload.append("collegesHandled", JSON.stringify(formData.collegesHandled));

      if (formData.profilePictureFile) {
        payload.append("profilePicture", formData.profilePictureFile);
      }

      const data = await apiRequest("/users/me/complete-profile", {
        method: "PATCH",
        body: payload,
      });

      const updatedUser = data?.user || {
        ...user,

        firstName: formData.firstName.trim(),

        middleName: formData.middleName.trim(),

        lastName: formData.lastName.trim(),

        designation: formData.designation.trim(),

        instituteIdNumber: formData.instituteIdNumber.trim().toUpperCase(),

        contactNumber: formData.contactNumber.trim(),

        collegesHandled: formData.collegesHandled,

        profileCompleted: true,
        mustChangePassword: false,
      };

      setUser({
        ...updatedUser,
        profileCompleted: true,
        mustChangePassword: false,
      });

      navigate("/dashboard", {
        replace: true,
      });
    } catch (error) {
      console.error("Profile completion error:", error);

      if (error.status === 401 || error.status === 403) {
        clearUser();

        navigate("/login", {
          replace: true,
        });

        return;
      }

      setErrors({
        general: error.message || "Unable to complete your profile.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = () => {
    clearUser();

    navigate("/login", {
      replace: true,
    });
  };

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#F7F5F3] font-[Poppins] lg:grid lg:grid-cols-[0.78fr_1.22fr]">
      {/* LEFT INFORMATION PANEL */}
      <section className="relative hidden min-h-screen overflow-hidden bg-[#731216] lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-36 h-[430px] w-[430px] rounded-full border-[75px] border-white/[0.035]" />

          <div className="absolute -bottom-44 -right-24 h-[440px] w-[440px] rounded-full bg-[#C9A84C]/10 blur-[110px]" />

          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20" />
        </div>

        <header className="relative z-10 px-10 pt-10 xl:px-14 xl:pt-12">
          <Logo variant="icon" light />
        </header>

        <div className="relative z-10 flex flex-1 items-center px-10 py-14 xl:px-14">
          <div className="max-w-md">
            <p className="text-[15px] font-semibold uppercase tracking-[0.2em] text-[#DFC066]">
              Final setup step
            </p>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-white xl:text-5xl">
              Tell us about
              <span className="block text-[#E0C268]">your counselor role.</span>
            </h1>

            <p className="mt-6 text-[15px] leading-7 text-white/60">
              Your profile information helps My.GUIDE identify you in case records, organize
              counselor responsibilities, and support accountable access.
            </p>

            <div className="mt-10 space-y-3">
              <ProfileReason
                icon="user"
                title="Accurate identity"
                description="Your official name and designation appear in records and activity histories."
              />

              <ProfileReason
                icon="student"
                title="College assignments"
                description="Your assigned colleges help organize counselor workload and case access."
              />

              <ProfileReason
                icon="shield"
                title="Account accountability"
                description="Your completed profile supports traceable handling of counseling records."
              />
            </div>
          </div>
        </div>

        <footer className="relative z-10 px-10 pb-10 text-[15px] text-white/35 xl:px-14">
          MSU-IIT Office of Guidance and Counseling
        </footer>
      </section>

      {/* PROFILE FORM PANEL */}
      <section className="flex min-h-screen flex-col bg-[#FAF9F8] px-5 py-5 sm:px-8 lg:px-10 xl:px-16">
        <header className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="hidden lg:block" />

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-[#68625F] transition hover:bg-white hover:text-[#8C1518]"
          >
            <Icon name="logout" className="h-4 w-4" />
            Sign out
          </button>
        </header>

        <div className="mx-auto flex w-full max-w-[780px] flex-1 flex-col justify-center py-10">
          <div className="mb-7">
            <div className="mb-6 hidden lg:block">
              <Logo />
            </div>

            <p className="text-[16px] font-semibold uppercase tracking-[0.2em] text-[#9A171B]">
              Counselor profile
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#201D1C] sm:text-4xl">
              Complete your profile
            </h2>

            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#746E6A]">
              Complete the required information before accessing the My.GUIDE dashboard.
            </p>
          </div>

          <ProgressSteps currentStep={2} />

          {errors.general && <ErrorAlert message={errors.general} />}

          <form
            onSubmit={handleSubmit}
            className="mt-7 rounded-2xl border border-[#E3DEDA] bg-white p-5 shadow-[0_14px_45px_rgba(45,30,25,0.045)] sm:p-7"
            noValidate
          >
            {/* PROFILE PICTURE */}
            <FormSection
              title="Profile picture"
              description="Add an optional photo for your counselor account."
            >
              <ProfilePictureUpload
                preview={formData.profilePicturePreview}
                selectedFile={formData.profilePictureFile}
                error={errors.profilePicture}
                fileInputRef={fileInputRef}
                onChange={handleProfilePictureChange}
                onRemove={removeSelectedPicture}
                user={user}
              />
            </FormSection>

            <div className="my-7 h-px bg-[#ECE8E5]" />

            {/* PERSONAL INFORMATION */}
            <FormSection
              title="Personal information"
              description="Enter your official account information."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="First name" required error={errors.firstName}>
                  <input
                    name="firstName"
                    value={formData.firstName}
                    onChange={updateField}
                    placeholder="First name"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Middle name">
                  <input
                    name="middleName"
                    value={formData.middleName}
                    onChange={updateField}
                    placeholder="Middle name"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Last name" required error={errors.lastName}>
                  <input
                    name="lastName"
                    value={formData.lastName}
                    onChange={updateField}
                    placeholder="Last name"
                    className={inputClass}
                  />
                </FormField>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormField label="Institute ID number" required error={errors.instituteIdNumber}>
                  <input
                    name="instituteIdNumber"
                    value={formData.instituteIdNumber}
                    onChange={updateField}
                    placeholder="EMP-2026-001"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Contact number">
                  <input
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={updateField}
                    placeholder="09XXXXXXXXX"
                    className={inputClass}
                  />
                </FormField>
              </div>
            </FormSection>

            <div className="my-7 h-px bg-[#ECE8E5]" />

            {/* COUNSELOR INFORMATION */}
            <FormSection
              title="Counselor information"
              description="Specify your position and assigned college responsibilities."
            >
              <FormField label="Designation" required error={errors.designation}>
                <input
                  name="designation"
                  value={formData.designation}
                  onChange={updateField}
                  placeholder="Guidance Counselor"
                  className={inputClass}
                />
              </FormField>

              <fieldset className="mt-5">
                <legend className="text-[15px] font-semibold text-[#45403D]">
                  Colleges handled
                  <span className="ml-1 text-red-600">*</span>
                </legend>

                <p className="mt-1 text-[15px] text-[#8E8782]">
                  Select at least one assigned college.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {COLLEGES.map((college) => {
                    const selected = formData.collegesHandled.includes(college);

                    return (
                      <label
                        key={college}
                        className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-[15px] font-medium transition ${
                          selected
                            ? "border-[#8C1518] bg-[#F8EEEE] text-[#8C1518]"
                            : "border-[#E2DDDA] bg-white text-[#6F6864] hover:border-[#BFAEAA]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCollege(college)}
                          className="accent-[#8C1518]"
                        />

                        {college}
                      </label>
                    );
                  })}
                </div>

                {errors.collegesHandled && (
                  <p className="mt-2 text-[13px] font-medium text-red-600">
                    {errors.collegesHandled}
                  </p>
                )}
              </fieldset>
            </FormSection>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[15px] leading-5 text-[#8A837F]">
                Required fields must be completed before continuing.
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-xl bg-[#8C1518] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#701013] focus:outline-none focus:ring-4 focus:ring-[#8C1518]/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving profile
                  </>
                ) : (
                  <>
                    Complete profile
                    <Icon
                      name="arrowRight"
                      className="h-4 w-4 transition group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function ProfilePictureUpload({
  preview,
  selectedFile,
  error,
  fileInputRef,
  onChange,
  onRemove,
  user,
}) {
  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();

  return (
    <div>
      <div
        className={`flex flex-col gap-5 rounded-xl border bg-[#FAF9F8] p-4 sm:flex-row sm:items-center ${
          error ? "border-red-300" : "border-[#DDD8D4]"
        }`}
      >
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#F1E7E7] text-xl font-semibold text-[#8C1518]">
          {preview ? (
            <img src={preview} alt="Profile preview" className="h-full w-full object-cover" />
          ) : (
            initials || <Icon name="user" className="h-8 w-8" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-[#3B3633]">Counselor profile photo</p>

          <p className="mt-1 text-[15px] leading-5 text-[#8A837F]">
            Upload a clear square image. JPG, PNG, and WEBP files are accepted up to 3 MB.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#D8D1CD] bg-white px-4 text-[15px] font-semibold text-[#4E4844] transition hover:border-[#8C1518] hover:text-[#8C1518]">
              <Icon name="user" className="h-3.5 w-3.5" />

              {selectedFile ? "Change image" : "Choose image"}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onChange}
                className="hidden"
              />
            </label>

            {selectedFile && (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-[15px] font-semibold text-red-600 transition hover:bg-red-50"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>

          {selectedFile && (
            <p className="mt-2 truncate text-[14px] font-medium text-[#8C1518]">
              {selectedFile.name}
            </p>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-[13px] font-medium text-red-600">{error}</p>}
    </div>
  );
}

function FormSection({ title, description, children }) {
  return (
    <section>
      <div>
        <h3 className="text-[17px] font-semibold text-[#302B28]">{title}</h3>

        <p className="mt-1 text-[15px] leading-5 text-[#8E8782]">{description}</p>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function FormField({ label, required, error, children }) {
  return (
    <label className="block">
      <span className="text-[15px] font-semibold text-[#45403D]">
        {label}

        {required && <span className="ml-1 text-red-600">*</span>}
      </span>

      <div className="mt-2">{children}</div>

      {error && <p className="mt-2 text-[13px] font-medium text-red-600">{error}</p>}
    </label>
  );
}

function ProfileReason({ icon, title, description }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.05] p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-[#DFC066]">
        <Icon name={icon} className="h-4 w-4" />
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

const inputClass =
  "h-11 w-full rounded-xl border border-[#DDD8D4] bg-white px-3.5 text-[15px] text-[#2D2926] outline-none transition placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-4 focus:ring-[#8C1518]/[0.07]";
