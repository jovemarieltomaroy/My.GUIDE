const crypto = require("crypto");

const AsyncHandler = require("express-async-handler");

const PreCounselingForm = require("../models/preCounselingForm");

const Student = require("../models/student");

const transporter = require("../config/emailTransporter");

/*
 * Creates a secure random token.
 *
 * Only the hashed version is stored in MongoDB.
 * The original token is placed in the email link.
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const sendPreCounselingForm = AsyncHandler(async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({
      message: "Student is required.",
    });
  }

  const student = await Student.findById(studentId);

  if (!student) {
    return res.status(404).json({
      message: "Student record not found.",
    });
  }

  if (student.isArchived) {
    return res.status(400).json({
      message: "Cannot send a pre-counseling form to an archived student.",
    });
  }

  if (!student.email) {
    return res.status(400).json({
      message: "The student does not have an email address.",
    });
  }

  // Expire previous pending forms so only the newest link is active.
  await PreCounselingForm.updateMany(
    {
      student: student._id,
      status: "Pending",
    },
    {
      $set: {
        status: "Expired",
      },
    }
  );

  const rawToken = generateToken();
  const hashedToken = hashToken(rawToken);

  // Link is valid for 7 days.
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const form = await PreCounselingForm.create({
    student: student._id,
    requestedBy: req.user._id,
    token: hashedToken,
    tokenExpiresAt,
    status: "Pending",
  });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5174";

  const formUrl = `${frontendUrl}/pre-counseling/${rawToken}`;

  const studentName = [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ");

  /*
   * Start sending the email, but DO NOT wait for Gmail
   * before responding to the counselor.
   */
  transporter
    .sendMail({
      to: student.email,
      subject: "My.GUIDE Pre-Counseling Form",
      html: `
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 620px;
                    margin: 0 auto;
                    padding: 24px;
                    color: #222;
                ">
                    <h2 style="
                        color: #7D1718;
                        margin-bottom: 16px;
                    ">
                        My.GUIDE Pre-Counseling Form
                    </h2>

                    <p>
                        Hello ${studentName},
                    </p>

                    <p>
                        You have been requested to complete
                        a pre-counseling form before your
                        counseling session with the Office
                        of Guidance and Counseling.
                    </p>

                    <p>
                        The form includes your consent and
                        background information that may help
                        the counselor prepare for your
                        counseling session.
                    </p>

                    <p>
                        Please complete the form using the
                        button below.
                    </p>

                    <div style="margin: 28px 0;">
                        <a
                            href="${formUrl}"
                            style="
                                display: inline-block;
                                background: #7D1718;
                                color: #ffffff;
                                text-decoration: none;
                                padding: 12px 22px;
                                border-radius: 6px;
                                font-weight: 600;
                            "
                        >
                            Complete Pre-Counseling Form
                        </a>
                    </div>

                    <p>
                        This link will expire in 7 days.
                    </p>

                    <p style="
                        font-size: 13px;
                        color: #666;
                        margin-top: 28px;
                    ">
                        If you were not expecting this email,
                        please contact the Office of Guidance
                        and Counseling.
                    </p>
                </div>
            `,
    })
    .then(() => {
      console.log(`Pre-counseling email sent to ${student.email}`);
    })
    .catch(async (error) => {
      console.error("Pre-counseling email error:", error);

      /*
       * Email failed, so remove the pending form.
       * The link was never successfully delivered.
       */
      try {
        await PreCounselingForm.findOneAndDelete({
          _id: form._id,
          status: "Pending",
        });
      } catch (cleanupError) {
        console.error("Failed to clean up pre-counseling form:", cleanupError);
      }
    });

  /*
   * Respond immediately.
   * We are NOT waiting for Gmail here.
   */
  return res.status(202).json({
    message: "Pre-counseling form queued for email delivery.",

    form: {
      _id: form._id,
      student: student._id,
      email: student.email,
      status: form.status,
      tokenExpiresAt: form.tokenExpiresAt,
      createdAt: form.createdAt,
    },
  });
});

/*
 * =========================================================
 * GET PUBLIC PRE-COUNSELING FORM
 * =========================================================
 *
 * Public route.
 * No counselor login is required.
 *
 * The token acts as access to this specific form.
 */
