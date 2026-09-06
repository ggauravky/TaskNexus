import { Loader2, Send, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import Dialog from "../common/Dialog";
import api from "../../services/api";
import { apiError } from "../../utils/discovery";

const CollaborationRequestDialog = ({ person, opening, onClose, onSent }) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setSending(true);
    try {
      if (opening) await api.post(`/team-openings/${opening.id}/interest`, { message });
      else await api.post("/collaboration-requests", { recipientId: person.id, message });
      toast.success(opening ? "Interest sent to the Team" : "Collaboration request sent");
      onSent?.(); onClose();
    } catch (error) { toast.error(apiError(error, "Request could not be sent")); }
    finally { setSending(false); }
  };
  const title = opening ? `Express interest in ${opening.title}` : `Collaborate with ${person.display_name}`;
  return <Dialog onClose={onClose} titleId="collaboration-dialog-title" descriptionId="collaboration-dialog-description" panelClassName="max-w-lg border-[#34343a] bg-[#0f1011] text-[#f7f8f8]">
    <form onSubmit={submit}>
      <header className="flex items-start justify-between gap-4 border-b border-[#23252a] p-5 sm:p-6"><div><h2 id="collaboration-dialog-title" className="text-xl font-semibold tracking-[-0.03em]">{title}</h2><p id="collaboration-dialog-description" className="mt-2 text-sm leading-6 text-[#8a8f98]">This sends professional intent only. It does not create a Team membership, Project access, or chat.</p></div><button type="button" onClick={onClose} className="team-icon-button" aria-label="Close collaboration request"><X className="h-4 w-4" /></button></header>
      <div className="p-5 sm:p-6"><div className="rounded-lg border border-[#23252a] bg-[#141516] p-3 text-sm"><p className="text-xs text-[#62666d]">Context</p><p className="mt-1 text-[#d0d6e0]">{opening ? `${opening.team.name} · ${opening.title}` : "General collaboration"}</p></div><label className="mt-5 block"><span className="team-label">Optional message</span><textarea autoFocus value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} className="team-input min-h-28 resize-y" placeholder="Share what you would like to build together." /><span className="mt-2 block text-right text-xs text-[#62666d]">{message.length}/500</span></label></div>
      <footer className="flex justify-end gap-2 border-t border-[#23252a] p-5 sm:px-6"><button type="button" onClick={onClose} className="team-button-secondary">Cancel</button><button disabled={sending} className="team-button-primary">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send request</button></footer>
    </form>
  </Dialog>;
};

export default CollaborationRequestDialog;
