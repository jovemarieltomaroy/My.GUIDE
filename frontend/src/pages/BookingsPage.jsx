import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import IntakeReview from "../components/IntakeReview";
import Icon from "../components/Icon";
import AppSidebar from "../components/AppSidebar";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../config/api";

const input = "w-full rounded-lg border border-stone-300 bg-white p-2 text-sm";
const button = "rounded-lg bg-[#8C1518] px-4 py-2 text-sm text-white disabled:opacity-50";
const panel = "rounded-xl border border-stone-200 bg-white p-5 space-y-4";
const stamp = (value) =>
  value
    ? new Date(value).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not set";
const dateKey = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const localISO = (value) => (value ? new Date(`${value}+08:00`).toISOString() : undefined);
const idOf = (value) => value?._id || value;

export default function BookingsPage({ availabilityOnly = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const admin = user?.role === "Counselor-Admin";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [counselors, setCounselors] = useState([]);
  const [counselorId, setCounselorId] = useState(user?._id || "");
  const [calendar, setCalendar] = useState({ slots: [], appointments: [] });
  const [queue, setQueue] = useState([]);
  const [caseAssignments, setCaseAssignments] = useState([]);
  const [caseChoices, setCaseChoices] = useState({});
  const [rescheduling, setRescheduling] = useState([]);
  const [detail, setDetail] = useState(null);
  const [slotChoice, setSlotChoice] = useState({});
  const [publicSlots, setPublicSlots] = useState([]);
  const [availability, setAvailability] = useState({
    status: "Available",
    from: "",
    until: "",
    reason: "",
  });
  const [slot, setSlot] = useState({ startsAt: "", endsAt: "" });
  const [month, setMonth] = useState(dateKey(new Date()).slice(0, 7));
  const [selectedDay, setSelectedDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bookingUrl = `${window.location.origin}/booking`;
  const load = useCallback(async () => {
    const [people, requests, schedule, slots, flagged, assignments] = await Promise.all([
      apiRequest("/bookings/counselors"),
      apiRequest("/bookings/intakes"),
      apiRequest(`/bookings/calendar/${counselorId || user._id}`),
      apiRequest("/bookings/public/slots"),
      admin ? apiRequest("/bookings/rescheduling") : Promise.resolve([]),
      admin ? apiRequest("/bookings/case-assignments") : Promise.resolve([]),
    ]);
    setCounselors(people);
    setQueue(requests);
    setCalendar(schedule);
    setPublicSlots(slots);
    setRescheduling(flagged);
    setCaseAssignments(assignments);
  }, [counselorId, user._id, admin]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    const a = counselors.find((c) => c._id === counselorId)?.availability;
    const fieldDate = (value) =>
      value ? new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 16) : "";
    setAvailability({
      status: a?.status || "Available",
      from: fieldDate(a?.from),
      until: fieldDate(a?.until),
      reason: a?.reason || "",
    });
  }, [counselors, counselorId]);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const action = (path, body, method = "POST") =>
    apiRequest(`/bookings${path}`, { method, body: JSON.stringify(body) });
  const ownSlots = publicSlots.filter((s) => String(s.counselor._id) === String(user._id));
  const slotSelect = (request, all = false) => (
    <select
      aria-label="Appointment slot"
      className={input}
      value={slotChoice[request._id] || ""}
      onChange={(e) => setSlotChoice({ ...slotChoice, [request._id]: e.target.value })}
    >
      <option value="">Choose {all ? "a counselor’s" : "your"} available slot</option>
      {(all ? publicSlots : ownSlots).map((s) => (
        <option key={s._id} value={s._id}>
          {stamp(s.startsAt)} — {s.counselor.name}
        </option>
      ))}
    </select>
  );
  const selectedCounselor = counselors.find((c) => c._id === counselorId);
  const unavailableForSlot = (s) => {
    if (selectedCounselor && !selectedCounselor.isActive) return true;
    const a = selectedCounselor?.availability;
    if (!a?.status || a.status === "Available") return false;
    return !(
      (a.from && new Date(s.endsAt) <= new Date(a.from)) ||
      (a.until && new Date(s.startsAt) >= new Date(a.until))
    );
  };
  const daySlots = calendar.slots.filter(
    (s) =>
      dateKey(s.startsAt).startsWith(month) && (!selectedDay || dateKey(s.startsAt) === selectedDay)
  );
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const offset = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  return (
    <div className="authenticated-app min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#2F2A27]">
      {error && (
        <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-md sm:right-6 sm:top-6">
          <div
            role="alert"
            aria-atomic="true"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-xl"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Action could not be completed
              </p>
              <p className="mt-1 text-sm leading-6">{error}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setError("")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#E4DFDC] text-[#655E59] lg:hidden"
              aria-label="Open navigation"
            >
              <Icon name="menu" className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-[20px] font-semibold">
                {availabilityOnly ? "Counselor Availability" : "Intakes & Bookings"}
              </h1>
              <p className="hidden text-[15px] text-[#99918C] sm:block">
                {availabilityOnly
                  ? "Manage counselor availability and schedules"
                  : "Review requests and manage your counseling calendar"}
              </p>
            </div>
          </div>
        </header>
        <main className="page-content mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-7 lg:w-[calc(100%-240px)]! lg:px-0!">
          <section>
            <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
              {availabilityOnly ? "Availability management" : "Intake management"}
            </h2>
            <p className="mt-1 text-[15px] text-[#89817D]">
              {availabilityOnly
                ? "Manage leave, absences, bookable slots, and appointments that need rescheduling."
                : "Review new requests, accept shared bookings, and manage your counseling calendar."}{" "}
              All times are Philippine time.
            </p>
          </section>
          {!availabilityOnly && (
            <section className={panel}>
              <h2 className="text-xl font-semibold">Counseling form & appointment booking</h2>
              <a
                className="inline-block text-[#8C1518] underline"
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open student booking form
              </a>
            </section>
          )}
          <section className={panel}>
            <h2 className="text-xl font-semibold">Availability</h2>
            {admin && (
              <label className="block">
                Counselor
                <select
                  className={input}
                  value={counselorId}
                  onChange={(e) => {
                    setCounselorId(e.target.value);
                    setSelectedDay("");
                  }}
                >
                  {counselors.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.firstName} {c.lastName} — {c.collegesHandled.join(", ")}
                      {c.isActive ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    action(
                      `/counselors/${counselorId}/availability`,
                      {
                        ...availability,
                        from: localISO(availability.from),
                        until: localISO(availability.until),
                      },
                      "PATCH"
                    ),
                  "Availability saved; affected appointments are flagged for rescheduling."
                );
              }}
              className="grid gap-3 md:grid-cols-2"
            >
              <label>
                Status
                <select
                  className={input}
                  value={availability.status}
                  onChange={(e) => setAvailability({ ...availability, status: e.target.value })}
                >
                  {["Available", "On Leave", "Absent", "Unavailable"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Reason (staff only)
                <input
                  className={input}
                  maxLength={500}
                  value={availability.reason}
                  onChange={(e) => setAvailability({ ...availability, reason: e.target.value })}
                />
              </label>
              <label>
                From (optional)
                <input
                  type="datetime-local"
                  className={input}
                  value={availability.from}
                  onChange={(e) => setAvailability({ ...availability, from: e.target.value })}
                />
              </label>
              <label>
                Until (optional)
                <input
                  type="datetime-local"
                  className={input}
                  value={availability.until}
                  onChange={(e) => setAvailability({ ...availability, until: e.target.value })}
                />
              </label>
              <p className="text-sm text-stone-500">
                Without dates, an unavailable status applies until cleared.
              </p>
              <button className={button} disabled={busy}>
                Save availability
              </button>
            </form>
          </section>
          <section className={panel}>
            <h2 className="text-xl font-semibold">Counselor calendar</h2>
            <p className="text-sm text-stone-600">
              Available by default Monday–Friday, 8 AM–5 PM, in one-hour slots. Block
              time or set leave/absence to make it unavailable. Default slots cover the next 90
              days.
            </p>
            <div className="flex gap-3">
              <input
                aria-label="Calendar month"
                type="month"
                value={month}
                className={input}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setSelectedDay("");
                }}
              />
              <button className="text-sm underline" onClick={() => setSelectedDay("")}>
                Show month
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="p-2 text-center text-xs font-semibold">
                  {d}
                </div>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const day = `${month}-${String(i + 1).padStart(2, "0")}`;
                const slots = calendar.slots.filter((s) => dateKey(s.startsAt) === day);
                const unavailable = slots.filter((s) => s.isBlocked || unavailableForSlot(s)).length;
                const booked = slots.filter((s) =>
                  !s.isBlocked && !unavailableForSlot(s) &&
                  calendar.appointments.some(
                    (a) =>
                      String(idOf(a.slot)) === s._id &&
                      ["Booked", "Needs Rescheduling"].includes(a.appointmentStatus)
                  )
                ).length;
                const available = slots.length - unavailable - booked;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    aria-pressed={selectedDay === day}
                    className={`min-h-20 rounded-lg border p-2 text-left text-sm ${selectedDay === day ? "ring-2 ring-[#8C1518] ring-offset-1 " : ""}${unavailable > 0 ? "border-red-200 bg-red-50" : available > 0 ? "border-emerald-200 bg-emerald-50" : "border-stone-200"}`}
                  >
                    <span>{i + 1}</span>
                    {slots.length > 0 && (
                      <span className="block text-xs">
                        <span className="block text-emerald-700">{available} available</span>
                        {unavailable > 0 && <span className="block font-medium text-red-700">{unavailable} unavailable</span>}
                        {booked > 0 && <span className="block text-stone-600">{booked} booked</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <form
              className="grid items-end gap-3 md:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await action(`/counselors/${counselorId}/slots`, {
                    startsAt: localISO(slot.startsAt),
                    endsAt: localISO(slot.endsAt),
                  });
                  setSlot({ startsAt: "", endsAt: "" });
                }, "Bookable slot added.");
              }}
            >
              <label>
                Slot starts
                <input
                  required
                  type="datetime-local"
                  className={`${input} h-10`}
                  value={slot.startsAt}
                  onChange={(e) => setSlot({ ...slot, startsAt: e.target.value })}
                />
              </label>
              <label>
                Slot ends
                <input
                  required
                  type="datetime-local"
                  className={`${input} h-10`}
                  value={slot.endsAt}
                  onChange={(e) => setSlot({ ...slot, endsAt: e.target.value })}
                />
              </label>
              <button className={`${button} h-10`} disabled={busy}>
                Add extra slot
              </button>
            </form>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {daySlots.length === 0 && (
                <p className="text-sm text-stone-500">
                  No upcoming slots in this period. Default slots cover weekdays within the next 90
                  days.
                </p>
              )}
              {daySlots.map((s) => {
                const a = calendar.appointments.find(
                  (a) =>
                    String(idOf(a.slot)) === s._id &&
                    ["Booked", "Needs Rescheduling"].includes(a.appointmentStatus)
                );
                return (
                  <div
                    key={s._id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${s.isBlocked || unavailableForSlot(s) ? "border-red-200 bg-red-50 text-red-800" : a ? "border-stone-200 bg-stone-50" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
                  >
                    <div>
                      <p>
                        {stamp(s.startsAt)} – {stamp(s.endsAt)}
                      </p>
                      <p className="text-sm">
                        {s.isBlocked
                          ? "Unavailable — blocked"
                          : unavailableForSlot(s)
                            ? "Unavailable — counselor away"
                            : a
                              ? `${a.identity.firstName} ${a.identity.lastName} · ${a.appointmentStatus}`
                              : "Available"}
                      </p>
                    </div>
                    <button
                      disabled={busy}
                      className="text-sm underline"
                      onClick={() =>
                        run(() =>
                          action(`/slots/${s._id}/block`, { isBlocked: !s.isBlocked }, "PATCH")
                        )
                      }
                    >
                      {s.isBlocked ? "Unblock" : "Block"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
          {!availabilityOnly && (
            <section className={panel}>
              <h2 className="text-xl font-semibold">Shared requests & my intakes</h2>
              <p className="text-sm text-stone-500">
                Bookings return here when their counselor is unavailable or their slot is blocked, unless already linked to a case. Accept a request into one of your
                available slots to view the student’s responses.
              </p>
              {queue.length === 0 && <p>No requests yet.</p>}
              {queue.map((r) => (
                <article key={r._id} className="rounded-lg border p-5 space-y-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {r.identity.college} · {r.entryType}
                      </p>
                      <p className="text-sm">
                        {r.status} · {r.appointmentStatus}
                      </p>
                      <p className="text-xs text-stone-500">Reference: {r._id}</p>
                      <p className="text-sm">
                        {r.slot
                          ? `Appointment: ${stamp(r.slot.startsAt)}`
                          : `Preferred: ${stamp(r.preferredAt)}`}
                      </p>
                    </div>
                    {r.assignedCounselor && (
                      <button
                        className={`${button} h-10 self-center`}
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            setDetail(await apiRequest(`/bookings/intakes/${r._id}`));
                          }, "Intake opened for review.")
                        }
                      >
                        Review intake
                      </button>
                    )}
                  </div>
                  {!r.assignedCounselor && (
                    <div className="flex flex-wrap gap-2">
                      {slotSelect(r)}
                      <button
                        disabled={busy || !slotChoice[r._id]}
                        className={button}
                        onClick={() =>
                          run(
                            () => action(`/intakes/${r._id}/accept`, { slotId: slotChoice[r._id] }),
                            "Booking accepted. You can now review the intake."
                          )
                        }
                      >
                        Accept booking
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
          {admin && rescheduling.length > 0 && (
            <section className={panel}>
              <h2 className="text-xl font-semibold">Appointments needing rescheduling</h2>
              {rescheduling.map((r) => (
                <div key={r._id} className="space-y-2 border-b pb-3">
                  <p>
                    {r.identity.college} · {stamp(r.slot?.startsAt)} · {r._id}
                  </p>
                  {slotSelect(r, true)}
                  <button
                    disabled={busy || !slotChoice[r._id]}
                    className={button}
                    onClick={() =>
                      run(() =>
                        action(
                          `/intakes/${r._id}/appointment`,
                          { slotId: slotChoice[r._id] },
                          "PATCH"
                        )
                      )
                    }
                  >
                    Reschedule / reassign
                  </button>
                </div>
              ))}
            </section>
          )}
          {admin && availabilityOnly && (
            <section className={panel}>
              <h2 className="text-xl font-semibold">Case assignments</h2>
              <p className="text-sm text-stone-500">
                Administrative routing shows no clinical details. Reassignment transfers intake
                access, revokes temporary grants, and flags the appointment for rescheduling.
              </p>
              {caseAssignments.length === 0 && <p>No active case records.</p>}
              {caseAssignments.map((c) => (
                <div className="grid gap-2 border-b pb-3" key={c._id}>
                  <p>
                    {c.caseNumber} · {c.student?.college} · {c.caseStatus}
                  </p>
                  <p className="text-sm">
                    Handling counselor:{" "}
                    {counselors.find((p) => p._id === String(idOf(c.assignedCounselor)))
                      ?.firstName || "Unknown"}
                  </p>
                  <select
                    aria-label={`New counselor for ${c.caseNumber}`}
                    className={input}
                    value={caseChoices[c._id] || ""}
                    onChange={(e) => setCaseChoices({ ...caseChoices, [c._id]: e.target.value })}
                  >
                    <option value="">Choose a new counselor</option>
                    {counselors
                      .filter((p) => p.isActive && p._id !== String(idOf(c.assignedCounselor)))
                      .map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.firstName} {p.lastName}
                        </option>
                      ))}
                  </select>
                  <button
                    className={button}
                    disabled={busy || !caseChoices[c._id]}
                    onClick={() =>
                      run(
                        () =>
                          apiRequest(`/cases/${c._id}/assign-counselor`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              assignedCounselor: caseChoices[c._id],
                              remarks: "Reassigned through counselor availability management.",
                            }),
                          }),
                        "Case reassigned. Intake access transferred; reschedule its appointment."
                      )
                    }
                  >
                    Transfer case
                  </button>
                </div>
              ))}
            </section>
          )}
          {detail && (
            <IntakeReview
              intake={detail}
              busy={busy}
              onClose={() => setDetail(null)}
              onConfirm={() => navigate(`/cases/new?intakeId=${detail._id}`)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
