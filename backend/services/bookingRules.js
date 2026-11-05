const availableAt = (user, start, end) => {
  if (!user.isActive || !["Counselor-Admin", "Counselor-User"].includes(user.role)) return false;
  const a = user.availability;
  if (!a?.status || a.status === "Available") return true;
  // An unavailable status without dates applies until explicitly cleared.
  return Boolean((a.from && end <= new Date(a.from)) || (a.until && start >= new Date(a.until)));
};
const ownsIntake = (intake, user) =>
  String(intake.assignedCounselor?._id || intake.assignedCounselor) === String(user._id);
const validateSubmission = (body) => {
  if (!["Walk-in", "Scheduled"].includes(body.entryType))
    throw new Error("Choose Walk-in or Scheduled.");
  if (
    !body.consent ||
    ["hasConsent", "confidentialityAgreementAccepted", "dataPrivacyNoticeAccepted"].some(
      (k) => body.consent[k] !== true
    )
  )
    throw new Error("All consent acknowledgments are required.");
  const identity = body.identity;
  if (
    !identity ||
    ["studentIdNumber", "firstName", "lastName", "email", "college", "yearLevel"].some(
      (k) => typeof identity[k] !== "string" || !identity[k].trim()
    )
  )
    throw new Error("Complete the required student information.");
  if (
    body.entryType === "Scheduled" &&
    !body.slotId &&
    (!body.preferredAt ||
      !Number.isFinite(new Date(body.preferredAt).getTime()) ||
      new Date(body.preferredAt) <= new Date())
  )
    throw new Error("Choose a slot or a future preferred time for the shared queue.");
};
module.exports = { availableAt, ownsIntake, validateSubmission };
