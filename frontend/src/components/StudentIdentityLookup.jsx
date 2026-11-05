import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../config/api";

const fields = ["studentIdNumber", "firstName", "lastName", "email", "college", "program", "contactNumber", "yearLevel"];
const normalize = value => value.trim().toUpperCase();

export default function StudentIdentityLookup({ studentId, onChange, onUseIdentity, enabled = true }) {
  const [stage, setStage] = useState("idle");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [candidate, setCandidate] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const currentId = useRef("");
  const idInput = useRef(null);
  const codeInput = useRef(null);
  const confirmButton = useRef(null);
  const normalizedId = normalize(studentId);
  currentId.current = normalizedId;

  useEffect(() => {
    sequence.current += 1;
    setStage("idle"); setChallenge(""); setCode(""); setCandidate(null);
    setMessage(""); setError(""); setBusy(false);
  }, [normalizedId]);
  useEffect(() => () => { sequence.current += 1; }, []);
  useEffect(() => {
    if (stage === "code") codeInput.current?.focus();
    if (stage === "confirm") confirmButton.current?.focus();
  }, [stage]);

  const run = async (action, body, success) => {
    const id = currentId.current;
    if (!id) { setError("Enter your student ID number first."); idInput.current?.focus(); return; }
    const request = ++sequence.current;
    setBusy(true); setError("");
    try {
      const result = await apiRequest(`/bookings/public/student-identity/${action}`, {
        method: "POST", body: JSON.stringify({ studentIdNumber: id, ...body }),
      });
      if (request === sequence.current && id === currentId.current) success(result);
    } catch (failure) {
      if (request === sequence.current && id === currentId.current)
        setError(failure.message || "Unable to retrieve saved information. You can enter your details manually.");
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  };
  const requestCode = () => run("request", {}, result => {
    setChallenge(result.challenge); setCode(""); setCandidate(null);
    setMessage(result.message); setStage("code");
  });
  const verify = () => run("verify", { challenge, code }, result => {
    setCandidate(result); setCode(""); setMessage(""); setStage("confirm");
  });
  const confirm = () => run("confirm", { confirmationToken: candidate.confirmationToken }, result => {
    const identity = Object.fromEntries(fields.map(field => [field, result.identity[field] || ""]));
    onUseIdentity(identity);
    setCandidate(null); setChallenge(""); setStage("done");
    setMessage("Saved student details filled in. Please review and edit them as needed.");
  });
  const cancel = () => {
    sequence.current += 1; setBusy(false); setStage("idle"); setCandidate(null);
    setChallenge(""); setCode(""); setMessage(""); setError(""); idInput.current?.focus();
  };
  const button = "rounded-lg border border-[#8C1518] px-3 py-2 text-sm font-medium text-[#8C1518] disabled:opacity-50";
  return (
    <div className="min-w-0 text-sm">
      <label htmlFor="booking-student-id" className="block text-sm">Student ID number</label>
      <div className="mt-1 flex items-stretch gap-2">
        <input id="booking-student-id" ref={idInput} required maxLength={150}
          className="min-w-0 flex-1 rounded-lg border p-3" value={studentId}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => { if (enabled && event.key === "Enter") { event.preventDefault(); if (!busy) requestCode(); } }}
          aria-describedby={enabled ? "student-lookup-note student-lookup-feedback" : undefined} />
        {enabled && <button type="button" className={`${button} shrink-0 whitespace-nowrap`} disabled={busy} onClick={requestCode}>
          {busy ? "Please wait…" : stage === "idle" || stage === "done" ? "Find my details" : "Send new code"}
        </button>}
      </div>
      {enabled && <div className="mt-2 space-y-2">
        <p id="student-lookup-note" className="text-xs text-stone-600">Optional: verify a code sent to your saved email to fill in your details, or enter them manually.</p>
        <div id="student-lookup-feedback" aria-live="polite">
          {message && <p className="text-sm text-stone-600">{message}</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
        {stage === "code" && <div className="space-y-2 rounded-lg border bg-stone-50 p-3">
          <label htmlFor="student-verification-code" className="block text-sm">Email verification code</label>
          <input id="student-verification-code" ref={codeInput} inputMode="numeric" autoComplete="one-time-code"
            maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (!busy && code.length === 6) verify(); } }}
            className="w-full rounded-lg border bg-white p-3" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy || code.length !== 6} onClick={verify}>Verify code</button>
            <button type="button" className={button} onClick={cancel}>Enter details manually</button>
          </div>
        </div>}
        {stage === "confirm" && candidate && <section aria-labelledby="student-name-confirmation" className="space-y-3 rounded-lg border bg-stone-50 p-3">
          <h3 id="student-name-confirmation" className="font-semibold">Is this you?</h3>
          <p className="font-medium">{candidate.name.firstName} {candidate.name.lastName}</p>
          <p className="text-sm text-stone-600">Confirm your name before filling in your saved student details. You can edit them afterward.</p>
          <div className="flex flex-wrap gap-2">
            <button ref={confirmButton} type="button" className={button} disabled={busy} onClick={confirm}>Yes, fill in my details</button>
            <button type="button" className={button} onClick={cancel}>No, check student ID</button>
          </div>
        </section>}
      </div>}
    </div>
  );
}
