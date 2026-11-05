const mongoose = require("mongoose");
const AsyncHandler = require("express-async-handler");
const Student = require("../models/student");

const ALLOWED_YEAR_LEVELS = ["1", "2", "3", "4", "5", "Graduate", "Other"];

const ALLOWED_ENROLLMENT_STATUSES = [
  "Enrolled",
  "Not Enrolled",
  "Leave of Absence",
  "Graduated",
  "Transferred",
  "Withdrawn",
  "Unknown",
];

const ALLOWED_SEX_VALUES = ["Male", "Female", "Intersex", "Prefer not to say"];

const ALLOWED_CIVIL_STATUSES = [
  "Single",
  "Married",
  "Divorced",
  "Widowed",
  "Separated",
  "Prefer not to say",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const hasText = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

const calculateProfileCompletion = (student) => {
  return Boolean(
    hasText(student.studentIdNumber) &&
      hasText(student.firstName) &&
      hasText(student.lastName) &&
      hasText(student.email) &&
      hasText(student.contactNumber) &&
      hasText(student.college) &&
      hasText(student.program) &&
      hasText(student.yearLevel)
  );
};
const COLLEGE_ALIASES = {
  CCS: ["CCS", "College of Computer Studies"],

  COET: ["COET", "College of Engineering and Technology"],

  CSM: ["CSM", "College of Science and Mathematics"],

  CED: ["CED", "College of Education"],

  CASS: ["CASS", "College of Arts and Social Sciences"],

  CEBA: ["CEBA", "College of Economics, Business and Accountancy"],

  CON: ["CON", "College of Nursing"],
};
const normalizeCollege = (college) => {
  if (!hasText(college)) {
    return "";
  }

  const normalizedValue = college.trim().toLowerCase();

  for (const [collegeCode, aliases] of Object.entries(COLLEGE_ALIASES)) {
    const matchesAlias = aliases.some((alias) => alias.toLowerCase() === normalizedValue);

    if (matchesAlias) {
      return collegeCode;
    }
  }

  return college.trim().toUpperCase();
};
// Student directory access spans colleges. Clinical records are protected by case ownership.
const buildStudentAccessQuery = (user, baseQuery = {}) => baseQuery;
const canAccessStudent = (user, student) => Boolean(student) && ["Counselor-Admin", "Counselor-User"].includes(user.role);
const canAssignCollege = (user, college) => ["Counselor-Admin", "Counselor-User"].includes(user.role) && hasText(college);
const searchStudentByIdNumber = AsyncHandler(async (req, res) => {
  const { studentIdNumber } = req.params;

  if (!studentIdNumber?.trim()) {
    return res.status(400).json({ message: "Student ID number is required." });
  }

  const normalizedStudentId = studentIdNumber.trim().toUpperCase();

  const student = await Student.findOne({
    studentIdNumber: normalizedStudentId,
    isArchived: false,
  });

  if (!student) {
    return res.status(404).json({
      message: "Active student record not found.",
      studentExists: false,
      student: null,
    });
  }

  if (!canAccessStudent(req.user, student)) {
    return res.status(403).json({
      message: "You are not authorized to access this student record.",
      studentExists: true,
      student: null,
    });
  }

  return res.status(200).json({
    message: "Student found.",
    studentExists: true,
    isArchived: false,
    profileCompleted: student.profileCompleted,
    student,
  });
});
const createMinimumStudentProfile = AsyncHandler(async (req, res) => {
  const {
    studentIdNumber,
    firstName,
    middleName,
    lastName,
    email,
    contactNumber,
    college,
    program,
    yearLevel,
  } = req.body;

  if (
    !studentIdNumber?.trim() ||
    !firstName?.trim() ||
    !lastName?.trim() ||
    !email?.trim() ||
    !yearLevel?.trim()
  ) {
    return res.status(400).json({
      message: "Student ID number, first name, last name, email, and year level are required.",
    });
  }

  /*
   * The New Case page only accepts numeric Student IDs.
   * We normalize it again here so the backend does not depend
   * entirely on frontend validation.
   */
  const normalizedStudentId = studentIdNumber
    .toString()
    .replace(/[^0-9-]/g, "")
    .trim();

  const normalizedEmail = email.trim().toLowerCase();

  const normalizedYearLevel = yearLevel.trim();

  const normalizedContactNumber = contactNumber?.trim() || "";

  const assignedColleges = [
    ...new Set(
      (req.user.collegesHandled || [])
        .filter((value) => typeof value === "string" && value.trim())
        .map(normalizeCollege)
    ),
  ];
  const normalizedCollege =
    college?.trim() || (assignedColleges.length === 1 ? assignedColleges[0] : "");

  const normalizedProgram = program?.trim() || "";

  if (!normalizedStudentId || !/^\d+(?:-\d+)*$/.test(normalizedStudentId)) {
    return res.status(400).json({
      message: "Student ID number may only contain numbers and hyphens.",
    });
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return res.status(400).json({
      message: "Please provide a valid email address.",
    });
  }

  if (!ALLOWED_YEAR_LEVELS.includes(normalizedYearLevel)) {
    return res.status(400).json({
      message: "Please provide a valid year level.",
    });
  }

  /*
   * If a college was supplied, make sure the counselor
   * is allowed to create/manage a student under that college.
   *
   * College remains optional for a minimum profile so a
   * walk-in student can still be recorded even when some
   * information is not yet available.
   */
  if (normalizedCollege && !canAssignCollege(req.user, normalizedCollege)) {
    return res.status(403).json({
      message: "You can only assign a student to one of your handled colleges.",
    });
  }

  /*
   * Prevent duplicate Student ID.
   */
  const existingStudentById = await Student.findOne({
    studentIdNumber: normalizedStudentId,
  });

  if (existingStudentById) {
    if (existingStudentById.isArchived) {
      return res.status(409).json({
        message:
          "An archived student record already uses this student ID. Restore the existing record instead of creating a new one.",
      });
    }

    return res.status(409).json({
      message: "A student record with this student ID already exists.",
    });
  }

  /*
   * Prevent duplicate email.
   */
  const existingStudentByEmail = await Student.findOne({
    email: normalizedEmail,
  });

  if (existingStudentByEmail) {
    if (existingStudentByEmail.isArchived) {
      return res.status(409).json({
        message:
          "An archived student record already uses this email address. Restore or review that record first.",
      });
    }

    return res.status(409).json({
      message: "A student record with this email address already exists.",
    });
  }

  /*
   * This is still a normal Student document.
   *
   * We do NOT create a separate TemporaryStudent collection.
   * profileCompleted:false identifies that the student still
   * needs to complete the remaining personal information.
   */
  const student = await Student.create({
    studentIdNumber: normalizedStudentId,

    firstName: firstName.trim(),

    middleName: middleName?.trim() || "",

    lastName: lastName.trim(),

    email: normalizedEmail,

    contactNumber: normalizedContactNumber,

    college: normalizedCollege,

    program: normalizedProgram,

    yearLevel: normalizedYearLevel,

    profileCompleted: false,

    isActive: true,

    isArchived: false,

    createdBy: req.user._id,
  });

  return res.status(201).json({
    message:
      "Minimum student profile created successfully. The remaining information can be completed after the counseling session.",

    profileCompleted: student.profileCompleted,

    student,
  });
});
const completeStudentProfile = AsyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid student record ID.",
    });
  }

  const student = await Student.findById(id);

  if (!student) {
    return res.status(404).json({
      message: "Student record not found.",
    });
  }

  if (student.isArchived) {
    return res.status(400).json({
      message: "Archived student records cannot be completed. Restore the record first.",
    });
  }

  if (!canAccessStudent(req.user, student)) {
    return res.status(403).json({
      message: "You are not authorized to complete this student profile.",
    });
  }

  const {
    firstName,
    middleName,
    lastName,
    email,
    contactNumber,
    college,
    program,
    temporaryAddress,
    permanentAddress,
    dateOfBirth,
    yearLevel,
    enrollmentStatus,
    sex,
    gender,
    civilStatus,
    religion,
    emergencyContactName,
    emergencyContactNumber,
    emergencyContactRelationship,
  } = req.body;

  const finalContactNumber =
    contactNumber !== undefined ? contactNumber.trim() : student.contactNumber;

  const finalCollege = college !== undefined ? college.trim() : student.college;

  const finalProgram = program !== undefined ? program.trim() : student.program;

  if (!finalContactNumber || !finalCollege || !finalProgram) {
    return res.status(400).json({
      message: "Contact number, college, and program are required to complete the student profile.",
    });
  }
  if (!canAssignCollege(req.user, finalCollege)) {
    return res.status(403).json({
      message: "You can only assign a student to one of your handled colleges.",
    });
  }

  if (firstName !== undefined && !firstName.trim()) {
    return res.status(400).json({
      message: "First name cannot be empty.",
    });
  }

  if (lastName !== undefined && !lastName.trim()) {
    return res.status(400).json({
      message: "Last name cannot be empty.",
    });
  }

  if (email !== undefined) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({
        message: "Email address cannot be empty.",
      });
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    const existingStudentByEmail = await Student.findOne({
      email: normalizedEmail,
      _id: {
        $ne: student._id,
      },
    });

    if (existingStudentByEmail) {
      return res.status(409).json({
        message: "Another student record already uses this email address.",
      });
    }

    student.email = normalizedEmail;
  }

  if (yearLevel !== undefined) {
    const normalizedYearLevel = yearLevel.trim();

    if (!ALLOWED_YEAR_LEVELS.includes(normalizedYearLevel)) {
      return res.status(400).json({
        message: "Please provide a valid year level.",
      });
    }

    student.yearLevel = normalizedYearLevel;
  }

  if (enrollmentStatus !== undefined && !ALLOWED_ENROLLMENT_STATUSES.includes(enrollmentStatus)) {
    return res.status(400).json({
      message: "Please provide a valid enrollment status.",
    });
  }

  if (sex !== undefined && sex !== "" && !ALLOWED_SEX_VALUES.includes(sex)) {
    return res.status(400).json({
      message: "Please provide a valid sex value.",
    });
  }

  if (
    civilStatus !== undefined &&
    civilStatus !== "" &&
    !ALLOWED_CIVIL_STATUSES.includes(civilStatus)
  ) {
    return res.status(400).json({
      message: "Please provide a valid civil status.",
    });
  }

  if (dateOfBirth !== undefined) {
    if (dateOfBirth === "" || dateOfBirth === null) {
      student.dateOfBirth = null;
    } else {
      const parsedDateOfBirth = new Date(dateOfBirth);

      if (Number.isNaN(parsedDateOfBirth.getTime())) {
        return res.status(400).json({
          message: "Please provide a valid date of birth.",
        });
      }

      if (parsedDateOfBirth > new Date()) {
        return res.status(400).json({
          message: "Date of birth cannot be in the future.",
        });
      }

      student.dateOfBirth = parsedDateOfBirth;
    }
  }

  if (firstName !== undefined) {
    student.firstName = firstName.trim();
  }

  if (middleName !== undefined) {
    student.middleName = middleName.trim();
  }

  if (lastName !== undefined) {
    student.lastName = lastName.trim();
  }

  student.contactNumber = finalContactNumber;

  student.college = finalCollege;

  student.program = finalProgram;

  if (temporaryAddress !== undefined) {
    student.temporaryAddress = temporaryAddress.trim();
  }

  if (permanentAddress !== undefined) {
    student.permanentAddress = permanentAddress.trim();
  }

  if (enrollmentStatus !== undefined) {
    student.enrollmentStatus = enrollmentStatus;
  }

  if (sex !== undefined) {
    student.sex = sex || undefined;
  }

  if (gender !== undefined) {
    student.gender = gender.trim();
  }

  if (civilStatus !== undefined) {
    student.civilStatus = civilStatus || undefined;
  }

  if (religion !== undefined) {
    student.religion = religion.trim();
  }

  if (emergencyContactName !== undefined) {
    student.emergencyContactName = emergencyContactName.trim();
  }

  if (emergencyContactNumber !== undefined) {
    student.emergencyContactNumber = emergencyContactNumber.trim();
  }

  if (emergencyContactRelationship !== undefined) {
    student.emergencyContactRelationship = emergencyContactRelationship.trim();
  }

  student.profileCompleted = calculateProfileCompletion(student);

  student.updatedBy = req.user._id;

  await student.save();

  return res.status(200).json({
    message: "Student profile completed successfully.",
    profileCompleted: student.profileCompleted,
    student,
  });
});
const updateStudent = AsyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid student record ID.",
    });
  }

  const student = await Student.findById(id);

  if (!student) {
    return res.status(404).json({
      message: "Student record not found.",
    });
  }

  if (student.isArchived) {
    return res.status(400).json({
      message: "Archived student records cannot be updated. Restore the record first.",
    });
  }
  if (!canAccessStudent(req.user, student)) {
    return res.status(403).json({
      message: "You are not authorized to update this student record.",
    });
  }

  const {
    studentIdNumber,
    firstName,
    middleName,
    lastName,
    email,
    contactNumber,
    college,
    program,
    temporaryAddress,
    permanentAddress,
    dateOfBirth,
    yearLevel,
    sex,
    gender,
    civilStatus,
    religion,
    emergencyContactName,
    emergencyContactNumber,
    emergencyContactRelationship,
  } = req.body;

  if (studentIdNumber !== undefined) {
    const normalizedStudentId = studentIdNumber.trim().toUpperCase();

    if (!normalizedStudentId) {
      return res.status(400).json({
        message: "Student ID number cannot be empty.",
      });
    }

    const existingStudentById = await Student.findOne({
      studentIdNumber: normalizedStudentId,
      _id: {
        $ne: student._id,
      },
    });

    if (existingStudentById) {
      return res.status(409).json({
        message: "Another student record already uses this student ID.",
      });
    }

    student.studentIdNumber = normalizedStudentId;
  }

  if (firstName !== undefined) {
    if (!firstName.trim()) {
      return res.status(400).json({
        message: "First name cannot be empty.",
      });
    }

    student.firstName = firstName.trim();
  }

  if (middleName !== undefined) {
    student.middleName = middleName.trim();
  }

  if (lastName !== undefined) {
    if (!lastName.trim()) {
      return res.status(400).json({
        message: "Last name cannot be empty.",
      });
    }

    student.lastName = lastName.trim();
  }

  if (email !== undefined) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({
        message: "Email address cannot be empty.",
      });
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    const existingStudentByEmail = await Student.findOne({
      email: normalizedEmail,
      _id: {
        $ne: student._id,
      },
    });

    if (existingStudentByEmail) {
      return res.status(409).json({
        message: "Another student record already uses this email address.",
      });
    }

    student.email = normalizedEmail;
  }

  if (contactNumber !== undefined) {
    student.contactNumber = contactNumber.trim();
  }

  if (college !== undefined) {
    const normalizedCollege = college.trim();

    if (!canAssignCollege(req.user, normalizedCollege)) {
      return res.status(403).json({
        message: "You can only assign a student to one of your handled colleges.",
      });
    }

    student.college = normalizedCollege;
  }

  if (program !== undefined) {
    student.program = program.trim();
  }

  if (temporaryAddress !== undefined) {
    student.temporaryAddress = temporaryAddress.trim();
  }
  if (permanentAddress !== undefined) {
    student.permanentAddress = permanentAddress.trim();
  }

  if (dateOfBirth !== undefined) {
    if (dateOfBirth === "" || dateOfBirth === null) {
      student.dateOfBirth = null;
    } else {
      const parsedDateOfBirth = new Date(dateOfBirth);

      if (Number.isNaN(parsedDateOfBirth.getTime())) {
        return res.status(400).json({
          message: "Please provide a valid date of birth.",
        });
      }

      if (parsedDateOfBirth > new Date()) {
        return res.status(400).json({
          message: "Date of birth cannot be in the future.",
        });
      }

      student.dateOfBirth = parsedDateOfBirth;
    }
  }

  if (yearLevel !== undefined) {
    const normalizedYearLevel = yearLevel.trim();

    if (!ALLOWED_YEAR_LEVELS.includes(normalizedYearLevel)) {
      return res.status(400).json({
        message: "Please provide a valid year level.",
      });
    }

    student.yearLevel = normalizedYearLevel;
  }

  if (sex !== undefined) {
    if (sex !== "" && !ALLOWED_SEX_VALUES.includes(sex)) {
      return res.status(400).json({
        message: "Please provide a valid sex value.",
      });
    }

    student.sex = sex || undefined;
  }

  if (gender !== undefined) {
    student.gender = gender.trim();
  }

  if (civilStatus !== undefined) {
    if (civilStatus !== "" && !ALLOWED_CIVIL_STATUSES.includes(civilStatus)) {
      return res.status(400).json({
        message: "Please provide a valid civil status.",
      });
    }

    student.civilStatus = civilStatus || undefined;
  }

  if (religion !== undefined) {
    student.religion = religion.trim();
  }

  if (emergencyContactName !== undefined) {
    student.emergencyContactName = emergencyContactName.trim();
  }

  if (emergencyContactNumber !== undefined) {
    student.emergencyContactNumber = emergencyContactNumber.trim();
  }

  if (emergencyContactRelationship !== undefined) {
    student.emergencyContactRelationship = emergencyContactRelationship.trim();
  }

  student.profileCompleted = calculateProfileCompletion(student);
  student.updatedBy = req.user._id;

  await student.save();

  return res.status(200).json({
    message: "Student information updated successfully.",
    profileCompleted: student.profileCompleted,
    student,
  });
});
const getAllStudents = AsyncHandler(async (req, res) => {
  const {
    search,
    college,
    program,
    yearLevel,
    enrollmentStatus,
    profileCompleted,
    page = 1,
    limit = 20,
  } = req.query;

  const query = buildStudentAccessQuery(req.user, {
    isArchived: false,
  });

  if (search?.trim()) {
    const searchValue = escapeRegex(search.trim());

    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),

      {
        $or: [
          {
            studentIdNumber: {
              $regex: searchValue,
              $options: "i",
            },
          },
          {
            firstName: {
              $regex: searchValue,
              $options: "i",
            },
          },
          {
            middleName: {
              $regex: searchValue,
              $options: "i",
            },
          },
          {
            lastName: {
              $regex: searchValue,
              $options: "i",
            },
          },
          {
            email: {
              $regex: searchValue,
              $options: "i",
            },
          },
          {
            college: {
              $regex: searchValue,
              $options: "i",
            },
          },
          {
            program: {
              $regex: searchValue,
              $options: "i",
            },
          },
        ],
      },
    ];
  }

  if (college?.trim()) {
    query.college = {
      $regex: `^${escapeRegex(college.trim())}$`,
      $options: "i",
    };
  }

  if (program?.trim()) {
    query.program = {
      $regex: `^${escapeRegex(program.trim())}$`,
      $options: "i",
    };
  }

  if (yearLevel?.trim()) {
    const normalizedYearLevel = yearLevel.trim();

    if (!ALLOWED_YEAR_LEVELS.includes(normalizedYearLevel)) {
      return res.status(400).json({
        message: "Please provide a valid year-level filter.",
      });
    }

    query.yearLevel = normalizedYearLevel;
  }

  if (enrollmentStatus?.trim()) {
    const normalizedEnrollmentStatus = enrollmentStatus.trim();

    if (!ALLOWED_ENROLLMENT_STATUSES.includes(normalizedEnrollmentStatus)) {
      return res.status(400).json({
        message: "Please provide a valid enrollment-status filter.",
      });
    }

    query.enrollmentStatus = normalizedEnrollmentStatus;
  }

  if (profileCompleted !== undefined) {
    if (!["true", "false"].includes(profileCompleted)) {
      return res.status(400).json({
        message: "profileCompleted must be either true or false.",
      });
    }

    query.profileCompleted = profileCompleted === "true";
  }

  const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);

  const limitNumber = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);

  const skip = (pageNumber - 1) * limitNumber;

  const [students, totalStudents] = await Promise.all([
    Student.find(query)
      .populate("createdBy updatedBy", "firstName middleName lastName email role")
      .sort({
        lastName: 1,
        firstName: 1,
      })
      .skip(skip)
      .limit(limitNumber),

    Student.countDocuments(query),
  ]);

  return res.status(200).json({
    message: "Students retrieved successfully.",
    totalStudents,
    currentPage: pageNumber,
    totalPages: Math.ceil(totalStudents / limitNumber),
    count: students.length,
    students,
  });
});
const getStudentById = AsyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid student record ID." });
  }
  const student = await Student.findOne({
    _id: id,
    isArchived: false,
  }).populate("createdBy updatedBy", "firstName middleName lastName email role collegesHandled");
  if (!student) {
    return res.status(404).json({ message: "Active student record not found." });
  }
  if (!canAccessStudent(req.user, student)) {
    return res
      .status(403)
      .json({ message: "You are not authorized to access this student record." });
  }
  return res.status(200).json({
    message: "Student retrieved successfully.",
    student,
  });
});
const getIncompleteProfiles = AsyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;

  const query = buildStudentAccessQuery(req.user, {
    profileCompleted: false,
    isArchived: false,
  });

  if (search?.trim()) {
    const searchValue = escapeRegex(search.trim());

    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),

      {
        $or: [
          {
            studentIdNumber: {
              $regex: searchValue,
              $options: "i",
            },
          },
          {
            firstName: {
              $regex: searchValue,
              $options: "i",
            },
          },
          {
            middleName: {
              $regex: searchValue,
              $options: "i",
            },
          },
          {
            lastName: {
              $regex: searchValue,
              $options: "i",
            },
          },
          {
            email: {
              $regex: searchValue,
              $options: "i",
            },
          },
        ],
      },
    ];
  }

  const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);

  const limitNumber = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);

  const skip = (pageNumber - 1) * limitNumber;

  const [students, totalStudents] = await Promise.all([
    Student.find(query)
      .populate("createdBy updatedBy", "firstName middleName lastName email role")
      .sort({
        updatedAt: -1,
      })
      .skip(skip)
      .limit(limitNumber),

    Student.countDocuments(query),
  ]);

  return res.status(200).json({
    message: "Incomplete student profiles retrieved successfully.",
    totalStudents,
    currentPage: pageNumber,
    totalPages: Math.ceil(totalStudents / limitNumber),
    count: students.length,
    students,
  });
});
const archiveStudent = AsyncHandler(async (req, res) => {
  const { id } = req.params;
  const { archiveReason } = req.body;

  if (req.user.role !== "Counselor-Admin") {
    return res.status(403).json({
      message: "Only a Counselor-Admin can archive student records.",
    });
  }

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid student record ID.",
    });
  }

  if (!archiveReason?.trim()) {
    return res.status(400).json({
      message: "Archive reason is required.",
    });
  }

  const student = await Student.findById(id);

  if (!student) {
    return res.status(404).json({
      message: "Student record not found.",
    });
  }

  if (student.isArchived) {
    return res.status(400).json({
      message: "Student record is already archived.",
    });
  }

  student.isArchived = true;
  student.isActive = false;
  student.archivedAt = new Date();
  student.archivedBy = req.user._id;
  student.archiveReason = archiveReason.trim();
  student.updatedBy = req.user._id;

  await student.save();

  return res.status(200).json({
    message: "Student record archived successfully.",
    student,
  });
});
const restoreStudent = AsyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== "Counselor-Admin") {
    return res.status(403).json({
      message: "Only a Counselor-Admin can restore student records.",
    });
  }

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid student record ID.",
    });
  }

  const student = await Student.findById(id);

  if (!student) {
    return res.status(404).json({
      message: "Student record not found.",
    });
  }

  if (!student.isArchived) {
    return res.status(400).json({
      message: "Student record is not archived.",
    });
  }

  student.isArchived = false;
  student.isActive = true;
  student.archivedAt = null;
  student.archivedBy = null;
  student.archiveReason = "";
  student.updatedBy = req.user._id;

  await student.save();

  return res.status(200).json({
    message: "Student record restored successfully.",
    student,
  });
});
const updateEnrollmentStatus = AsyncHandler(async (req, res) => {
  const { id } = req.params;
  const { enrollmentStatus } = req.body;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid student record ID.",
    });
  }

  if (!enrollmentStatus?.trim()) {
    return res.status(400).json({
      message: "Enrollment status is required.",
    });
  }

  const normalizedEnrollmentStatus = enrollmentStatus.trim();

  if (!ALLOWED_ENROLLMENT_STATUSES.includes(normalizedEnrollmentStatus)) {
    return res.status(400).json({
      message: "Please provide a valid enrollment status.",
    });
  }

  const student = await Student.findById(id);

  if (!student) {
    return res.status(404).json({
      message: "Student record not found.",
    });
  }

  if (student.isArchived) {
    return res.status(400).json({
      message:
        "Enrollment status cannot be updated for an archived student. Restore the record first.",
    });
  }
  if (!canAccessStudent(req.user, student)) {
    return res.status(403).json({
      message: "You are not authorized to update the enrollment status of this student.",
    });
  }

  student.enrollmentStatus = normalizedEnrollmentStatus;
  student.updatedBy = req.user._id;

  await student.save();

  return res.status(200).json({
    message: "Enrollment status updated successfully.",
    enrollmentStatus: student.enrollmentStatus,
    yearLevel: student.yearLevel,
    student,
  });
});
const getArchivedStudents = AsyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;

  if (req.user.role !== "Counselor-Admin") {
    return res.status(403).json({
      message: "Only a Counselor-Admin can view archived student records.",
    });
  }

  const query = {
    isArchived: true,
  };

  if (search?.trim()) {
    const searchValue = escapeRegex(search.trim());

    query.$or = [
      {
        studentIdNumber: {
          $regex: searchValue,
          $options: "i",
        },
      },
      {
        firstName: {
          $regex: searchValue,
          $options: "i",
        },
      },
      {
        middleName: {
          $regex: searchValue,
          $options: "i",
        },
      },
      {
        lastName: {
          $regex: searchValue,
          $options: "i",
        },
      },
      {
        email: {
          $regex: searchValue,
          $options: "i",
        },
      },
      {
        college: {
          $regex: searchValue,
          $options: "i",
        },
      },
      {
        program: {
          $regex: searchValue,
          $options: "i",
        },
      },
      {
        archiveReason: {
          $regex: searchValue,
          $options: "i",
        },
      },
    ];
  }

  const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);

  const limitNumber = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);

  const skip = (pageNumber - 1) * limitNumber;

  const [students, totalStudents] = await Promise.all([
    Student.find(query)
      .populate("archivedBy createdBy updatedBy", "firstName middleName lastName email role")
      .sort({
        archivedAt: -1,
      })
      .skip(skip)
      .limit(limitNumber),

    Student.countDocuments(query),
  ]);

  return res.status(200).json({
    message: "Archived student records retrieved successfully.",
    totalStudents,
    currentPage: pageNumber,
    totalPages: Math.ceil(totalStudents / limitNumber),
    count: students.length,
    students,
  });
});
module.exports = {
  searchStudentByIdNumber,
  createMinimumStudentProfile,
  completeStudentProfile,
  updateStudent,
  getAllStudents,
  getStudentById,
  getIncompleteProfiles,
  archiveStudent,
  restoreStudent,
  updateEnrollmentStatus,
  getArchivedStudents,
};