const getPublicPreCounselingForm = AsyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      message: "Pre-counseling form token is required.",
    });
  }

  const hashedToken = hashToken(token);

  const form = await PreCounselingForm.findOne({
    token: hashedToken,
  }).populate(
    "student",
    "firstName middleName lastName studentIdNumber email college program yearLevel"
  );

  if (!form) {
    return res.status(404).json({
      message: "Pre-counseling form not found or the link is invalid.",
    });
  }

  if (form.status === "Submitted") {
    return res.status(409).json({
      message: "This pre-counseling form has already been submitted.",
      status: "Submitted",
    });
  }

  if (form.status === "Expired" || form.tokenExpiresAt < new Date()) {
    if (form.status !== "Expired") {
      form.status = "Expired";

      await form.save();
    }

    return res.status(410).json({
      message: "This pre-counseling form link has expired.",
      status: "Expired",
    });
  }

  return res.status(200).json({
    message: "Pre-counseling form retrieved successfully.",

    form: {
      student: form.student,

      status: form.status,

      tokenExpiresAt: form.tokenExpiresAt,
    },
  });
});

/*
 * =========================================================
 * SUBMIT PUBLIC PRE-COUNSELING FORM
 * =========================================================
 *
 * Public route.
 * Student submits using the secure token.
 */
const submitPreCounselingForm = AsyncHandler(async (req, res) => {
  const { token } = req.params;

  const { consent, backgroundAndPsychosocialHistory } = req.body;

  if (!token) {
    return res.status(400).json({
      message: "Pre-counseling form token is required.",
    });
  }

  const hashedToken = hashToken(token);

  const form = await PreCounselingForm.findOne({
    token: hashedToken,
  });

  if (!form) {
    return res.status(404).json({
      message: "Pre-counseling form not found or the link is invalid.",
    });
  }

  if (form.status === "Submitted") {
    return res.status(409).json({
      message: "This pre-counseling form has already been submitted.",
    });
  }

  if (form.status === "Expired" || form.tokenExpiresAt < new Date()) {
    if (form.status !== "Expired") {
      form.status = "Expired";

      await form.save();
    }

    return res.status(410).json({
      message: "This pre-counseling form link has expired.",
    });
  }

  /*
   * Consent must be completed before the
   * pre-counseling information is accepted.
   */
  if (
    !consent?.hasConsent ||
    !consent?.confidentialityAgreementAccepted ||
    !consent?.dataPrivacyNoticeAccepted
  ) {
    return res.status(400).json({
      message:
        "Consent, confidentiality agreement, and data privacy notice must be accepted before submitting the form.",
    });
  }

  const background = backgroundAndPsychosocialHistory || {};

  /*
   * Validate Family Constellation.
   */
  if (
    background.familyConstellation !== undefined &&
    !Array.isArray(background.familyConstellation)
  ) {
    return res.status(400).json({
      message: "Family constellation must be a list of family members.",
    });
  }

  for (const member of background.familyConstellation || []) {
    if (!member?.name?.trim() || !member?.relationship?.trim()) {
      return res.status(400).json({
        message: "Each family member must have a name and relationship.",
      });
    }

    if (
      member.age !== undefined &&
      member.age !== null &&
      member.age !== "" &&
      (Number.isNaN(Number(member.age)) || Number(member.age) < 0)
    ) {
      return res.status(400).json({
        message: "Family member age must be a valid non-negative number.",
      });
    }
  }

  form.consent = {
    hasConsent: true,

    confidentialityAgreementAccepted: true,

    dataPrivacyNoticeAccepted: true,

    consentDate: new Date(),
  };

  form.backgroundAndPsychosocialHistory = background;

  form.status = "Submitted";

  form.submittedAt = new Date();

  await form.save();

  return res.status(200).json({
    message: "Pre-counseling form submitted successfully.",
  });
});

/*
 * =========================================================
 * GET LATEST SUBMITTED FORM FOR STUDENT
 * =========================================================
 *
 * Protected route.
 * Used by New Case to pre-fill consent and background.
 */
const getLatestSubmittedPreCounselingForm = AsyncHandler(async (req, res) => {
  const { studentId } = req.params;

  if (!studentId) {
    return res.status(400).json({
      message: "Student is required.",
    });
  }

  const student = await Student.findById(studentId);

  if (!student) {
    return res.status(404).json({
      message: "Student record not found.",
    });
  }

  const form = await PreCounselingForm.findOne({
    student: student._id,

    status: "Submitted",

    linkedCase: null,
  })
    .sort({
      submittedAt: -1,
    })
    .select("student consent backgroundAndPsychosocialHistory status submittedAt createdAt");

  if (!form) {
    return res.status(404).json({
      message: "No submitted pre-counseling form was found for this student.",
      formFound: false,
    });
  }

  return res.status(200).json({
    message: "Submitted pre-counseling form found.",

    formFound: true,

    form,
  });
});

module.exports = {
  sendPreCounselingForm,
  getPublicPreCounselingForm,
  submitPreCounselingForm,
  getLatestSubmittedPreCounselingForm,
};
