import { Bell, Layers, Clock, Target, CheckCircle } from 'lucide-react';

const Toggle = ({ id, label, description, checked, onChange }) => (
  <label
    htmlFor={id}
    className="flex items-start justify-between min-w-[240px] p-3 rounded-xl border border-slate-200 hover:border-primary-200 bg-white/90 transition-colors cursor-pointer"
  >
    <div className="pr-3">
      <p className="text-[13px] font-semibold text-slate-900 leading-snug">{label}</p>
      {description && <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{description}</p>}
    </div>
    <div className="relative inline-flex items-center">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="w-11 h-6 rounded-full bg-slate-200 peer-checked:bg-primary-500 transition-colors duration-200 shadow-inner relative">
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
      </div>
    </div>
  </label>
);

const SelectField = ({ id, label, value, options, onChange }) => (
  <label htmlFor={id} className="block min-w-[220px]">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{label}</p>
    <select
      id={id}
      className="input py-2"
      value={value}
      onChange={onChange}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const NumberField = ({ id, label, value, min, max, onChange, disabled = false }) => (
  <label htmlFor={id} className="block min-w-[180px]">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{label}</p>
    <input
      id={id}
      type="number"
      className="input py-2"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={onChange}
    />
  </label>
);

const SectionTitle = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em]">
    <Icon className="w-4 h-4 text-primary-600" />
    <span>{title}</span>
  </div>
);

