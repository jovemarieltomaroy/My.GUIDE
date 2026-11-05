import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";
import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";

const primaryButton = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#8C1518] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#701013] disabled:cursor-wait disabled:opacity-50";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#DDD7D3] bg-white px-4 py-2.5 text-sm font-medium text-[#514B47] transition hover:bg-[#FAF8F7] disabled:opacity-50";
const card = "rounded-2xl border border-[#E6E1DE] bg-white p-5 shadow-sm sm:p-6";
const actionLabels = {
  "configuration.update": "Configuration updated",
  "maintenance.inspect": "System readiness checked",
  "authorization.denied": "Access denied",
  "account.protected": "Protected account access blocked",
  "account.post": "Account creation requested",
  "account.patch": "Account change requested",
  "account.put": "Account update requested",
};
function Badge({ children, tone = "neutral" }) {
  const colors = { good: "bg-emerald-50 text-emerald-800", warning: "bg-amber-50 text-amber-800", neutral: "bg-[#F3F0EE] text-[#655E59]" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${colors[tone]}`}>{children}</span>;
}
function dateLabel(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : "Unavailable";
}

export default function SystemAdminPage() {
  const { user, clearUser } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [configurationLoaded, setConfigurationLoaded] = useState(false);
  const [maintenance, setMaintenance] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const [events, setEvents] = useState([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");

  const request = useCallback(async (key, endpoint, options) => {
    setBusy(current => ({ ...current, [key]: true }));
    setErrors(current => ({ ...current, [key]: "" }));
    try {
      return await apiRequest(`/system/${endpoint}`, options);
    } catch (error) {
      if (error.status === 401) { clearUser(); navigate("/login", { replace: true }); }
      else if (error.status === 403) navigate("/access-denied", { replace: true });
      setErrors(current => ({ ...current, [key]: error.message }));
      return undefined;
    } finally { setBusy(current => ({ ...current, [key]: false })); }
  }, [clearUser, navigate]);

  // AuthContext callbacks change identity on render; initial loading runs once per mount.
  useEffect(() => {
    let cancelled = false;
    apiRequest("/system/configuration").then(data => {
      if (cancelled) return;
      const organization = data?.organizationName || "My.GUIDE";
      setName(organization); setSavedName(organization); setConfigurationLoaded(true);
    }).catch(error => {
      if (cancelled) return;
      setErrors(current => ({ ...current, configuration: error.message }));
      if (error.status === 401) { clearUser(); navigate("/login", { replace: true }); }
      else if (error.status === 403) navigate("/access-denied", { replace: true });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkReadiness() {
    const data = await request("maintenance", "maintenance");
    if (data !== undefined) { setMaintenance(data); setCheckedAt(new Date().toISOString()); }
  }
  async function loadAudit() {
    const data = await request("audit", "audit");
    if (data !== undefined) { setEvents(data); setAuditLoaded(true); }
  }
  async function saveConfiguration(event) {
    event.preventDefault(); setNotice("");
    const data = await request("configuration", "configuration", {
      method: "PUT", body: JSON.stringify({ organizationName: name.trim() }),
    });
    if (data !== undefined) {
      setName(data.organizationName); setSavedName(data.organizationName);
      setNotice("Organization name saved successfully.");
    }
  }
  const vectorReady = maintenance?.vectorIndexes?.some(index => index.queryable === true);

  return (
    <div className="authenticated-app min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#262220]">
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center justify-between gap-3 border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="rounded-lg border border-[#E4DFDC] p-2 lg:hidden"><Icon name="menu" className="h-5 w-5" /></button>
            <div><h1 className="text-lg font-semibold">System administration</h1><p className="hidden text-xs text-[#8A837F] sm:block">My.GUIDE administration workspace</p></div>
          </div>
          <Badge>Super Admin</Badge>
        </header>

        <main className="page-content mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-7 lg:w-[calc(100%-240px)]! lg:px-0!">
          <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-[#8C1518]">Administration</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Your system at a glance</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#8A837F]">Manage counselor access, maintain application settings, and review system activity.</p></div>
            <Link to="/users" className={primaryButton}><Icon name="users" className="h-4 w-4" />Manage counselors</Link>
          </section>

          <div className="grid gap-5 xl:grid-cols-3">
            <section className={card}>
              <div className="mb-5 inline-flex rounded-xl bg-[#F5EAEA] p-3 text-[#8C1518]"><Icon name="users" className="h-6 w-6" /></div>
              <h3 className="text-base font-semibold">Counselor accounts</h3><p className="mt-2 text-sm leading-6 text-[#8A837F]">Create counselor accounts, manage roles, and control account access.</p>
              <Link to="/users" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#8C1518]">Open account management<Icon name="arrowRight" className="h-4 w-4" /></Link>
            </section>
            <section className={`${card} xl:col-span-2`} aria-labelledby="configuration-heading">
              <h3 id="configuration-heading" className="text-base font-semibold">Application configuration</h3><p className="mt-1 text-sm text-[#8A837F]">Maintain your organization’s name.</p>
              <form className="mt-5" onSubmit={saveConfiguration}>
                <label htmlFor="organization-name" className="text-sm font-medium">Organization name</label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input id="organization-name" value={name} onChange={event => { setName(event.target.value); setNotice(""); }} maxLength={120} required disabled={!configurationLoaded || busy.configuration} placeholder="Loading configuration…" className="min-w-0 flex-1 rounded-lg border border-[#DDD7D3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/10 disabled:bg-[#FAF8F7]" />
                  <button className={primaryButton} disabled={!configurationLoaded || busy.configuration || !name.trim() || name.trim() === savedName}>{busy.configuration ? "Saving…" : "Save changes"}</button>
                </div>
                <p className="mt-2 text-xs text-[#8A837F]">Up to 120 characters.</p>
                {errors.configuration && <p role="alert" className="mt-3 text-sm text-[#8C1518]">{errors.configuration}</p>}
                {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
              </form>
            </section>
          </div>

          <section className={card} aria-labelledby="maintenance-heading">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div><h3 id="maintenance-heading" className="text-base font-semibold">System readiness</h3><p className="mt-1 text-sm text-[#8A837F]">Check the database connection and vector search index status.</p></div>
              <button type="button" className={secondaryButton} disabled={busy.maintenance} onClick={checkReadiness}><Icon name="history" className={`h-4 w-4 ${busy.maintenance ? "animate-spin" : ""}`} />{busy.maintenance ? "Checking…" : maintenance ? "Check again" : "Check readiness"}</button>
            </div>
            {errors.maintenance && <p role="alert" className="mt-4 text-sm text-[#8C1518]">{errors.maintenance}</p>}
            {!maintenance ? <div className="mt-5 rounded-xl border border-dashed border-[#DDD7D3] bg-[#FAF8F7] p-6 text-center text-sm text-[#8A837F]">Run a readiness check to view the current system status.</div> : <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Active database", value: maintenance.database || "Unavailable", status: maintenance.connected ? "Connected" : "Disconnected", good: maintenance.connected },
                  { label: "Vector search", value: `${maintenance.vectorIndexes?.length || 0} index(es)`, status: vectorReady ? "Queryable" : "Not queryable", good: vectorReady },
                  { label: "Generation model", value: maintenance.generationModel, status: "Configured" },
                  { label: "Embedding model", value: maintenance.embeddingModel, status: "Configured" },
                ].map(item => <div key={item.label} className="rounded-xl border border-[#E6E1DE] bg-[#FAF8F7] p-4"><p className="text-xs text-[#8A837F]">{item.label}</p><p className="my-3 break-words text-sm font-semibold">{item.value || "Unavailable"}</p><Badge tone={item.good === undefined ? "neutral" : item.good ? "good" : "warning"}>{item.status}</Badge></div>)}
              </div>
              {maintenance.vectorIndexes?.map(index => <div key={index.name} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E6E1DE] px-4 py-3 text-sm"><span className="break-all font-medium">{index.name}</span><Badge tone={index.queryable ? "good" : "warning"}>{index.status || "Unknown"} · {index.queryable ? "Queryable" : "Not queryable"}</Badge></div>)}
              <p className="mt-3 text-xs text-[#8A837F]">Last checked {dateLabel(checkedAt)} (Manila). Model names show configuration; model availability is verified during generation.</p>
            </>}
          </section>

          <section className={`${card} overflow-hidden`} aria-labelledby="audit-heading">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div><h3 id="audit-heading" className="text-base font-semibold">Administrative activity</h3><p className="mt-1 text-sm text-[#8A837F]">The latest 100 administrative audit events. All times are in Manila.</p></div>
              <button type="button" className={secondaryButton} disabled={busy.audit} onClick={loadAudit}><Icon name="history" className={`h-4 w-4 ${busy.audit ? "animate-spin" : ""}`} />{busy.audit ? "Loading…" : auditLoaded ? "Refresh activity" : "View activity"}</button>
            </div>
            {errors.audit && <p role="alert" className="mt-4 text-sm text-[#8C1518]">{errors.audit}</p>}
            {!auditLoaded || !events.length ? <div className="mt-5 rounded-xl bg-[#FAF8F7] p-8 text-center"><Icon name="history" className="mx-auto mb-3 h-7 w-7 text-[#A69B94]" /><p className="text-sm font-medium">{auditLoaded ? "No administrative activity yet" : "Review your system’s activity"}</p><p className="mt-2 text-xs text-[#8A837F]">{auditLoaded ? "Account changes and system checks will appear here." : "Select View activity to load recent administrative events."}</p></div> : <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-[#E6E1DE] bg-[#FAF8F7] text-xs text-[#8A837F]"><tr>{["Date & time", "Activity", "Actor ID", "Target", "Outcome"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{events.map(event => <tr key={event._id} className="border-b border-[#F0ECE9] last:border-0"><td className="whitespace-nowrap px-3 py-4 text-xs">{dateLabel(event.createdAt)}</td><td className="px-3 py-4 font-medium">{actionLabels[event.action] || event.action}</td><td className="px-3 py-4 font-mono text-xs text-[#8A837F]">{event.actor || "System"}</td><td className="max-w-[220px] break-all px-3 py-4 text-xs text-[#8A837F]">{event.target || "—"}</td><td className="px-3 py-4"><Badge tone={event.outcome === "succeeded" ? "good" : event.outcome === "attempted" ? "neutral" : "warning"}>{({ succeeded: "Succeeded", attempted: "Attempted", denied: "Denied", denied_or_failed: "Denied or failed" })[event.outcome] || event.outcome}</Badge></td></tr>)}</tbody></table></div>}
          </section>
          <footer className="flex flex-col justify-between gap-3 pb-3 text-xs text-[#8A837F] sm:flex-row"><p>Signed in as {user?.email}</p><Link className="font-medium text-[#8C1518] hover:underline" to="/change-password">Change my password</Link></footer>
        </main>
      </div>
    </div>
  );
}
