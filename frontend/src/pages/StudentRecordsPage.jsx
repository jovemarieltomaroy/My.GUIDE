import { clickableRecordProps } from "../utils/clickableRecord";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLE = "Counselor-Admin";

const COLLEGES = [
  "College of Engineering",
  "College of Science and Mathematics",
  "College of Computer Studies",
  "College of Education",
  "College of Arts and Social Sciences",
  "College of Economics, Business and Accountancy",
  "College of Health Sciences",
];

const YEAR_LEVELS = ["1", "2", "3", "4", "5", "Graduate", "Other"];

const ENROLLMENT_STATUSES = [
  "Enrolled",
  "Not Enrolled",
  "Leave of Absence",
  "Graduated",
  "Transferred",
  "Withdrawn",
  "Unknown",
];

const SEX_VALUES = ["", "Male", "Female", "Intersex", "Prefer not to say"];

const CIVIL_STATUSES = [
  "",
  "Single",
  "Married",
  "Divorced",
  "Widowed",
  "Separated",
  "Prefer not to say",
];

const PAGE_LIMIT = 25;

const EMPTY_MINIMUM_FORM = {
  studentIdNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  yearLevel: "1",
};

const EMPTY_STUDENT_FORM = {
  studentIdNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  contactNumber: "",
  college: "",
  program: "",
  permanentAddress: "",
  temporaryAddress: "",
  dateOfBirth: "",
  yearLevel: "1",
  enrollmentStatus: "Unknown",
  sex: "",
  gender: "",
  civilStatus: "",
  religion: "",
  emergencyContactName: "",
  emergencyContactNumber: "",
  emergencyContactRelationship: "",
};

