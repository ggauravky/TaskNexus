import { Loader2, X } from "lucide-react";
import Dialog from "../common/Dialog";

const ConfirmActionDialog = ({ title, description, confirmLabel, destructive = false, busy, onClose, onConfirm }) => (
  <Dialog onClose={onClose} titleId="team-confirm-title" descriptionId="team-confirm-description" panelClassName="max-w-md !border-[#34343a] !bg-[#0f1011] !shadow-none">
    <div className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="team-confirm-title" className="text-lg font-medium text-[#f7f8f8]">{title}</h2><p id="team-confirm-description" className="mt-2 text-sm leading-6 text-[#8a8f98]">{description}</p></div>
        <button type="button" onClick={onClose} className="team-icon-button" aria-label="Close dialog"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="team-button-secondary">Cancel</button>
        <button type="button" disabled={busy} onClick={onConfirm} className={destructive ? "team-button-danger" : "team-button-primary"}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{confirmLabel}
        </button>
      </div>
    </div>
  </Dialog>
);

export default ConfirmActionDialog;
