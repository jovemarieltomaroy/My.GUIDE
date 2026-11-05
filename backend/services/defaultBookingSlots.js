const mongoose = require("mongoose");
const User = require("../models/user");
const Slot = require("../models/counselorSlot");

const DAY = 86400000;
const MANILA_OFFSET = 8 * 3600000;
const BOOKING_DAYS = 90;
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

// Use UTC arithmetic on the Manila calendar date, independent of the host timezone.
function defaultIntervals(now = new Date(), days = BOOKING_DAYS) {
  const local = new Date(now.getTime() + MANILA_OFFSET);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const result = [];
  for (let day = 0; day < days; day++) {
    const date = new Date(midnight + day * DAY);
    if ([0, 6].includes(date.getUTCDay())) continue;
    for (const hour of HOURS) {
      const startsAt = new Date(date.getTime() + hour * 3600000 - MANILA_OFFSET);
      const endsAt = new Date(startsAt.getTime() + 3600000);
      if (startsAt > now) result.push({ startsAt, endsAt });
    }
  }
  return result;
}

// Coalesce simultaneous calendar/public reads. Recheck shortly to extend the rolling horizon.
const pending = new Map();
const checked = new Map();
async function ensureDefaultSlots(counselorIds, now = new Date()) {
  await Promise.all(
    counselorIds.map(async (value) => {
      const id = String(value);
      if ((checked.get(id) || 0) > Date.now()) return;
      if (pending.has(id)) return pending.get(id);
      const task = (async () => {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            // Share the scheduling lock with custom slot creation, reservations and leave updates.
            const user = await User.findOneAndUpdate(
              {
                _id: id,
                isActive: true,
                role: { $in: ["Counselor-Admin", "Counselor-User"] },
              },
              { $inc: { schedulingRevision: 1 } },
              { session, returnDocument: "after" }
            );
            if (!user) return;
            const candidates = defaultIntervals(now);
            if (!candidates.length) return;
            const existing = await Slot.find({
              counselor: id,
              endsAt: { $gt: now },
              startsAt: { $lt: candidates.at(-1).endsAt },
            })
              .select("startsAt endsAt")
              .session(session);
            const additions = candidates.filter(
              (candidate) =>
                !existing.some(
                  (slot) => slot.startsAt < candidate.endsAt && slot.endsAt > candidate.startsAt
                )
            );
            // Never overwrite a blocked, booked, or custom interval.
            if (additions.length)
              await Slot.insertMany(
                additions.map((interval) => ({
                  counselor: id,
                  ...interval,
                  source: "Default",
                })),
                { session }
              );
          });
          checked.set(id, Date.now() + 60000);
        } finally {
          await session.endSession();
        }
      })();
      pending.set(id, task);
      try {
        await task;
      } finally {
        pending.delete(id);
      }
    })
  );
}
module.exports = { defaultIntervals, ensureDefaultSlots };
