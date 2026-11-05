// Run within the calendar mutation's transaction so accepting and releasing cannot race.
const releaseUnavailableBookings = async (Intake, slotIds, actor, session, action) => {
  const affected = { slot: { $in: slotIds }, reservationActive: true };
  const history = { action, actor, at: new Date() };
  await Intake.updateMany(
    { ...affected, status: "Pending Review", linkedCase: null },
    {
      $set: {
        assignedCounselor: null,
        reservationActive: false,
        appointmentStatus: "Needs Rescheduling",
      },
      $push: { history: { ...history, action: `${action}; returned to shared queue` } },
    },
    { session }
  );
  // Official cases retain ownership; their appointments require explicit rescheduling.
  await Intake.updateMany(
    affected,
    {
      $set: { appointmentStatus: "Needs Rescheduling" },
      $push: { history },
    },
    { session }
  );
};
module.exports = { releaseUnavailableBookings };
