import { X } from "lucide-react";
import Dialog from "../common/Dialog";
import DashboardSettings from "../common/DashboardSettings";

const WorkspaceSettingsDialog = ({ open, onClose, role, settings }) => {
  if (!open) return null;
  return (
    <Dialog onClose={onClose} titleId={`${role}-workspace-settings-title`} panelClassName="max-w-4xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#23252a] bg-[#0f1011]/95 px-5 py-4 backdrop-blur">
        <div>
          <p className="team-eyebrow">Workspace preferences</p>
          <h2 id={`${role}-workspace-settings-title`} className="mt-1 text-lg font-semibold capitalize">{role} settings</h2>
        </div>
        <button type="button" onClick={onClose} className="team-icon-button" aria-label="Close workspace settings"><X className="h-4 w-4" /></button>
      </div>
      <DashboardSettings {...settings} role={role} />
    </Dialog>
  );
};

export default WorkspaceSettingsDialog;
