import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../config/api";
import AppSidebar from "./AppSidebar";
import Icon from "./Icon";
import IntakeReview from "./IntakeReview";

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "No preferred time";
const button =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[#8C1518] px-4 text-sm font-semibold text-white hover:bg-[#701013] disabled:opacity-50";

export default function PendingCaseBookings({ user, onReferred }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [slots, setSlots] = useState([]);
  const [choices, setChoices] = useState({});
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const userId = String(user._id || user.id);
  const load = useCallback(async () => {
    const [intakes, available] = await Promise.all([
      apiRequest("/bookings/intakes"),
      apiRequest("/bookings/public/slots"),
    ]);
    setRequests(
      intakes.filter((intake) => intake.status === "Pending Review" && !intake.linkedCase)
    );
    setSlots(available.filter((slot) => String(slot.counselor._id) === userId));
  }, [userId]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch((error) => {
        if (!cancelled) setError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);
  const review = async (request) => {
    setBusy(request._id);
    setError("");
    try {
      if (!request.assignedCounselor) {
        await apiRequest(`/bookings/intakes/${request._id}/accept`, {
          method: "POST",
          body: JSON.stringify({ slotId: choices[request._id] }),
        });
        await load();
      }
      setDetail(await apiRequest(`/bookings/intakes/${request._id}`));
    } catch (error) {
      setError(error.message);
      // Refresh contested bookings so a request accepted elsewhere cannot remain actionable.
      await load().catch(() => {});
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="authenticated-app min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#2F2A27]">
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="grid h-9 w-9 place-items-center rounded-lg border lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="menu" className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-[20px] font-semibold">New Case</h1>
              <p className="hidden text-[15px] text-[#99918C] sm:block">
                Choose a pending booking to review and prepare its case.
              </p>
            </div>
          </div>
        </header>
        <main className="page-content mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-7 lg:w-[calc(100%-240px)]! lg:px-0!">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
                Bookings & pending acceptance
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Accept an unassigned request or review one of your bookings to open its prefilled
                New Case form.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 text-sm text-[#8C1518] underline underline-offset-4"
              onClick={onReferred}
            >
              Create a referred case instead
            </button>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          <section
            aria-label="Pending bookings"
            aria-busy={loading}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
          >
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 p-5">
              <h3 className="font-semibold">
                Pending bookings{" "}
                <span className="ml-2 text-sm font-normal text-stone-500">{requests.length}</span>
              </h3>
              <button
                type="button"
                disabled={loading || Boolean(busy)}
                className="text-sm text-[#8C1518] underline"
                onClick={async () => {
                  setLoading(true);
                  setError("");
                  try {
                    await load();
                  } catch (error) {
                    setError(error.message);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <p role="status" className="p-5 text-sm text-stone-500">
                Loading pending bookings…
              </p>
            ) : requests.length === 0 ? (
              <div className="p-10 text-center">
                <Icon name="calendar" className="mx-auto mb-3 h-8 w-8 text-[#8C1518]" />
                <h3 className="font-semibold">No pending bookings</h3>
                <p className="mt-2 text-sm text-stone-500">
                  New submissions and bookings awaiting case creation will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-200">
                {requests.map((request) => (
                  <article key={request._id} className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">
                          {request.identity.college} · {request.entryType}
                        </h3>
                        <p className="mt-1 text-sm text-stone-600">
                          {request.assignedCounselor
                            ? "Accepted · Awaiting case creation"
                            : "Pending acceptance · Unassigned"}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {request.slot
                            ? `Appointment: ${formatTime(request.slot.startsAt)}`
                            : `Preferred: ${formatTime(request.preferredAt)}`}
                        </p>
                        <p className="mt-1 break-all text-xs text-stone-400">
                          Reference: {request._id}
                        </p>
                      </div>
                      {request.assignedCounselor && (
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          className={button}
                          onClick={() => review(request)}
                        >
                          {busy === request._id ? "Opening…" : "Review intake"}
                        </button>
                      )}
                    </div>
                    {!request.assignedCounselor && (
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <select
                          aria-label={`Available slot for request ${request._id}`}
                          className="h-10 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-sm"
                          value={choices[request._id] || ""}
                          onChange={(event) =>
                            setChoices({ ...choices, [request._id]: event.target.value })
                          }
                        >
                          <option value="">
                            {slots.length
                              ? "Choose your available slot"
                              : "No available slots in your calendar"}
                          </option>
                          {slots.map((slot) => (
                            <option key={slot._id} value={slot._id}>
                              {formatTime(slot.startsAt)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={Boolean(busy) || !choices[request._id]}
                          className={button}
                          onClick={() => review(request)}
                        >
                          {busy === request._id ? "Accepting…" : "Accept and review"}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
          {detail && (
            <IntakeReview
              intake={detail}
              busy={Boolean(busy)}
              onClose={() => setDetail(null)}
              onConfirm={() => navigate(`/cases/new?intakeId=${detail._id}`)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
