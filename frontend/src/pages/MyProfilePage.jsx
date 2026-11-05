import { useEffect, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import Icon from "../components/Icon";
import AppSidebar from "../components/AppSidebar";
import ChangeOwnPasswordPage from "./ChangeOwnPasswordPage";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";

const COLLEGES = ["CASS", "CEBA", "CED", "CCS", "COE", "CSM", "CHS"];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

export default function MyProfilePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const { user, setUser, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [errors, setErrors] = useState({});

  const [successMessage, setSuccessMessage] = useState("");

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

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
    setFormData(initialForm);
  }, [initialForm]);

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

  useEffect(() => {
    return () => {
      if (formData.profilePicturePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(formData.profilePicturePreview);
      }
    };
  }, [formData.profilePicturePreview]);

  if (!user) {
    return null;
  }

  const isAdmin = user.role === ADMIN_ROLE;

  const menuGroups = isAdmin
    ? [
        {
          label: "Overview",
          items: [
            {
              name: "Dashboard",
              icon: "dashboard",
              path: "/dashboard",
            },
          ],
        },
        {
          label: "Management",
          items: [
            {
              name: "Student Records",
              icon: "student",
              path: "/students",
            },
            {
              name: "All Cases",
              icon: "folder",
              path: "/cases",
            },
          ],
        },
        {
          label: "Account",
          items: [
            {
              name: "My Profile",
              icon: "user",
              path: "/me",
            },
          ],
        },
      ]
    : [
        {
          label: "Main",
          items: [
            {
              name: "Dashboard",
              icon: "dashboard",
              path: "/dashboard",
            },
          ],
        },
        {
          label: "Case Management",
          items: [
            {
              name: "My Cases",
              icon: "folder",
              path: "/cases",
            },
            {
              name: "New Case",
              icon: "plus",
              path: "/cases/new",
            },
            {
              name: "Student Records",
              icon: "student",
              path: "/students",
            },
            {
              name: "Intervention Plans",
              icon: "heart",
              path: "/interventions",
            },
            {
              name: "Progress Notes",
              icon: "notes",
              path: "/progress-notes",
            },
          ],
        },
        {
          label: "Account",
          items: [
            {
              name: "My Profile",
              icon: "user",
              path: "/me",
            },
          ],
        },
      ];

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
    if (!isEditing) {
      return;
    }

    setFormData((current) => {
      const selected = current.collegesHandled.includes(college);

      return {
        ...current,
        collegesHandled: selected
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

    if (file.size > MAX_IMAGE_SIZE) {
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

  const cancelEditing = () => {
    if (formData.profilePicturePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(formData.profilePicturePreview);
    }

    setFormData(initialForm);
    setErrors({});
    setIsEditing(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

    setIsSaving(true);
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
      };

      setUser({
        ...user,
        ...updatedUser,
        profileCompleted: true,
      });

      setFormData((current) => ({
        ...current,
        profilePictureFile: null,

        profilePicturePreview: updatedUser.profilePicture || current.profilePicturePreview,
      }));

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setSuccessMessage("Your profile was updated successfully.");

      setIsEditing(false);
    } catch (error) {
      console.error("Profile update error:", error);

      if (error.status === 401 || error.status === 403) {
        clearUser();

        navigate("/login", {
          replace: true,
        });

        return;
      }

      setErrors({
        general: error.message || "Unable to update your profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    clearUser();

    navigate("/", {
      replace: true,
    });
  };

  return (
    <div className="authenticated-app min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#262220]">
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#E4DFDC] text-[#655E59] lg:hidden"
                aria-label="Open navigation"
              >
                <Icon name="menu" className="h-4 w-4" />
              </button>

              <div>
                <h1 className="text-[20px] font-semibold">My Profile</h1>

                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  View and manage your counselor account information
                </p>
              </div>
            </div>

            {!isEditing && (
              <button
                type="button"
                onClick={() => {
                  setErrors({});
                  setIsEditing(true);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#8C1518] px-4 text-[15px] font-semibold text-white transition hover:bg-[#701013]"
              >
                <Icon name="notes" className="h-3.5 w-3.5" />
                Edit profile
              </button>
            )}
          </div>
        </header>

        <main className="page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7 lg:w-[calc(100%-240px)]! lg:px-0!">
          {successMessage && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[15px] text-emerald-700">
              {successMessage}
            </div>
          )}

          {errors.general && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-700">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <section className="overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
              <div className="relative h-32 bg-gradient-to-r from-[#7D1718] to-[#9A292C] sm:h-40">
                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border-[45px] border-white/[0.05]" />
              </div>

              <div className="px-5 pb-6 sm:px-7">
                <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <ProfilePictureEditor
                      user={user}
                      preview={formData.profilePicturePreview}
                      selectedFile={formData.profilePictureFile}
                      isEditing={isEditing}
                      error={errors.profilePicture}
                      fileInputRef={fileInputRef}
                      onChange={handleProfilePictureChange}
                    />

                    <div className="pt-14 sm:pt-16">
                      <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#2D2825]">
                        {formatUserName(user)}
                      </h2>

                      <p className="mt-1 text-[15px] text-[#7E7773]">
                        {user.designation || "Guidance Counselor"}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <AccountBadge>{user.role}</AccountBadge>

                        <AccountBadge>
                          {user.isActive ? "Active account" : "Inactive account"}
                        </AccountBadge>
                      </div>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex gap-2 pt-14 sm:pt-16">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={isSaving}
                        className="h-9 rounded-lg border border-[#DDD7D3] bg-white px-4 text-[15px] font-medium text-[#5E5753] hover:bg-[#F8F6F4] disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#8C1518] px-4 text-[15px] font-semibold text-white hover:bg-[#701013] disabled:opacity-50"
                      >
                        {isSaving ? (
                          <>
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Saving
                          </>
                        ) : (
                          <>
                            <Icon name="check" className="h-3.5 w-3.5" />
                            Save changes
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              <section className="rounded-2xl border border-[#E4DFDC] bg-white p-5 sm:p-7">
                <SectionHeader
                  title="Personal information"
                  description="Your official counselor account details."
                />

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <ProfileField label="First name" error={errors.firstName}>
                    <input
                      name="firstName"
                      value={formData.firstName}
                      onChange={updateField}
                      disabled={!isEditing}
                      className={`${inputClass} !text-[15px]`}
                    />
                  </ProfileField>

                  <ProfileField label="Middle name">
                    <input
                      name="middleName"
                      value={formData.middleName}
                      onChange={updateField}
                      disabled={!isEditing}
                      className={`${inputClass} !text-[15px]`}
                    />
                  </ProfileField>

                  <ProfileField label="Last name" error={errors.lastName}>
                    <input
                      name="lastName"
                      value={formData.lastName}
                      onChange={updateField}
                      disabled={!isEditing}
                      className={`${inputClass} !text-[15px]`}
                    />
                  </ProfileField>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <ProfileField label="Email address">
                    <input
                      value={user.email || ""}
                      disabled
                      className={`${inputClass} !text-[15px]`}
                    />

                    <p className="mt-1.5 text-[13px] text-[#99918D]">
                      Email changes must be handled by an administrator in user management.
                    </p>
                  </ProfileField>

                  <ProfileField label="Institute ID number" error={errors.instituteIdNumber}>
                    <input
                      name="instituteIdNumber"
                      value={formData.instituteIdNumber}
                      disabled
                      className={`${inputClass} !text-[15px]`}
                    />
                  </ProfileField>

                  <ProfileField label="Designation" error={errors.designation}>
                    <input
                      name="designation"
                      value={formData.designation}
                      onChange={updateField}
                      disabled={!isEditing}
                      className={`${inputClass} !text-[15px]`}
                    />
                  </ProfileField>

                  <ProfileField label="Contact number">
                    <input
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={updateField}
                      disabled={!isEditing}
                      placeholder="09XXXXXXXXX"
                      className={`${inputClass} !text-[15px]`}
                    />
                  </ProfileField>
                </div>

                <div className="my-7 h-px bg-[#ECE8E5]" />

                <SectionHeader
                  title="Colleges handled"
                  description="College assignments associated with your counselor account."
                />

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {COLLEGES.map((college) => {
                    const selected = formData.collegesHandled.includes(college);

                    return (
                      <label
                        key={college}
                        className={`flex min-h-[42px] items-center gap-2 rounded-lg border px-3 text-[15px] font-medium transition ${
                          isEditing ? "cursor-pointer" : "cursor-default"
                        } ${
                          selected
                            ? "border-[#8C1518] bg-[#F8EEEE] text-[#8C1518]"
                            : "border-[#E2DDDA] bg-white text-[#837C78]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled
                          onChange={() => toggleCollege(college)}
                          className="accent-[#8C1518]"
                        />

                        {college}
                      </label>
                    );
                  })}
                </div>

                {errors.collegesHandled && (
                  <p className="mt-2 text-[13px] text-red-600">{errors.collegesHandled}</p>
                )}
              </section>

              <aside className="space-y-5">
                <section className="rounded-2xl border border-[#E4DFDC] bg-white p-5">
                  <SectionHeader
                    title="Account information"
                    description="System-controlled account details."
                  />

                  <div className="mt-5 divide-y divide-[#EEEAE7]">
                    <InformationRow label="Role" value={user.role} />

                    <InformationRow
                      label="Account status"
                      value={user.isActive ? "Active" : "Inactive"}
                    />

                    <InformationRow
                      label="Profile status"
                      value={user.profileCompleted ? "Complete" : "Incomplete"}
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-[#E4DFDC] bg-white p-5">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
                    <Icon name="lock" className="h-4 w-4" />
                  </div>

                  <h3 className="mt-4 text-[17px] font-semibold">Password and security</h3>

                  <p className="mt-2 text-[14px] leading-4 text-[#89827E]">
                    Change your password using your current password. This is separate from the
                    required first-time setup.
                  </p>

                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(true)}
                    className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#DDD7D3] bg-white px-4 text-[15px] font-semibold text-[#514B47] hover:border-[#8C1518] hover:text-[#8C1518]"
                  >
                    <Icon name="lock" className="h-3.5 w-3.5" />
                    Change password
                  </button>
                </section>
              </aside>
            </div>
          </form>
        </main>
      </div>

      {passwordModalOpen && (
        <ChangeOwnPasswordPage
          open={passwordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
          onSuccess={(message) => setSuccessMessage(message)}
        />
      )}
    </div>
  );
}

function ProfilePictureEditor({
  user,
  preview,
  selectedFile,
  isEditing,
  error,
  fileInputRef,
  onChange,
}) {
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();

  return (
    <div>
      <div className="relative h-28 w-28 rounded-2xl border-4 border-white bg-[#F1E7E7] shadow-lg sm:h-32 sm:w-32">
        <div className="grid h-full w-full place-items-center overflow-hidden rounded-xl text-xl font-semibold text-[#8C1518]">
          {preview ? (
            <img src={preview} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            initials || <Icon name="user" className="h-8 w-8" />
          )}
        </div>

        {isEditing && (
          <label className="absolute -bottom-2 -right-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[#8C1518] text-white shadow-lg transition hover:bg-[#701013]">
            <Icon name="user" className="h-4 w-4" />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      {selectedFile && (
        <p className="mt-2 max-w-28 truncate text-center text-[13px] font-medium text-[#8C1518]">
          {selectedFile.name}
        </p>
      )}

      {error && <p className="mt-2 max-w-32 text-[13px] leading-3 text-red-600">{error}</p>}
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div>
      <h3 className="text-[17px] font-semibold text-[#332E2B]">{title}</h3>

      <p className="mt-1 text-[14px] leading-4 text-[#918A86]">{description}</p>
    </div>
  );
}

function ProfileField({ label, error, children }) {
  return (
    <label className="block">
      <span className="text-[14px] font-semibold text-[#4B4541]">{label}</span>

      <div className="mt-1.5">{children}</div>

      {error && <p className="mt-1.5 text-[14px] text-red-600">{error}</p>}
    </label>
  );
}

function InformationRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[14px] text-[#89827E]">{label}</span>

      <span className="text-[14px] font-semibold text-[#3D3835]">{value || "—"}</span>
    </div>
  );
}

function AccountBadge({ children }) {
  return (
    <span className="rounded-full bg-[#F5EAEA] px-2.5 py-1 text-[13px] font-medium text-[#8C1518]">
      {children}
    </span>
  );
}

function UserAvatar({ user }) {
  if (user.profilePicture) {
    return (
      <img
        src={user.profilePicture}
        alt={formatUserName(user)}
        className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-white/15"
      />
    );
  }

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();

  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.11] text-[15px] font-semibold text-white ring-1 ring-white/[0.10]">
      {initials}
    </div>
  );
}

function formatUserName(user) {
  return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
}

const inputClass =
  "h-10 w-full rounded-lg border border-[#DDD8D4] bg-white px-3 text-[15px] text-[#302B28] outline-none transition placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-4 focus:ring-[#8C1518]/[0.06] disabled:cursor-default disabled:border-[#ECE8E5] disabled:bg-[#FAF9F8] disabled:text-[#6E6763]";
