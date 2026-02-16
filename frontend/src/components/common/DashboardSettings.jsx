import { Bell, Layers, BarChart3 } from 'lucide-react';

const Toggle = ({ id, label, description, checked, onChange }) => (
  <label
    htmlFor={id}
    className="flex items-start justify-between p-2.5 rounded-lg border border-slate-200 hover:border-primary-200 bg-white/90 transition-colors cursor-pointer shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
  >
    <div className="pr-3">
      <p className="text-[13px] font-semibold text-slate-900 leading-snug">{label}</p>
      {description && <p className="text-[11px] text-slate-500 leading-snug">{description}</p>}
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

const DashboardSettings = ({ preferences, togglePreference, title = 'Preferences', className = '' }) => {
  return (
    <div className={`w-full bg-white/95 backdrop-blur-sm border border-slate-100 rounded-2xl shadow-md ${className}`}>
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center space-x-2">
        <Layers className="w-4 h-4 text-primary-600" />
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Toggle
            id="pref-compact"
            label="Compact cards"
            description="Reduce spacing in lists"
            checked={preferences.compactCards}
            onChange={() => togglePreference('compactCards')}
          />
          <Toggle
            id="pref-progress"
            label="Show progress bars"
            description="Display completion bars on tasks"
            checked={preferences.showProgressBars}
            onChange={() => togglePreference('showProgressBars')}
          />
        </div>

        <div className="flex items-center space-x-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] pt-1">
          <Bell className="w-4 h-4 text-primary-600" />
          <span>Notifications</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Toggle
            id="pref-email"
            label="Email alerts"
            description="Status changes and approvals"
            checked={preferences.notifications.email}
            onChange={() => togglePreference('notifications.email')}
          />
          <Toggle
            id="pref-inapp"
            label="In-app alerts"
            description="Badge + toast updates"
            checked={preferences.notifications.inApp}
            onChange={() => togglePreference('notifications.inApp')}
          />
          <Toggle
            id="pref-due"
            label="Due reminders"
            description="Deadlines approaching"
            checked={preferences.notifications.dueReminders}
            onChange={() => togglePreference('notifications.dueReminders')}
          />
          <Toggle
            id="pref-status"
            label="Status updates"
            description="Assignee, review, payout changes"
            checked={preferences.notifications.statusUpdates}
            onChange={() => togglePreference('notifications.statusUpdates')}
          />
        </div>

        <div className="flex items-center space-x-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] pt-1">
          <BarChart3 className="w-4 h-4 text-primary-600" />
          <span>Data</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          Preferences are saved locally on this device.
        </p>
      </div>
    </div>
  );
};

export default DashboardSettings;