export default function StudentRecordsPage() {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [students, setStudents] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [yearLevelFilter, setYearLevelFilter] = useState("");
  const [enrollmentFilter, setEnrollmentFilter] = useState("");
  const [profileFilter, setProfileFilter] = useState("");
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalEnrolledStudents, setTotalEnrolledStudents] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [minimumModalOpen, setMinimumModalOpen] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [minimumForm, setMinimumForm] = useState(EMPTY_MINIMUM_FORM);
  const [studentForm, setStudentForm] = useState(EMPTY_STUDENT_FORM);
  const [archiveReason, setArchiveReason] = useState("");
  const [selectedEnrollmentStatus, setSelectedEnrollmentStatus] = useState("Unknown");

  const [modalError, setModalError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = user?.role === ADMIN_ROLE;

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (user.mustChangePassword === true) {
      navigate("/change-password", { replace: true });
      return;
    }

    if (user.profileCompleted === false) {
      navigate("/complete-profile", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, yearLevelFilter, enrollmentFilter, profileFilter]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const fetchStudents = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setPageError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      });

      if (searchQuery) params.set("search", searchQuery);

      let endpoint = "/students";

      if (activeTab === "incomplete") {
        endpoint = "/students/incomplete";
      } else if (activeTab === "archived") {
        endpoint = "/students/archived";
      } else {
        if (yearLevelFilter) params.set("yearLevel", yearLevelFilter);
        if (enrollmentFilter) {
          params.set("enrollmentStatus", enrollmentFilter);
        }
        if (profileFilter) {
          params.set("profileCompleted", profileFilter);
        }
      }

      const [data, enrolledData] = await Promise.all([
        apiRequest(`${endpoint}?${params.toString()}`, { method: "GET" }),
        apiRequest("/students?enrollmentStatus=Enrolled&page=1&limit=1", {
          method: "GET",
        }),
      ]);

      if (!Number.isInteger(enrolledData?.totalStudents) || enrolledData.totalStudents < 0) {
        throw new Error("The backend returned an invalid enrolled student total.");
      }

      if (!Array.isArray(data?.students)) {
        throw new Error("The backend returned an invalid student response.");
      }

      setTotalEnrolledStudents(enrolledData.totalStudents);
      setStudents(data.students);
      setTotalStudents(data.totalStudents || 0);
      setTotalPages(Math.max(data.totalPages || 1, 1));
    } catch (error) {
      console.error("Unable to retrieve students:", error);

      if (error.status === 401) {
        clearUser();
        navigate("/login", { replace: true });
        return;
      }

      setPageError(error.message || "Unable to retrieve student records.");
    } finally {
      setIsLoading(false);
    }
  }, [
    user,
    page,
    searchQuery,
    activeTab,
    yearLevelFilter,
    enrollmentFilter,
    profileFilter,
    clearUser,
    navigate,
  ]);

  useEffect(() => {
    if (activeTab === "archived" && !isAdmin) {
      setActiveTab("active");
      return;
    }

    fetchStudents();
  }, [activeTab, isAdmin, fetchStudents, refreshVersion]);

  const summary = useMemo(() => {
    const complete = students.filter((student) => student.profileCompleted).length;
    const incomplete = students.filter((student) => !student.profileCompleted).length;

    return {
      displayed: students.length,
      complete,
      incomplete,
    };
  }, [students]);

  if (!user) return null;

  const openMinimumModal = () => {
    setMinimumForm(EMPTY_MINIMUM_FORM);
    setModalError("");
    setMinimumModalOpen(true);
  };

  const openStudentModal = async (student) => {
    setModalError("");
    setIsSaving(true);

    try {
      const data = await apiRequest(`/students/${student._id || student.id}`, {
        method: "GET",
      });

      const fullStudent = data?.student;

      if (!fullStudent) {
        throw new Error("The backend did not return the student record.");
      }

      setSelectedStudent(fullStudent);
      setStudentForm(mapStudentToForm(fullStudent));
      setEditingStudent(false);
      setStudentModalOpen(true);
    } catch (error) {
      setPageError(error.message || "Unable to open the student record.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEnrollmentModal = (student) => {
    setSelectedStudent(student);
    setSelectedEnrollmentStatus(student.enrollmentStatus || "Unknown");
    setModalError("");
    setEnrollmentModalOpen(true);
  };

  const openArchiveModal = (student) => {
    setSelectedStudent(student);
    setArchiveReason("");
    setModalError("");
    setArchiveModalOpen(true);
  };

  const createMinimumProfile = async (event) => {
    event.preventDefault();

    setIsSaving(true);
    setModalError("");

    try {
      const data = await apiRequest("/students/minimum-profile", {
        method: "POST",
        body: JSON.stringify({
          ...minimumForm,
          studentIdNumber: minimumForm.studentIdNumber.trim().toUpperCase(),
          firstName: minimumForm.firstName.trim(),
          middleName: minimumForm.middleName.trim(),
          lastName: minimumForm.lastName.trim(),
          email: minimumForm.email.trim().toLowerCase(),
        }),
      });

      setMinimumModalOpen(false);
      setSuccessMessage(data?.message || "Minimum student profile created successfully.");
      setActiveTab("incomplete");
      setPage(1);
      await fetchStudents();
    } catch (error) {
      setModalError(error.message || "Unable to create the student profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveStudent = async (event) => {
    event.preventDefault();

    if (!selectedStudent) return;

    setIsSaving(true);
    setModalError("");

    try {
      const endpoint = selectedStudent.profileCompleted
        ? `/students/${selectedStudent._id || selectedStudent.id}`
        : `/students/${selectedStudent._id || selectedStudent.id}/complete-profile`;

      const payload = {
        ...studentForm,
        studentIdNumber: studentForm.studentIdNumber.trim().toUpperCase(),
        firstName: studentForm.firstName.trim(),
        middleName: studentForm.middleName.trim(),
        lastName: studentForm.lastName.trim(),
        email: studentForm.email.trim().toLowerCase(),
        contactNumber: studentForm.contactNumber.trim(),
        college: studentForm.college.trim(),
        program: studentForm.program.trim(),
        permanentAddress: studentForm.permanentAddress.trim(),
        temporaryAddress: studentForm.temporaryAddress.trim(),
        gender: studentForm.gender.trim(),
        religion: studentForm.religion.trim(),
        emergencyContactName: studentForm.emergencyContactName.trim(),
        emergencyContactNumber: studentForm.emergencyContactNumber.trim(),
        emergencyContactRelationship: studentForm.emergencyContactRelationship.trim(),
      };

      if (!selectedStudent.profileCompleted) {
        delete payload.studentIdNumber;
      }

      if (selectedStudent.profileCompleted) {
        delete payload.enrollmentStatus;
      }

      const data = await apiRequest(endpoint, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setStudentModalOpen(false);
      setSuccessMessage(data?.message || "Student record updated successfully.");
      await fetchStudents();
    } catch (error) {
      setModalError(error.message || "Unable to update the student record.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveEnrollmentStatus = async (event) => {
    event.preventDefault();

    if (!selectedStudent) return;

    setIsSaving(true);
    setModalError("");

    try {
      const data = await apiRequest(
        `/students/${selectedStudent._id || selectedStudent.id}/enrollment-status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            enrollmentStatus: selectedEnrollmentStatus,
          }),
        }
      );

      setEnrollmentModalOpen(false);
      setSuccessMessage(data?.message || "Enrollment status updated successfully.");
      await fetchStudents();
    } catch (error) {
      setModalError(error.message || "Unable to update enrollment status.");
    } finally {
      setIsSaving(false);
    }
  };

  const archiveStudent = async (event) => {
    event.preventDefault();

    if (!selectedStudent) return;

    setIsSaving(true);
    setModalError("");

    try {
      const data = await apiRequest(
        `/students/${selectedStudent._id || selectedStudent.id}/archive`,
        {
          method: "PATCH",
          body: JSON.stringify({
            archiveReason: archiveReason.trim(),
          }),
        }
      );

      setArchiveModalOpen(false);
      setSuccessMessage(data?.message || "Student archived successfully.");
      await fetchStudents();
    } catch (error) {
      setModalError(error.message || "Unable to archive student record.");
    } finally {
      setIsSaving(false);
    }
  };

  const restoreStudent = async (student) => {
    const confirmed = window.confirm(
      `Restore ${formatStudentName(student)} to active student records?`
    );

    if (!confirmed) return;

    setPageError("");

    try {
      const data = await apiRequest(`/students/${student._id || student.id}/restore`, {
        method: "PATCH",
      });

      setSuccessMessage(data?.message || "Student restored successfully.");
      await fetchStudents();
    } catch (error) {
      setPageError(error.message || "Unable to restore student record.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#2F2A27]">
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
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
                <h1 className="text-[20px] font-semibold">Student Records</h1>
                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  Search, create, complete, and maintain student profiles
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openMinimumModal}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 font-semibold text-white hover:bg-[#701013]"
              style={{ fontSize: "15px" }}
            >
              <Icon name="plus" className="h-3 w-3" />
              Add student
            </button>
          </div>
        </header>

        <main className="page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7">
          {successMessage && <Alert tone="success" message={successMessage} />}

          {pageError && <Alert tone="error" message={pageError} />}

          <section>
            <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
              Student information directory
            </h2>

            <p className="mt-1 text-[14px] leading-4 text-[#89817D]">
              Records created during urgent intake may be completed after the counseling session.
            </p>
          </section>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label={activeTab === "archived" ? "Archived displayed" : "Records displayed"}
              value={summary.displayed}
              icon="student"
              tone="maroon"
            />
            <SummaryCard
              label="Complete profiles"
              value={summary.complete}
              icon="checkSquare"
              tone="green"
            />
            <SummaryCard
              label="Incomplete profiles"
              value={summary.incomplete}
              icon="alertTriangle"
              tone="gold"
            />
            <SummaryCard
              label="Currently enrolled"
              value={totalEnrolledStudents}
              icon="folder"
              tone="blue"
            />
          </div>

          <section className="mt-5 overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
            <div className="border-b border-[#ECE8E5] px-4 pt-4">
              <div className="flex flex-wrap gap-1">
                <TabButton active={activeTab === "active"} onClick={() => setActiveTab("active")}>
                  Active students
                </TabButton>

                <TabButton
                  active={activeTab === "incomplete"}
                  onClick={() => setActiveTab("incomplete")}
                >
                  Incomplete profiles
                </TabButton>

                {isAdmin && (
                  <TabButton
                    active={activeTab === "archived"}
                    onClick={() => setActiveTab("archived")}
                  >
                    Archived
                  </TabButton>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-[#ECE8E5] p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div>
                <h3 className="text-[17px] font-semibold">{getTabTitle(activeTab)}</h3>

                <p className="mt-1 text-[13px] text-[#938B86]">
                  {totalStudents} total matching record
                  {totalStudents === 1 ? "" : "s"}
                </p>
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-2 2xl:w-auto 2xl:grid-cols-[minmax(180px,240px)_140px_180px_155px_auto]">
                <div className="relative sm:col-span-2 2xl:col-span-1">
                  <Icon
                    name="search"
                    className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#AAA29D]"
                  />

                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search student..."
                    className="h-8 w-full min-w-0 rounded-lg border border-[#E1DCD8] bg-[#FAF9F8] pl-8 pr-2.5 outline-none focus:border-[#8C1518]"
                    style={{ fontSize: "15px" }}
                  />
                </div>

                {activeTab === "active" && (
                  <>
                    <select
                      value={yearLevelFilter}
                      onChange={(event) => setYearLevelFilter(event.target.value)}
                      className="h-8 w-full min-w-0 rounded-lg border border-[#E1DCD8] bg-white px-2.5 outline-none focus:border-[#8C1518]"
                      style={{ fontSize: "15px" }}
                    >
                      <option value="">All year levels</option>
                      {YEAR_LEVELS.map((year) => (
                        <option key={year} value={year}>
                          {formatYearLevel(year)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={enrollmentFilter}
                      onChange={(event) => setEnrollmentFilter(event.target.value)}
                      className="h-8 w-full min-w-0 rounded-lg border border-[#E1DCD8] bg-white px-2.5 outline-none focus:border-[#8C1518]"
                      style={{ fontSize: "15px" }}
                    >
                      <option value="">All enrollment statuses</option>
                      {ENROLLMENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    <select
                      value={profileFilter}
                      onChange={(event) => setProfileFilter(event.target.value)}
                      className="h-8 w-full min-w-0 rounded-lg border border-[#E1DCD8] bg-white px-2.5 outline-none focus:border-[#8C1518]"
                      style={{ fontSize: "15px" }}
                    >
                      <option value="">All profile statuses</option>
                      <option value="true">Complete</option>
                      <option value="false">Incomplete</option>
                    </select>
                  </>
                )}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setSearchInput("");
                    setSearchQuery("");
                    setYearLevelFilter("");
                    setEnrollmentFilter("");
                    setProfileFilter("");
                    setPage(1);
                    setRefreshVersion((current) => current + 1);
                  }}
                  title="Clear filters and refresh student records"
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[14px] font-medium text-[#625B57] hover:border-[#8C1518] hover:text-[#8C1518] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="history" className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Clear Filters
                </button>
              </div>
            </div>

            <StudentList
              students={students}
              isLoading={isLoading}
              activeTab={activeTab}
              onOpen={openStudentModal}
              onEnrollment={openEnrollmentModal}
              onRestore={restoreStudent}
            />

            <Pagination
              page={page}
              totalPages={totalPages}
              onPrevious={() => setPage((current) => Math.max(current - 1, 1))}
              onNext={() => setPage((current) => Math.min(current + 1, totalPages))}
            />
          </section>
        </main>
      </div>

      <MinimumProfileModal
        open={minimumModalOpen}
        form={minimumForm}
        setForm={setMinimumForm}
        error={modalError}
        saving={isSaving}
        onClose={() => setMinimumModalOpen(false)}
        onSubmit={createMinimumProfile}
      />

      <StudentProfileModal
        open={studentModalOpen}
        student={selectedStudent}
        form={studentForm}
        setForm={setStudentForm}
        error={modalError}
        saving={isSaving}
        onClose={() => setStudentModalOpen(false)}
        editing={editingStudent}
        onEdit={() => setEditingStudent(true)}
        onCancelEdit={() => {
          setStudentForm(mapStudentToForm(selectedStudent));
          setModalError("");
          setEditingStudent(false);
        }}
        canArchive={isAdmin && !selectedStudent?.isArchived}
        onArchive={() => {
          setStudentModalOpen(false);
          openArchiveModal(selectedStudent);
        }}
        onSubmit={saveStudent}
      />

      <EnrollmentModal
        open={enrollmentModalOpen}
        student={selectedStudent}
        value={selectedEnrollmentStatus}
        setValue={setSelectedEnrollmentStatus}
        error={modalError}
        saving={isSaving}
        onClose={() => setEnrollmentModalOpen(false)}
        onSubmit={saveEnrollmentStatus}
      />

      <ArchiveModal
        open={archiveModalOpen}
        student={selectedStudent}
        reason={archiveReason}
        setReason={setArchiveReason}
        error={modalError}
        saving={isSaving}
        onClose={() => setArchiveModalOpen(false)}
        onSubmit={archiveStudent}
      />
    </div>
  );
}

function StudentList({ students, isLoading, activeTab, onOpen, onEnrollment, onRestore }) {
  if (isLoading) {
    return (
      <div className="grid min-h-[340px] place-items-center">
        <div className="text-center">
          <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />
          <p className="mt-3 text-[14px] text-[#827B77]">Loading students...</p>
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="grid min-h-[340px] place-items-center px-5 text-center">
        <div>
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
            <Icon name="student" className="h-5 w-5" />
          </div>
          <p className="mt-4 text-[15px] font-semibold">No student records found</p>
          <p className="mt-1 text-[14px] text-[#938C87]">
            Adjust the filters or create a minimum student profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1080px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[25%]" />
            <col className="w-[17%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="bg-[#FAF9F8]">
            <tr className="border-b border-[#ECE8E5]">
              <Heading>Student</Heading>
              <Heading>Academic details</Heading>
              <Heading>Status</Heading>
              <Heading>Contact</Heading>
              <Heading align="right">Actions</Heading>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#EEEAE7]">
            {students.map((student) => (
              <tr
                key={student._id || student.id}
                {...(activeTab !== "archived"
                  ? clickableRecordProps(
                      () => onOpen(student),
                      `Open ${formatStudentName(student)}`
                    )
                  : {})}
                className={
                  activeTab !== "archived"
                    ? "clickable-record transition hover:bg-[#FCFBFA]"
                    : "transition hover:bg-[#FCFBFA]"
                }
              >
                <td className="px-5 py-5 align-top">
                  <p className="break-words text-[14px] font-semibold leading-5 text-[#37322F]">
                    {formatStudentName(student)}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-5 text-[#827A75]">
                    {student.studentIdNumber}
                  </p>
                </td>

                <td className="px-5 py-5 align-top">
                  <p className="text-[14px] leading-5 text-[#625B57]">
                    {student.college || "No college"}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-5 text-[#827A75]">
                    {student.program || "No program"}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[#958D88]">
                    {formatYearLevel(student.yearLevel)}
                  </p>
                </td>

                <td className="px-5 py-5 align-top">
                  <div className="flex flex-col items-start gap-2">
                    <EnrollmentBadge status={student.enrollmentStatus} />
                    <span className="text-[12px] leading-5 text-[#827A75]">
                      Profile: {student.profileCompleted ? "Complete" : "Incomplete"}
                    </span>
                  </div>
                </td>

                <td className="px-5 py-5 align-top">
                  <p className="break-words text-[13px] leading-5 text-[#625B57]">
                    {student.email || "No email"}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-5 text-[#827A75]">
                    {student.contactNumber || "No contact number"}
                  </p>
                </td>

                <td className="px-5 py-5 align-top">
                  <div className="flex flex-wrap justify-end gap-2">
                    {activeTab === "archived" ? (
                      <button
                        type="button"
                        onClick={() => onRestore(student)}
                        className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 font-semibold text-emerald-700"
                        style={{ fontSize: "12px" }}
                      >
                        Restore
                      </button>
                    ) : (
                      <>
                        <ActionButton onClick={() => onEnrollment(student)}>
                          Enrollment
                        </ActionButton>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[#EEEAE7] md:hidden">
        {students.map((student) => (
          <article
            key={student._id || student.id}
            {...(activeTab !== "archived"
              ? clickableRecordProps(() => onOpen(student), `Open ${formatStudentName(student)}`)
              : {})}
            className={activeTab !== "archived" ? "clickable-record p-4" : "p-4"}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[17px] font-semibold">{formatStudentName(student)}</h3>
                <p className="mt-1 text-[13px] text-[#938B86]">
                  {student.studentIdNumber} · {formatYearLevel(student.yearLevel)}
                </p>
              </div>

              <ProfileBadge complete={student.profileCompleted} />
            </div>

            <p className="mt-2 truncate text-[14px] text-[#625B57]">
              {student.college || "No college"} · {student.program || "No program"}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <EnrollmentBadge status={student.enrollmentStatus} />

              <div className="flex gap-1.5">
                {activeTab === "archived" ? (
                  <ActionButton onClick={() => onRestore(student)}>Restore</ActionButton>
                ) : (
                  <>
                    <ActionButton onClick={() => onEnrollment(student)}>Enrollment</ActionButton>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function MinimumProfileModal({ open, form, setForm, error, saving, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <Modal
      title="Create minimum student profile"
      description="Use this during intake when a student record does not yet exist."
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        {error && <Alert tone="error" message={error} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Student ID number" required>
            <input
              required
              value={form.studentIdNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  studentIdNumber: event.target.value.toUpperCase(),
                }))
              }
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Year level" required>
            <select
              value={form.yearLevel}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  yearLevel: event.target.value,
                }))
              }
              className={inputClass}
              style={{ fontSize: "15px" }}
            >
              {YEAR_LEVELS.map((year) => (
                <option key={year} value={year}>
                  {formatYearLevel(year)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="First name" required>
            <input
              required
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Middle name">
            <input
              value={form.middleName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  middleName: event.target.value,
                }))
              }
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Last name" required>
            <input
              required
              value={form.lastName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lastName: event.target.value,
                }))
              }
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Email address" required>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>
        </div>

        <ModalActions saving={saving} onClose={onClose} submitLabel="Create profile" />
      </form>
    </Modal>
  );
}

function StudentProfileModal({
  open,
  student,
  form,
  setForm,
  error,
  saving,
  onClose,
  onSubmit,
  editing,
  onEdit,
  onCancelEdit,
  canArchive,
  onArchive,
}) {
  if (!open || !student) return null;

  if (!editing) {
    const details = [
      ["Student ID", student.studentIdNumber],
      ["Year level", formatYearLevel(student.yearLevel)],
      ["College", student.college],
      ["Program", student.program],
      ["Enrollment", student.enrollmentStatus],
      ["Profile", student.profileCompleted ? "Complete" : "Incomplete"],
      ["Email", student.email],
      ["Contact number", student.contactNumber],
      ["Date of birth", form.dateOfBirth],
      ["Sex", student.sex],
      ["Gender", student.gender],
      ["Civil status", student.civilStatus],
      ["Religion", student.religion],
      ["Permanent address", student.permanentAddress],
      ["Temporary address", student.temporaryAddress],
      ["Emergency contact", student.emergencyContactName],
      ["Emergency contact number", student.emergencyContactNumber],
      ["Emergency contact relationship", student.emergencyContactRelationship],
    ];

    return (
      <Modal
        title="Student profile"
        description={formatStudentName(student)}
        onClose={onClose}
        wide
      >
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[12px] font-medium text-[#918984]">{label}</dt>
              <dd className="mt-1 break-words text-[14px] leading-6 text-[#3E3936]">
                {value || "Not provided"}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#ECE8E5] pt-4">
          <div>
            {canArchive && (
              <button
                type="button"
                onClick={onArchive}
                className="rounded-lg border border-red-200 px-4 py-2 text-[14px] font-medium text-red-600 hover:bg-red-50"
              >
                Archive student
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#DDD7D3] px-4 py-2 text-[14px] font-medium"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg bg-[#8C1518] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#701013]"
            >
              Edit profile
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <Modal
      title={student.profileCompleted ? "Edit student profile" : "Complete student profile"}
      description={`${student.studentIdNumber} · ${formatStudentName(student)}`}
      onClose={onClose}
      wide
    >
      <form onSubmit={onSubmit}>
        {error && <Alert tone="error" message={error} />}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Student ID number" required>
            <input
              required
              disabled={!student.profileCompleted}
              value={form.studentIdNumber}
              onChange={(event) => update("studentIdNumber", event.target.value.toUpperCase())}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="First name" required>
            <input
              required
              value={form.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Middle name">
            <input
              value={form.middleName}
              onChange={(event) => update("middleName", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Last name" required>
            <input
              required
              value={form.lastName}
              onChange={(event) => update("lastName", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Email address" required>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Contact number" required={!student.profileCompleted}>
            <input
              required={!student.profileCompleted}
              value={form.contactNumber}
              onChange={(event) => update("contactNumber", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="College" required={!student.profileCompleted}>
            <select
              required={!student.profileCompleted}
              value={form.college}
              onChange={(event) => update("college", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            >
              <option value="" disabled>
                Select college
              </option>

              {COLLEGES.map((college) => (
                <option key={college} value={college}>
                  {college}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Program" required={!student.profileCompleted}>
            <input
              required={!student.profileCompleted}
              value={form.program}
              onChange={(event) => update("program", event.target.value)}
              placeholder="BS Information Technology"
              onFocus={(event) => {
                event.currentTarget.placeholder = "";
              }}
              onBlur={(event) => {
                if (!event.currentTarget.value.trim()) {
                  event.currentTarget.placeholder = "BS Information Technology";
                }
              }}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Year level" required>
            <select
              value={form.yearLevel}
              onChange={(event) => update("yearLevel", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            >
              {YEAR_LEVELS.map((year) => (
                <option key={year} value={year}>
                  {formatYearLevel(year)}
                </option>
              ))}
            </select>
          </Field>

          {!student.profileCompleted && (
            <Field label="Enrollment status">
              <select
                value={form.enrollmentStatus}
                onChange={(event) => update("enrollmentStatus", event.target.value)}
                className={inputClass}
                style={{ fontSize: "15px" }}
              >
                {ENROLLMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Date of birth">
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => update("dateOfBirth", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Sex">
            <select
              value={form.sex}
              onChange={(event) => update("sex", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            >
              {SEX_VALUES.map((value) => (
                <option key={value || "empty"} value={value}>
                  {value || "Not specified"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Gender">
            <input
              value={form.gender}
              onChange={(event) => update("gender", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Civil status">
            <select
              value={form.civilStatus}
              onChange={(event) => update("civilStatus", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            >
              {CIVIL_STATUSES.map((value) => (
                <option key={value || "empty"} value={value}>
                  {value || "Not specified"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Religion">
            <input
              value={form.religion}
              onChange={(event) => update("religion", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Permanent address" className="sm:col-span-2 xl:col-span-3">
            <textarea
              value={form.permanentAddress}
              onChange={(event) => update("permanentAddress", event.target.value)}
              rows={3}
              className={textareaClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Temporary address" className="sm:col-span-2 xl:col-span-3">
            <textarea
              value={form.temporaryAddress}
              onChange={(event) => update("temporaryAddress", event.target.value)}
              rows={3}
              className={textareaClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <div className="sm:col-span-2 xl:col-span-3">
            <h4 className="border-b border-[#ECE8E5] pb-2 text-[15px] font-semibold">
              Emergency contact
            </h4>
          </div>

          <Field label="Contact name">
            <input
              value={form.emergencyContactName}
              onChange={(event) => update("emergencyContactName", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Contact number">
            <input
              value={form.emergencyContactNumber}
              onChange={(event) => update("emergencyContactNumber", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>

          <Field label="Relationship">
            <input
              value={form.emergencyContactRelationship}
              onChange={(event) => update("emergencyContactRelationship", event.target.value)}
              className={inputClass}
              style={{ fontSize: "15px" }}
            />
          </Field>
        </div>

        <ModalActions
          saving={saving}
          onClose={onCancelEdit}
          submitLabel={student.profileCompleted ? "Save changes" : "Complete profile"}
        />
      </form>
    </Modal>
  );
}

function EnrollmentModal({ open, student, value, setValue, error, saving, onClose, onSubmit }) {
  if (!open || !student) return null;

  return (
    <Modal
      title="Update enrollment status"
      description={`${student.studentIdNumber} · ${formatStudentName(student)}`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        {error && <Alert tone="error" message={error} />}

        <Field label="Enrollment status" required>
          <select
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={inputClass}
            style={{ fontSize: "15px" }}
          >
            {ENROLLMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <ModalActions saving={saving} onClose={onClose} submitLabel="Update status" />
      </form>
    </Modal>
  );
}

function ArchiveModal({ open, student, reason, setReason, error, saving, onClose, onSubmit }) {
  if (!open || !student) return null;

  return (
    <Modal
      title="Archive student record"
      description={`${student.studentIdNumber} · ${formatStudentName(student)}`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        {error && <Alert tone="error" message={error} />}

        <Field label="Archive reason" required>
          <textarea
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            className={textareaClass}
            style={{ fontSize: "15px" }}
          />
        </Field>

        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-4 text-red-700">
          Archiving removes this student from active searches and prevents profile updates until an
          administrator restores the record.
        </div>

        <ModalActions saving={saving} onClose={onClose} submitLabel="Archive student" danger />
      </form>
    </Modal>
  );
}

function Modal({ title, description, onClose, wide = false, children }) {
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close modal"
      />

      <section
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)] ${
          wide ? "max-w-[980px]" : "max-w-[560px]"
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#ECE8E5] px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">{title}</h2>
            <p className="mt-1 text-[14px] text-[#938B86]">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#8C847F] hover:bg-[#F4F1EF]"
            aria-label="Close"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  );
}

function ModalActions({ saving, onClose, submitLabel, danger = false }) {
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-[#ECE8E5] pt-4">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 font-medium text-[#5E5753]"
        style={{ fontSize: "15px" }}
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={saving}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 font-semibold text-white disabled:opacity-60 ${
          danger ? "bg-red-600 hover:bg-red-700" : "bg-[#8C1518] hover:bg-[#701013]"
        }`}
        style={{ fontSize: "15px" }}
      >
        {saving && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        {saving ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function SummaryCard({ label, value, icon, tone }) {
  const tones = {
    maroon: "border-[#A62A2E]/55 bg-[#F4E8E8] text-[#8C1518]",
    green: "border-[#5E8F3A]/55 bg-[#EAF4E5] text-[#398322]",
    gold: "border-[#D2A92D]/55 bg-[#FAF3DC] text-[#A47900]",
    blue: "border-[#3E79BA]/55 bg-[#EAF1F8] text-[#316FAE]",
  };

  const [border, background, text] = tones[tone].split(" ");

  return (
    <article className={`rounded-xl border bg-white p-4 ${border}`}>
      <div className={`grid h-8 w-8 place-items-center rounded-lg ${background} ${text}`}>
        <Icon name={icon} className="h-4 w-4" />
      </div>
      <p className="mt-3 text-[14px] text-[#8D8580]">{label}</p>
      <p className="mt-1 text-[18px] font-semibold">{value}</p>
    </article>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 pb-3 pt-1 font-semibold transition ${
        active
          ? "border-[#8C1518] text-[#8C1518]"
          : "border-transparent text-[#827A76] hover:text-[#4E4844]"
      }`}
      style={{ fontSize: "15px" }}
    >
      {children}
    </button>
  );
}

function ActionButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 whitespace-nowrap rounded-lg border border-[#DCD6D2] bg-white px-2.5 font-semibold text-[#5A534F] hover:border-[#8C1518] hover:text-[#8C1518]"
      style={{ fontSize: "12px" }}
    >
      {children}
    </button>
  );
}

function EnrollmentBadge({ status }) {
  const styles = {
    Enrolled: "bg-emerald-50 text-emerald-700",
    "Not Enrolled": "bg-slate-100 text-slate-700",
    "Leave of Absence": "bg-amber-50 text-amber-700",
    Graduated: "bg-blue-50 text-blue-700",
    Transferred: "bg-violet-50 text-violet-700",
    Withdrawn: "bg-red-50 text-red-700",
    Unknown: "bg-[#F1EEEC] text-[#6E6763]",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium ${
        styles[status] || styles.Unknown
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

function ProfileBadge({ complete }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium ${
        complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {complete ? "Complete" : "Incomplete"}
    </span>
  );
}

function Pagination({ page, totalPages, onPrevious, onNext }) {
  return (
    <div className="flex items-center justify-between border-t border-[#ECE8E5] px-4 py-3">
      <p className="text-[13px] text-[#938B86]">
        Page {page} of {totalPages}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page <= 1}
          className="h-7 rounded-lg border border-[#DDD7D3] px-2.5 font-semibold text-[#5E5753] disabled:opacity-40"
          style={{ fontSize: "15px" }}
        >
          Previous
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="h-7 rounded-lg border border-[#DDD7D3] px-2.5 font-semibold text-[#5E5753] disabled:opacity-40"
          style={{ fontSize: "15px" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Heading({ children, align = "left" }) {
  return (
    <th
      className={`px-5 py-4 text-[12px] font-semibold tracking-[0.04em] text-[#8E8782] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Field({ label, required = false, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[14px] font-semibold text-[#4B4541]">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Alert({ tone, message }) {
  const success = tone === "success";

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-[14px] ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

function mapStudentToForm(student) {
  return {
    studentIdNumber: student.studentIdNumber || "",
    firstName: student.firstName || "",
    middleName: student.middleName || "",
    lastName: student.lastName || "",
    email: student.email || "",
    contactNumber: student.contactNumber || "",
    college: student.college || "",
    program: student.program || "",
    permanentAddress: student.permanentAddress || "",
    temporaryAddress: student.temporaryAddress || "",
    dateOfBirth: formatDateInput(student.dateOfBirth),
    yearLevel: student.yearLevel || "1",
    enrollmentStatus: student.enrollmentStatus || "Unknown",
    sex: student.sex || "",
    gender: student.gender || "",
    civilStatus: student.civilStatus || "",
    religion: student.religion || "",
    emergencyContactName: student.emergencyContactName || "",
    emergencyContactNumber: student.emergencyContactNumber || "",
    emergencyContactRelationship: student.emergencyContactRelationship || "",
  };
}

function formatStudentName(student) {
  return [student?.firstName, student?.middleName, student?.lastName].filter(Boolean).join(" ");
}

function formatDateInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function formatYearLevel(value) {
  if (!value) return "—";

  if (["Graduate", "Other"].includes(value)) return value;

  return `Year ${value}`;
}

function getTabTitle(tab) {
  if (tab === "incomplete") return "Incomplete student profiles";
  if (tab === "archived") return "Archived student records";
  return "Active student records";
}

const inputClass =
  "h-8 w-full rounded-lg border border-[#DDD8D4] bg-white px-2.5 !text-[14px] font-[Poppins] text-[#302B28] outline-none transition placeholder:!text-[15px] placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06] disabled:bg-[#F5F2F0] disabled:text-[#918A86]";

const textareaClass =
  "min-h-[80px] w-full resize-y rounded-lg border border-[#DDD8D4] bg-white px-2.5 py-2 !text-[14px] font-[Poppins] leading-4 text-[#302B28] outline-none transition placeholder:!text-[15px] placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";