const DashboardSettings = ({
  preferences,
  togglePreference,
  setPreference,
  resetPreferences,
  title = 'Workspace Preferences',
  className = '',
}) => {
  const onToggle = togglePreference || (() => {});
  const onSet = setPreference || (() => {});

  return (
    <div className={`w-full bg-white/95 backdrop-blur-sm border border-slate-100 rounded-2xl shadow-md ${className}`}>
      <div className="px-4 py-3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-primary-600" />
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-slate-500 leading-snug">
            Saved locally for this browser.
          </p>
          {resetPreferences && (
            <button
              type="button"
              className="btn-sm btn-secondary"
              onClick={resetPreferences}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-4">
        <SectionTitle icon={CheckCircle} title="Workspace" />
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Toggle
            id="pref-compact"
            label="Compact cards"
            description="Reduce card spacing"
            checked={preferences.compactCards}
            onChange={() => onToggle('compactCards')}
          />
          <Toggle
            id="pref-progress"
            label="Progress bars"
            description="Show completion bars"
            checked={preferences.showProgressBars}
            onChange={() => onToggle('showProgressBars')}
          />
          <Toggle
            id="pref-advanced-stats"
            label="Advanced insights"
            description="Enable additional analytics"
            checked={preferences.showAdvancedStats}
            onChange={() => onToggle('showAdvancedStats')}
          />
          <Toggle
            id="pref-deadline-rail"
            label="Deadline rail"
            description="Show due-soon tracker"
            checked={preferences.showDeadlineRail}
            onChange={() => onToggle('showDeadlineRail')}
          />
          <Toggle
            id="pref-focus"
            label="Focus mode"
            description="Reduce non-essential UI"
            checked={preferences.focusMode}
            onChange={() => onToggle('focusMode')}
          />
          <Toggle
            id="pref-financial"
            label="Hide financials"
            description="Mask revenue and budgets"
            checked={preferences.hideFinancials}
            onChange={() => onToggle('hideFinancials')}
          />
        </div>

        <SectionTitle icon={Clock} title="Layout And Automation" />
        <div className="flex flex-wrap gap-3">
          <SelectField
            id="pref-layout"
            label="Task layout"
            value={preferences.taskLayout}
            options={[
              { value: 'list', label: 'List' },
              { value: 'grid', label: 'Grid' },
              { value: 'board', label: 'Board' },
            ]}
            onChange={(event) => onSet('taskLayout', event.target.value)}
          />
          <SelectField
            id="pref-sort"
            label="Default sort"
            value={preferences.defaultTaskSort}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'budget_high', label: 'Highest budget' },
              { value: 'budget_low', label: 'Lowest budget' },
              { value: 'deadline_soon', label: 'Nearest deadline' },
            ]}
            onChange={(event) => onSet('defaultTaskSort', event.target.value)}
          />
          <SelectField
            id="pref-filter"
            label="Default filter"
            value={preferences.defaultTaskFilter}
            options={[
              { value: 'all', label: 'All tasks' },
              { value: 'active', label: 'Active' },
              { value: 'pending_review', label: 'Pending review' },
              { value: 'completed', label: 'Completed' },
            ]}
            onChange={(event) => onSet('defaultTaskFilter', event.target.value)}
          />
          <Toggle
            id="pref-autorefresh"
            label="Auto refresh"
            description="Refresh dashboard periodically"
            checked={preferences.autoRefresh}
            onChange={() => onToggle('autoRefresh')}
          />
          <NumberField
            id="pref-autorefresh-seconds"
            label="Refresh interval (sec)"
            value={preferences.autoRefreshSeconds}
            min={30}
            max={900}
            disabled={!preferences.autoRefresh}
            onChange={(event) => {
              const raw = Number(event.target.value);
              if (Number.isNaN(raw)) {
                return;
              }
              const clamped = Math.max(30, Math.min(900, raw));
              onSet('autoRefreshSeconds', clamped);
            }}
          />
        </div>

        <SectionTitle icon={Target} title="Goals" />
        <div className="flex flex-wrap gap-3">
          <NumberField
            id="pref-goal-earnings"
            label="Weekly earnings goal"
            value={preferences.goals.weeklyEarnings}
            min={100}
            max={50000}
            onChange={(event) => {
              const raw = Number(event.target.value);
              if (!Number.isNaN(raw)) {
                onSet('goals.weeklyEarnings', Math.max(100, raw));
              }
            }}
          />
          <NumberField
            id="pref-goal-completed"
            label="Weekly completed goal"
            value={preferences.goals.weeklyCompletedTasks}
            min={1}
            max={100}
            onChange={(event) => {
              const raw = Number(event.target.value);
              if (!Number.isNaN(raw)) {
                onSet('goals.weeklyCompletedTasks', Math.max(1, raw));
              }
            }}
          />
        </div>

        <SectionTitle icon={Layers} title="Quick Actions" />
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Toggle
            id="pref-templates"
            label="Task templates"
            description="Show quick template launcher"
            checked={preferences.quickActions.templates}
            onChange={() => onToggle('quickActions.templates')}
          />
          <Toggle
            id="pref-export"
            label="CSV export"
            description="Enable one-click exports"
            checked={preferences.quickActions.export}
            onChange={() => onToggle('quickActions.export')}
          />
          <Toggle
            id="pref-pinning"
            label="Pin important tasks"
            description="Keep starred tasks at top"
            checked={preferences.quickActions.pinning}
            onChange={() => onToggle('quickActions.pinning')}
          />
        </div>

        <SectionTitle icon={Bell} title="Notifications" />
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Toggle
            id="pref-email"
            label="Email alerts"
            description="Status changes and approvals"
            checked={preferences.notifications.email}
            onChange={() => onToggle('notifications.email')}
          />
          <Toggle
            id="pref-inapp"
            label="In-app alerts"
            description="Toast and badge updates"
            checked={preferences.notifications.inApp}
            onChange={() => onToggle('notifications.inApp')}
          />
          <Toggle
            id="pref-due"
            label="Due reminders"
            description="Deadlines approaching"
            checked={preferences.notifications.dueReminders}
            onChange={() => onToggle('notifications.dueReminders')}
          />
          <Toggle
            id="pref-status"
            label="Status updates"
            description="Assignee and review updates"
            checked={preferences.notifications.statusUpdates}
            onChange={() => onToggle('notifications.statusUpdates')}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardSettings;
