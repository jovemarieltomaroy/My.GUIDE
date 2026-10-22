import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Icon from "../components/Icon";
import AppSidebar from "../components/AppSidebar";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../config/api";

const ADMIN_ROLE = "Counselor-Admin";
const USER_ROLE = "Counselor-User";

const USER_ROLES = [ADMIN_ROLE, USER_ROLE];

const COLLEGES = [
  "CCS",
  "CEBA",
  "CED",
  "COE",
  "CSM",
  "CASS",
  "CHS",
];

const EMPTY_CREATE_FORM = {
  email: "",
  password: "",
  confirmPassword: "",
};

const EMPTY_EDIT_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  designation: "",
  instituteIdNumber: "",
  contactNumber: "",
  dateJoinedAsCounselor: "",
  collegesHandled: [],
};

const EMPTY_PASSWORD_FORM = {
  newPassword: "",
  confirmNewPassword: "",
};

export default function UserManagementPage() {
  const navigate = useNavigate();
  const { user: currentUser, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [modal, setModal] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [adminPassword, setAdminPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  const isAdmin = currentUser?.role === ADMIN_ROLE;

  const currentUserId =
    currentUser?._id || currentUser?.id || null;

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setPageError("");

    try {
      const parameters = new URLSearchParams();

      if (searchQuery.trim()) {
        parameters.set("search", searchQuery.trim());
      }

      if (roleFilter) {
        parameters.set("role", roleFilter);
      }

      if (statusFilter !== "") {
        parameters.set("isActive", statusFilter);
      }

      const queryString = parameters.toString();

      const data = await apiRequest(
        `/users${queryString ? `?${queryString}` : ""}`,
        {
          method: "GET",
        },
      );

      if (!Array.isArray(data)) {
        throw new Error(
          "The backend returned an invalid users response.",
        );
      }

      setUsers(data);
    } catch (error) {
      console.error("Unable to retrieve users:", error);

      if (error.status === 401) {
        clearUser();
        navigate("/login", { replace: true });
        return;
      }

      setPageError(
        error.message || "Unable to retrieve users.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    roleFilter,
    statusFilter,
    clearUser,
    navigate,
  ]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login", { replace: true });
      return;
    }

    if (!isAdmin) {
      navigate("/dashboard", { replace: true });
      return;
    }

    fetchUsers();
  }, [
    currentUser,
    isAdmin,
    navigate,
    fetchUsers,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput);
    }, 400);

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

  const summary = useMemo(() => {
    return users.reduce(
      (result, account) => {
        result.total += 1;

        if (account.isActive) {
          result.active += 1;
        } else {
          result.inactive += 1;
        }

        if (account.role === ADMIN_ROLE) {
          result.admins += 1;
        }

        return result;
      },
      {
        total: 0,
        active: 0,
        inactive: 0,
        admins: 0,
      },
    );
  }, [users]);

  const openCreateModal = () => {
    setCreateForm(EMPTY_CREATE_FORM);
    setFormError("");
    setModal("create");
  };

  const openEditModal = (account) => {
    setSelectedUser(account);

    setEditForm({
      firstName: account.firstName || "",
      middleName: account.middleName || "",
      lastName: account.lastName || "",
      email: account.email || "",
      designation: account.designation || "",
      instituteIdNumber: account.instituteIdNumber || "",
      contactNumber: account.contactNumber || "",
      dateJoinedAsCounselor: formatDateForInput(
        account.dateJoinedAsCounselor,
      ),
      collegesHandled: Array.isArray(account.collegesHandled)
        ? account.collegesHandled
        : [],
    });

    setFormError("");
    setModal("edit");
  };

  const openRoleModal = (account) => {
    setSelectedUser(account);
    setSelectedRole(account.role || "");
    setAdminPassword("");
    setFormError("");
    setModal("role");
  };

  const openStatusModal = (account) => {
    setSelectedUser(account);
    setAdminPassword("");
    setFormError("");
    setModal("status");
  };

  const openResetPasswordModal = (account) => {
    setSelectedUser(account);
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setAdminPassword("");
    setFormError("");
    setModal("password");
  };

  const closeModal = () => {
    if (isSaving) {
      return;
    }

    setModal(null);
    setSelectedUser(null);
    setAdminPassword("");
    setSelectedRole("");
    setFormError("");
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setFormError("");

    const normalizedEmail = createForm.email
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      setFormError("Email is required.");
      return;
    }

    if (!createForm.password) {
      setFormError("Temporary password is required.");
      return;
    }

    if (createForm.password.length < 8) {
      setFormError(
        "Temporary password must contain at least 8 characters.",
      );
      return;
    }

    if (
      createForm.password !== createForm.confirmPassword
    ) {
      setFormError("Passwords do not match.");
      return;
    }

    setIsSaving(true);

    try {
      await apiRequest("/users", {
        method: "POST",
        body: JSON.stringify({
          email: normalizedEmail,
          password: createForm.password,
        }),
      });

      setSuccessMessage(
        "User account created successfully. The counselor must change the temporary password and complete the profile.",
      );

      closeModalAfterSave();
      await fetchUsers();
    } catch (error) {
      console.error("Unable to create user:", error);

      setFormError(
        error.message || "Unable to create user.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUser = async (event) => {
    event.preventDefault();
    setFormError("");

    const userId = getUserId(selectedUser);

    if (!userId) {
      setFormError("The selected user has no valid ID.");
      return;
    }

    if (!editForm.email.trim()) {
      setFormError("Email is required.");
      return;
    }

    setIsSaving(true);

    try {
      await apiRequest(`/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName: cleanOptionalString(
            editForm.firstName,
          ),
          middleName: cleanOptionalString(
            editForm.middleName,
          ),
          lastName: cleanOptionalString(
            editForm.lastName,
          ),
          email: editForm.email.trim().toLowerCase(),
          designation: cleanOptionalString(
            editForm.designation,
          ),
          instituteIdNumber: cleanOptionalString(
            editForm.instituteIdNumber,
          ),
          contactNumber: cleanOptionalString(
            editForm.contactNumber,
          ),
          dateJoinedAsCounselor:
            editForm.dateJoinedAsCounselor || null,
          collegesHandled: editForm.collegesHandled,
        }),
      });

      setSuccessMessage("User details updated successfully.");

      closeModalAfterSave();
      await fetchUsers();
    } catch (error) {
      console.error("Unable to update user:", error);

      setFormError(
        error.message || "Unable to update user.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRole = async (event) => {
    event.preventDefault();
    setFormError("");

    const userId = getUserId(selectedUser);

    if (!userId) {
      setFormError("The selected user has no valid ID.");
      return;
    }

    if (!USER_ROLES.includes(selectedRole)) {
      setFormError("Select a valid role.");
      return;
    }

    if (selectedRole === selectedUser.role) {
      setFormError("Select a different role.");
      return;
    }

    if (!adminPassword.trim()) {
      setFormError(
        "Enter your administrator password to confirm this action.",
      );
      return;
    }

    setIsSaving(true);

    try {
      await apiRequest(`/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({
          role: selectedRole,
          adminPassword,
        }),
      });

      setSuccessMessage("User role updated successfully.");

      closeModalAfterSave();
      await fetchUsers();
    } catch (error) {
      console.error("Unable to update role:", error);

      setFormError(
        error.message || "Unable to update role.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (event) => {
    event.preventDefault();
    setFormError("");

    const userId = getUserId(selectedUser);

    if (!userId) {
      setFormError("The selected user has no valid ID.");
      return;
    }

    if (!adminPassword.trim()) {
      setFormError(
        "Enter your administrator password to confirm this action.",
      );
      return;
    }

    const action = selectedUser.isActive
      ? "deactivate"
      : "reactivate";

    setIsSaving(true);

    try {
      await apiRequest(`/users/${userId}/${action}`, {
        method: "PATCH",
        body: JSON.stringify({ adminPassword }),
      });

      setSuccessMessage(
        selectedUser.isActive
          ? "User account deactivated successfully."
          : "User account reactivated successfully.",
      );

      closeModalAfterSave();
      await fetchUsers();
    } catch (error) {
      console.error("Unable to update account status:", error);

      setFormError(
        error.message ||
          "Unable to update account status.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setFormError("");

    const userId = getUserId(selectedUser);

    if (!userId) {
      setFormError("The selected user has no valid ID.");
      return;
    }

    if (!passwordForm.newPassword) {
      setFormError("New temporary password is required.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setFormError(
        "New temporary password must contain at least 8 characters.",
      );
      return;
    }

    if (
      passwordForm.newPassword !==
      passwordForm.confirmNewPassword
    ) {
      setFormError("Passwords do not match.");
      return;
    }

    if (!adminPassword.trim()) {
      setFormError(
        "Enter your administrator password to confirm this action.",
      );
      return;
    }

    setIsSaving(true);

    try {
      await apiRequest(
        `/users/${userId}/reset-password`,
        {
          method: "PUT",
          body: JSON.stringify({
            newPassword: passwordForm.newPassword,
            confirmNewPassword:
              passwordForm.confirmNewPassword,
            adminPassword,
          }),
        },
      );

      setSuccessMessage(
        "Password reset successfully. The user must change it during the next login.",
      );

      closeModalAfterSave();
      await fetchUsers();
    } catch (error) {
      console.error("Unable to reset password:", error);

      setFormError(
        error.message || "Unable to reset password.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const closeModalAfterSave = () => {
    setModal(null);
    setSelectedUser(null);
    setAdminPassword("");
    setSelectedRole("");
    setFormError("");
  };

  const toggleCollege = (college) => {
    setEditForm((current) => {
      const selected = current.collegesHandled.includes(
        college,
      );

      return {
        ...current,
        collegesHandled: selected
          ? current.collegesHandled.filter(
              (item) => item !== college,
            )
          : [...current.collegesHandled, college],
      };
    });
  };

  const handleLogout = () => {
    clearUser();
    navigate("/", { replace: true });
  };

  if (!currentUser || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#262220]">
      <AppSidebar
        user={currentUser}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#E4DFDC] text-[#655E59] lg:hidden"
              >
                <Icon name="menu" className="h-4 w-4" />
              </button>

              <div>
                <h1 className="text-[20px] font-semibold">
                  User Management
                </h1>

                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  Manage counselor accounts and system access
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#8C1518] px-4 text-[15px] font-semibold text-white transition hover:bg-[#701013]"
            >
              <Icon name="userPlus" className="h-3.5 w-3.5" />
              Create user
            </button>
          </div>
        </header>

        <main className="page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.03em] sm:text-xl">
                User Management
              </h2>

              <p className="mt-1 text-[15px] leading-5 text-[#8A837F]">
                Create accounts, update counselor information,
                manage roles, and control account access.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchUsers}
              disabled={isLoading}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#DDD7D3] bg-white px-4 !text-[15px] font-medium text-[#514B47] hover:bg-[#FAF8F7] disabled:opacity-50"
            >
              <Icon
                name="history"
                className={`h-3.5 w-3.5 ${
                  isLoading ? "animate-spin" : ""
                }`}
              />

              Refresh
            </button>
          </div>

          {successMessage && (
            <AlertMessage
              type="success"
              message={successMessage}
            />
          )}

          {pageError && (
            <AlertMessage
              type="error"
              message={pageError}
            />
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total accounts"
              value={summary.total}
              icon="users"
              tone="maroon"
            />

            <SummaryCard
              label="Active accounts"
              value={summary.active}
              icon="checkSquare"
              tone="green"
            />

            <SummaryCard
              label="Inactive accounts"
              value={summary.inactive}
              icon="alertTriangle"
              tone="gold"
            />

            <SummaryCard
              label="Administrators"
              value={summary.admins}
              icon="shield"
              tone="blue"
            />
          </div>

          <section className="mt-5 overflow-hidden rounded-xl border border-[#E5E1DE] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#ECE8E5] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-[17px] font-semibold">
                  Counselor accounts
                </h3>

                <p className="mt-1 text-[14px] text-[#98918D]">
                  Results are retrieved directly from the backend.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="relative">
                  <Icon
                    name="search"
                    className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#AAA29D]"
                  />

                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) =>
                      setSearchInput(event.target.value)
                    }
                    placeholder="Search users..."
                    className="h-9 w-full rounded-lg border border-[#E1DCD8] bg-[#FAF9F8] pl-9 pr-3 !text-[15px] outline-none focus:border-[#8C1518] focus:ring-4 focus:ring-[#8C1518]/[0.06] sm:w-[230px]"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(event.target.value)
                  }
                  className="h-9 rounded-lg border border-[#E1DCD8] bg-white px-3 !text-[15px] outline-none focus:border-[#8C1518]"
                >
                  <option value="">All roles</option>
                  <option value={ADMIN_ROLE}>
                    Counselor Admin
                  </option>
                  <option value={USER_ROLE}>
                    Counselor User
                  </option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                  className="h-9 rounded-lg border border-[#E1DCD8] bg-white px-3 !text-[15px] outline-none focus:border-[#8C1518]"
                >
                  <option value="">All statuses</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <UsersTable
              users={users}
              isLoading={isLoading}
              currentUserId={currentUserId}
              onEdit={openEditModal}
              onRole={openRoleModal}
              onStatus={openStatusModal}
              onResetPassword={openResetPasswordModal}
            />
          </section>
        </main>
      </div>

      {modal === "create" && (
        <Modal
          title="Create counselor account"
          description="The new account will use the Counselor-User role and must change its temporary password."
          onClose={closeModal}
        >
          <CreateUserForm
            form={createForm}
            setForm={setCreateForm}
            error={formError}
            isSaving={isSaving}
            onSubmit={handleCreateUser}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {modal === "edit" && selectedUser && (
        <Modal
          title="Edit user details"
          description={formatUserName(selectedUser)}
          onClose={closeModal}
          large
        >
          <EditUserForm
            form={editForm}
            setForm={setEditForm}
            error={formError}
            isSaving={isSaving}
            onSubmit={handleUpdateUser}
            onCancel={closeModal}
            toggleCollege={toggleCollege}
          />
        </Modal>
      )}

      {modal === "role" && selectedUser && (
        <Modal
          title="Change account role"
          description={formatUserName(selectedUser)}
          onClose={closeModal}
        >
          <RoleForm
            selectedUser={selectedUser}
            selectedRole={selectedRole}
            setSelectedRole={setSelectedRole}
            adminPassword={adminPassword}
            setAdminPassword={setAdminPassword}
            error={formError}
            isSaving={isSaving}
            onSubmit={handleUpdateRole}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {modal === "status" && selectedUser && (
        <Modal
          title={
            selectedUser.isActive
              ? "Deactivate account"
              : "Reactivate account"
          }
          description={formatUserName(selectedUser)}
          onClose={closeModal}
        >
          <StatusConfirmation
            selectedUser={selectedUser}
            adminPassword={adminPassword}
            setAdminPassword={setAdminPassword}
            error={formError}
            isSaving={isSaving}
            onConfirm={handleStatusChange}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {modal === "password" && selectedUser && (
        <Modal
          title="Reset user password"
          description={formatUserName(selectedUser)}
          onClose={closeModal}
        >
          <ResetPasswordForm
            form={passwordForm}
            setForm={setPasswordForm}
            adminPassword={adminPassword}
            setAdminPassword={setAdminPassword}
            error={formError}
            isSaving={isSaving}
            onSubmit={handleResetPassword}
            onCancel={closeModal}
          />
        </Modal>
      )}
    </div>
  );
}

function UsersTable({
  users,
  isLoading,
  currentUserId,
  onEdit,
  onRole,
  onStatus,
  onResetPassword,
}) {
  if (isLoading) {
    return (
      <div className="grid min-h-[320px] place-items-center">
        <div className="text-center">
          <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />

          <p className="mt-3 text-[15px] text-[#827B77]">
            Loading users...
          </p>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="grid min-h-[300px] place-items-center px-5 text-center">
        <div>
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#F5EAEA] text-[#8C1518]">
            <Icon name="users" className="h-5 w-5" />
          </div>

          <p className="mt-4 text-[16px] font-semibold">
            No users found
          </p>

          <p className="mt-1 text-[14px] text-[#938C87]">
            Adjust the filters or create a new counselor
            account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1020px] border-collapse">
        <thead className="bg-[#FAF9F8]">
          <tr className="border-b border-[#ECE8E5] text-left">
            <TableHeading>Account</TableHeading>
            <TableHeading>Institute ID</TableHeading>
            <TableHeading>Designation</TableHeading>
            <TableHeading>Colleges</TableHeading>
            <TableHeading>Role</TableHeading>
            <TableHeading>Status</TableHeading>
            <TableHeading>Profile</TableHeading>
            <TableHeading align="right">Actions</TableHeading>
          </tr>
        </thead>

        <tbody className="divide-y divide-[#EEEAE7]">
          {users.map((account) => {
            const accountId = getUserId(account);
            const isCurrentAccount =
              String(accountId) === String(currentUserId);

            return (
              <tr
                key={accountId}
                className="transition hover:bg-[#FCFBFA]"
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <TableAvatar user={account} />

                    <div className="min-w-0">
                      <p className="max-w-[210px] truncate text-[15px] font-semibold text-[#36312E]">
                        {formatUserName(account) ||
                          "Profile not completed"}

                        {isCurrentAccount && (
                          <span className="ml-2 text-[13px] font-medium text-[#8C1518]">
                            You
                          </span>
                        )}
                      </p>

                      <p className="mt-1 max-w-[220px] truncate text-[13px] text-[#918A86]">
                        {account.email}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3.5 text-[14px] text-[#68615D]">
                  {account.instituteIdNumber || "—"}
                </td>

                <td className="px-4 py-3.5 text-[14px] text-[#68615D]">
                  {account.designation || "—"}
                </td>

                <td className="px-4 py-3.5">
                  <CollegeList
                    colleges={account.collegesHandled}
                  />
                </td>

                <td className="px-4 py-3.5">
                  <RoleBadge role={account.role} />
                </td>

                <td className="px-4 py-3.5">
                  <StatusBadge active={account.isActive} />
                </td>

                <td className="px-4 py-3.5">
                  <ProfileBadge
                    completed={account.profileCompleted}
                  />
                </td>

                <td className="px-4 py-3.5">
                  <div className="flex justify-end gap-1.5">
                    <ActionButton
                      title="Edit user"
                      icon="notes"
                      onClick={() => onEdit(account)}
                    />

                    <ActionButton
                      title="Change role"
                      icon="shield"
                      onClick={() => onRole(account)}
                    />

                    <ActionButton
                      title="Reset password"
                      icon="lock"
                      onClick={() =>
                        onResetPassword(account)
                      }
                    />

                    {!isCurrentAccount && (
                      <ActionButton
                        title={
                          account.isActive
                            ? "Deactivate user"
                            : "Reactivate user"
                        }
                        icon={
                          account.isActive
                            ? "close"
                            : "check"
                        }
                        danger={account.isActive}
                        onClick={() => onStatus(account)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CreateUserForm({
  form,
  setForm,
  error,
  isSaving,
  onSubmit,
  onCancel,
}) {
  return (
    <form onSubmit={onSubmit}>
      {error && <FormError message={error} />}

      <FormField
        label="Institutional email"
        required
      >
        <input
          type="email"
          value={form.email}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              email: event.target.value,
            }))
          }
          placeholder="counselor@msuiit.edu.ph"
          className={inputClass}
        />
      </FormField>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Temporary password" required>
          <input
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            className={inputClass}
          />
        </FormField>

        <FormField label="Confirm password" required>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                confirmPassword: event.target.value,
              }))
            }
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="mt-4 rounded-lg border border-[#E7D9B2] bg-[#FCF7E9] p-3 text-[14px] leading-4 text-[#766229]">
        The backend creates this account as
        Counselor-User with `mustChangePassword: true` and
        `profileCompleted: false`.
      </div>

      <ModalActions
        isSaving={isSaving}
        submitLabel="Create account"
        onCancel={onCancel}
      />
    </form>
  );
}

function EditUserForm({
  form,
  setForm,
  error,
  isSaving,
  onSubmit,
  onCancel,
  toggleCollege,
}) {
  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <form onSubmit={onSubmit}>
      {error && <FormError message={error} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="First name">
          <input
            value={form.firstName}
            onChange={(event) =>
              update("firstName", event.target.value)
            }
            className={inputClass}
          />
        </FormField>

        <FormField label="Middle name">
          <input
            value={form.middleName}
            onChange={(event) =>
              update("middleName", event.target.value)
            }
            className={inputClass}
          />
        </FormField>

        <FormField label="Last name">
          <input
            value={form.lastName}
            onChange={(event) =>
              update("lastName", event.target.value)
            }
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Email" required>
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              update("email", event.target.value)
            }
            className={inputClass}
          />
        </FormField>

        <FormField label="Institute ID number">
          <input
            value={form.instituteIdNumber}
            onChange={(event) =>
              update(
                "instituteIdNumber",
                event.target.value,
              )
            }
            className={inputClass}
          />
        </FormField>

        <FormField label="Designation">
          <input
            value={form.designation}
            onChange={(event) =>
              update("designation", event.target.value)
            }
            className={inputClass}
          />
        </FormField>

        <FormField label="Contact number">
          <input
            value={form.contactNumber}
            onChange={(event) =>
              update("contactNumber", event.target.value)
            }
            className={inputClass}
          />
        </FormField>

        <FormField label="Date joined">
          <input
            type="date"
            value={form.dateJoinedAsCounselor}
            onChange={(event) =>
              update(
                "dateJoinedAsCounselor",
                event.target.value,
              )
            }
            className={inputClass}
          />
        </FormField>
      </div>

      <fieldset className="mt-4">
        <legend className="text-[14px] font-semibold text-[#49433F]">
          Colleges handled
        </legend>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COLLEGES.map((college) => {
            const selected =
              form.collegesHandled.includes(college);

            return (
              <label
                key={college}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[14px] transition ${
                  selected
                    ? "border-[#8C1518] bg-[#F8EEEE] text-[#8C1518]"
                    : "border-[#E4DFDC] bg-white text-[#6F6864]"
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
      </fieldset>

      <ModalActions
        isSaving={isSaving}
        submitLabel="Save changes"
        onCancel={onCancel}
      />
    </form>
  );
}

function RoleForm({
  selectedUser,
  selectedRole,
  setSelectedRole,
  adminPassword,
  setAdminPassword,
  error,
  isSaving,
  onSubmit,
  onCancel,
}) {
  return (
    <form onSubmit={onSubmit}>
      {error && <FormError message={error} />}

      <div className="grid gap-3">
        {USER_ROLES.map((role) => {
          const currentRole = selectedUser.role === role;
          const selected = selectedRole === role;

          return (
            <button
              key={role}
              type="button"
              disabled={isSaving || currentRole}
              onClick={() => setSelectedRole(role)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-[#8C1518] bg-[#F8EEEE]"
                  : "border-[#E3DEDA] bg-white hover:border-[#BDAEAA]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[15px] font-semibold">
                    {role === ADMIN_ROLE
                      ? "Counselor Administrator"
                      : "Counselor User"}
                  </p>

                  <p className="mt-1 text-[14px] leading-4 text-[#847D79]">
                    {role === ADMIN_ROLE
                      ? "Can manage users and view office-wide records and analytics."
                      : "Can access assigned cases and counselor-level functions."}
                  </p>
                </div>

                {currentRole && (
                  <span className="rounded-full bg-[#8C1518] px-2 py-1 text-[13px] font-medium text-white">
                    Current
                  </span>
                )}

                {!currentRole && selected && (
                  <span className="rounded-full bg-[#C9A84C] px-2 py-1 text-[13px] font-medium text-white">
                    Selected
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-[#ECE8E5] pt-4">
        <FormField label="Administrator password" required>
          <input
            type="password"
            value={adminPassword}
            onChange={(event) =>
              setAdminPassword(event.target.value)
            }
            placeholder="Enter your password"
            autoComplete="current-password"
            className={inputClass}
          />
        </FormField>

        <p className="mt-2 text-[13px] leading-4 text-[#918A86]">
          Enter your own password to authorize this role
          change.
        </p>
      </div>

      <ModalActions
        isSaving={isSaving}
        submitLabel="Confirm role change"
        onCancel={onCancel}
      />
    </form>
  );
}

function StatusConfirmation({
  selectedUser,
  adminPassword,
  setAdminPassword,
  error,
  isSaving,
  onConfirm,
  onCancel,
}) {
  const deactivating = selectedUser.isActive;

  return (
    <form onSubmit={onConfirm}>
      {error && <FormError message={error} />}

      <div
        className={`rounded-xl border p-4 ${
          deactivating
            ? "border-red-200 bg-red-50"
            : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <p
          className={`text-[15px] font-semibold ${
            deactivating
              ? "text-red-700"
              : "text-emerald-700"
          }`}
        >
          {deactivating
            ? "Deactivate this user?"
            : "Reactivate this user?"}
        </p>

        <p className="mt-2 text-[14px] leading-4 text-[#6F6864]">
          {deactivating
            ? "The account will no longer be allowed to access My.GUIDE until it is reactivated."
            : "The account will regain access to My.GUIDE."}
        </p>
      </div>

      <div className="mt-4">
        <FormField label="Administrator password" required>
          <input
            type="password"
            value={adminPassword}
            onChange={(event) =>
              setAdminPassword(event.target.value)
            }
            placeholder="Enter your password"
            autoComplete="current-password"
            className={inputClass}
          />
        </FormField>

        <p className="mt-2 text-[13px] leading-4 text-[#918A86]">
          Enter your own password to authorize this account
          status change.
        </p>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className={secondaryButtonClass}
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className={`rounded-lg px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-50 ${
            deactivating
              ? "bg-red-600 hover:bg-red-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {isSaving
            ? "Verifying..."
            : deactivating
              ? "Confirm deactivation"
              : "Confirm reactivation"}
        </button>
      </div>
    </form>
  );
}

function ResetPasswordForm({
  form,
  setForm,
  adminPassword,
  setAdminPassword,
  error,
  isSaving,
  onSubmit,
  onCancel,
}) {
  return (
    <form onSubmit={onSubmit}>
      {error && <FormError message={error} />}

      <FormField label="New temporary password" required>
        <input
          type="password"
          value={form.newPassword}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              newPassword: event.target.value,
            }))
          }
          className={inputClass}
        />
      </FormField>

      <div className="mt-4">
        <FormField label="Confirm temporary password" required>
          <input
            type="password"
            value={form.confirmNewPassword}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                confirmNewPassword: event.target.value,
              }))
            }
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="mt-4 border-t border-[#ECE8E5] pt-4">
        <FormField label="Administrator password" required>
          <input
            type="password"
            value={adminPassword}
            onChange={(event) =>
              setAdminPassword(event.target.value)
            }
            placeholder="Enter your own password"
            autoComplete="current-password"
            className={inputClass}
          />
        </FormField>

        <p className="mt-2 text-[13px] leading-4 text-[#918A86]">
          This is your current administrator password, not
          the user’s new temporary password.
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-[#E7D9B2] bg-[#FCF7E9] p-3 text-[14px] leading-4 text-[#766229]">
        The user will be required to change this password
        during the next login.
      </div>

      <ModalActions
        isSaving={isSaving}
        submitLabel="Reset password"
        onCancel={onCancel}
      />
    </form>
  );
}

function SidebarGroup({ label, items }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <p className="mb-1 px-2.5 text-[12px] font-semibold uppercase tracking-[0.15em] text-white/30">
        {label}
      </p>

      <div className="space-y-0.5">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={`flex h-[31px] w-full items-center gap-2 rounded-md px-2.5 text-[15px] transition ${
              item.active
                ? "bg-white/[0.12] font-semibold text-white"
                : "text-white/55 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            <Icon
              name={item.icon}
              className={`h-[13px] w-[13px] ${
                item.active
                  ? "text-[#E4C45D]"
                  : "text-white/40"
              }`}
            />

            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, tone }) {
  const tones = {
    maroon:
      "border-[#A62A2E]/60 bg-[#F4E8E8] text-[#8C1518]",
    green:
      "border-[#5E8F3A]/60 bg-[#EAF4E5] text-[#398322]",
    gold:
      "border-[#D2A92D]/60 bg-[#FAF3DC] text-[#A47900]",
    blue:
      "border-[#3E79BA]/60 bg-[#EAF1F8] text-[#316FAE]",
  };

  const [borderClass, backgroundClass, textClass] =
    tones[tone].split(" ");

  return (
    <article
      className={`rounded-xl border bg-white p-4 ${borderClass}`}
    >
      <div
        className={`grid h-8 w-8 place-items-center rounded-lg ${backgroundClass} ${textClass}`}
      >
        <Icon name={icon} className="h-4 w-4" />
      </div>

      <p className="mt-3 text-[14px] text-[#8D8580]">
        {label}
      </p>

      <p className="mt-1 text-xl font-semibold">
        {value}
      </p>
    </article>
  );
}

function Modal({
  title,
  description,
  children,
  onClose,
  large = false,
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section
        className={`relative z-10 w-full rounded-2xl border border-[#E3DEDA] bg-white shadow-2xl ${
          large ? "max-w-3xl" : "max-w-md"
        }`}
      >
        <header className="flex items-start justify-between border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-[14px] text-[#918A86]">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#827A76] hover:bg-[#F5F2F0]"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          {children}
        </div>
      </section>
    </div>
  );
}

function ModalActions({
  isSaving,
  submitLabel,
  onCancel,
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className={secondaryButtonClass}
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-lg bg-[#8C1518] px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-[#701013] disabled:opacity-50"
      >
        {isSaving ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-[14px] font-semibold text-[#49433F]">
        {label}

        {required && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </span>

      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function FormError({ message }) {
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[14px] leading-4 text-red-700">
      {message}
    </div>
  );
}

function AlertMessage({ type, message }) {
  const success = type === "success";

  return (
    <div
      className={`mt-5 rounded-xl border px-4 py-3 text-[15px] ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

function TableHeading({ children, align = "left" }) {
  return (
    <th
      className={`px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#8E8782] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function ActionButton({
  title,
  icon,
  onClick,
  danger = false,
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-md border transition ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-[#E3DEDA] text-[#6E6763] hover:border-[#BFAEAA] hover:bg-[#F7F4F2] hover:text-[#8C1518]"
      }`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
    </button>
  );
}

function TableAvatar({ user }) {
  if (user.profilePicture) {
    return (
      <img
        src={user.profilePicture}
        alt={formatUserName(user)}
        className="h-8 w-8 rounded-lg object-cover"
      />
    );
  }

  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F2E7E7] text-[14px] font-semibold text-[#8C1518]">
      {getInitials(user)}
    </div>
  );
}

function UserAvatar({ user }) {
  if (user.profilePicture) {
    return (
      <img
        src={user.profilePicture}
        alt={formatUserName(user)}
        className="h-8 w-8 rounded-lg object-cover"
      />
    );
  }

  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.11] text-[14px] font-semibold">
      {getInitials(user)}
    </div>
  );
}

function RoleBadge({ role }) {
  const admin = role === ADMIN_ROLE;

  return (
    <span
      className={`rounded-full px-2 py-1 text-[13px] font-medium ${
        admin
          ? "bg-[#F3E8F7] text-[#7B358F]"
          : "bg-[#EAF1F8] text-[#316FAE]"
      }`}
    >
      {admin ? "Admin" : "Counselor"}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-red-500"
        }`}
      />

      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ProfileBadge({ completed }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[13px] font-medium ${
        completed
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {completed ? "Complete" : "Incomplete"}
    </span>
  );
}

function CollegeList({ colleges }) {
  if (!Array.isArray(colleges) || colleges.length === 0) {
    return (
      <span className="text-[14px] text-[#AAA29D]">
        —
      </span>
    );
  }

  const visible = colleges.slice(0, 2);
  const remaining = colleges.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((college) => (
        <span
          key={college}
          className="rounded bg-[#F2EFED] px-1.5 py-1 text-[12px] font-medium text-[#645D59]"
        >
          {college}
        </span>
      ))}

      {remaining > 0 && (
        <span className="rounded bg-[#F2EFED] px-1.5 py-1 text-[12px] font-medium text-[#645D59]">
          +{remaining}
        </span>
      )}
    </div>
  );
}

function getUserId(user) {
  return user?._id || user?.id || null;
}

function getInitials(user) {
  return `${user?.firstName?.[0] || ""}${
    user?.lastName?.[0] || ""
  }`.toUpperCase();
}

function formatUserName(user) {
  return [
    user?.firstName,
    user?.middleName,
    user?.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDateForInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function cleanOptionalString(value) {
  const normalized = value.trim();
  return normalized || "";
}

const inputClass =
  "h-10 w-full rounded-lg border border-[#DFDAD6] bg-white px-3 text-[15px] text-[#302B28] outline-none transition placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-4 focus:ring-[#8C1518]/[0.06]";

const secondaryButtonClass =
  "rounded-lg border border-[#DDD7D3] bg-white px-4 py-2.5 text-[15px] font-medium text-[#5E5753] hover:bg-[#F8F6F4] disabled:opacity-50";