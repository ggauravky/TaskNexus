import { Bell, Eye, ListFilter, RotateCcw } from "lucide-react";

const Toggle = ({ id, label, description, checked, onChange }) => (
  <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[#34343a] bg-[#141516] p-4">
    <span>
      <span className="block text-sm font-medium text-[#d0d6e0]">{label}</span>
      {description ? <span className="mt-1 block text-xs leading-5 text-[#62666d]">{description}</span> : null}
    </span>
    <span className="relative mt-0.5 inline-flex shrink-0 items-center">
      <input id={id} type="checkbox" checked={Boolean(checked)} onChange={onChange} className="peer sr-only" />
      <span className="h-6 w-11 rounded-full border border-[#34343a] bg-[#18191a] transition-colors peer-checked:border-[#5e6ad2] peer-checked:bg-[#5e6ad2] peer-focus-visible:ring-2 peer-focus-visible:ring-[#828fff]" />
      <span className="absolute left-1 h-4 w-4 rounded-full bg-[#f7f8f8] transition-transform peer-checked:translate-x-5" />
    </span>
  </label>
);

const DashboardSettings = ({ preferences, togglePreference, setPreference, resetPreferences, savingPreferences = false, syncError = null, role = "client" }) => {
  const prefix = `pref-${role}`;
  return (
    <div className="space-y-7 p-5 sm:p-6">
      {syncError ? <p role="status" className="rounded-lg border border-amber-900 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{syncError}</p> : null}
      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[#8a8f98]"><Eye className="h-4 w-4 text-[#828fff]" /> Appearance</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle id={`${prefix}-compact`} label="Compact task rows" description="Reduce spacing in work lists." checked={preferences.compactCards} onChange={() => togglePreference("compactCards")} />
          <Toggle id={`${prefix}-financials`} label="Hide financial amounts" description="Mask budgets, spending, and earnings on this device." checked={preferences.hideFinancials} onChange={() => togglePreference("hideFinancials")} />
          <Toggle id={`${prefix}-progress`} label="Show progress bars" description="Display server-reported progress for active work." checked={preferences.showProgressBars} onChange={() => togglePreference("showProgressBars")} />
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[#8a8f98]"><ListFilter className="h-4 w-4 text-[#828fff]" /> Task view</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="team-label">Default sort</span><select className="team-input" value={["newest", "oldest"].includes(preferences.defaultTaskSort) ? preferences.defaultTaskSort : "newest"} onChange={(event) => setPreference("defaultTaskSort", event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
          <label><span className="team-label">Default filter</span><select className="team-input" value={preferences.defaultTaskFilter} onChange={(event) => setPreference("defaultTaskFilter", event.target.value)}><option value="all">All tasks</option><option value="active">Active</option><option value="pending_review">Awaiting review</option><option value="completed">Completed</option></select></label>
          <Toggle id={`${prefix}-autorefresh`} label="Auto refresh" description="Refresh overview data periodically." checked={preferences.autoRefresh} onChange={() => togglePreference("autoRefresh")} />
          <label><span className="team-label">Refresh interval (seconds)</span><input type="number" min="30" max="900" disabled={!preferences.autoRefresh} className="team-input" value={preferences.autoRefreshSeconds} onChange={(event) => setPreference("autoRefreshSeconds", Math.max(30, Math.min(900, Number(event.target.value) || 30)))} /></label>
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[#8a8f98]"><Bell className="h-4 w-4 text-[#828fff]" /> Notifications</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle id={`${prefix}-inapp`} label="In-app alerts" description="Show workspace status notifications." checked={preferences.notifications.inApp} onChange={() => togglePreference("notifications.inApp")} />
          <Toggle id={`${prefix}-due`} label="Due reminders" description="Receive deadline reminders." checked={preferences.notifications.dueReminders} onChange={() => togglePreference("notifications.dueReminders")} />
          <Toggle id={`${prefix}-status`} label="Status updates" description="Receive assignment and review updates." checked={preferences.notifications.statusUpdates} onChange={() => togglePreference("notifications.statusUpdates")} />
          <Toggle id={`${prefix}-email`} label="Email alerts" description="Use your saved notification preference." checked={preferences.notifications.email} onChange={() => togglePreference("notifications.email")} />
        </div>
      </section>
      {role === "freelancer" ? (
        <section>
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-[#8a8f98]">Freelancer goals</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="team-label">Weekly earnings goal (USD)</span><input type="number" min="100" max="50000" className="team-input" value={preferences.goals.weeklyEarnings} onChange={(event) => setPreference("goals.weeklyEarnings", Math.max(100, Number(event.target.value) || 100))} /></label>
            <label><span className="team-label">Weekly completed-task goal</span><input type="number" min="1" max="100" className="team-input" value={preferences.goals.weeklyCompletedTasks} onChange={(event) => setPreference("goals.weeklyCompletedTasks", Math.max(1, Number(event.target.value) || 1))} /></label>
          </div>
        </section>
      ) : null}
      <div className="flex items-center justify-between gap-3 border-t border-[#23252a] pt-5">
        <p className="text-xs text-[#62666d]">Preferences are cloud-synced to your account.</p>
        <button type="button" disabled={savingPreferences} onClick={resetPreferences} className="team-button-secondary"><RotateCcw className="h-4 w-4" /> Reset</button>
      </div>
    </div>
  );
};

export default DashboardSettings;
