import { useState } from "react";
import { Activity, Calendar, DollarSign, ExternalLink, FileCheck2, Loader2, Star, User, X } from "lucide-react";
import Dialog from "../common/Dialog";
import StatusBadge from "../common/StatusBadge";
import TaskCollaborationPanel from "../common/TaskCollaborationPanel";
import { TASK_STATUS } from "../../utils/constants";
import { formatCurrency, formatDate, personName, taskBudget, taskDeadline, taskDescription, taskTitle } from "../../utils/marketplace";

const TaskDetailsModal = ({ isOpen, onClose, detail, loading, busyAction, onReview, onRate }) => {
  const task = detail?.task;
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const submissions = detail?.submissions || [];
  const reviews = detail?.reviews || [];
  const pendingSubmission = submissions.find((item) => item.client_review?.status === "pending" && item.is_active)
    || submissions.find((item) => item.client_review?.status === "pending");
  const hasRated = reviews.some((review) => review.review_type === "client_to_platform");

  if (!isOpen || !task) return null;
  const busy = Boolean(busyAction);

  return (
    <Dialog onClose={busy ? () => {} : onClose} titleId="client-task-details-title" panelClassName="max-w-4xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#23252a] bg-[#0f1011]/95 px-5 py-4 backdrop-blur sm:px-6">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={task.status} /><span className="team-chip">{task.task_id}</span></div><h2 id="client-task-details-title" className="mt-3 truncate text-xl font-semibold sm:text-2xl">{taskTitle(task)}</h2></div>
        <button type="button" onClick={onClose} disabled={busy} className="team-icon-button" aria-label="Close task details"><X className="h-4 w-4" /></button>
      </div>
      {loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#828fff]" /></div> : <div className="space-y-7 p-5 sm:p-6">
        <section><h3 className="text-sm font-medium">Description</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#8a8f98]">{taskDescription(task)}</p></section>
        <dl className="grid gap-px overflow-hidden rounded-xl border border-[#23252a] bg-[#23252a] sm:grid-cols-4">
          <Detail icon={DollarSign} label="Budget" value={formatCurrency(taskBudget(task))} />
          <Detail icon={Calendar} label="Deadline" value={formatDate(taskDeadline(task))} />
          <Detail icon={User} label="Freelancer" value={personName(task.freelancer)} />
          <Detail icon={Activity} label="Progress" value={`${Number(task.metrics?.progress || 0)}%`} />
        </dl>
        {task.metrics?.progressNote ? <p className="rounded-lg border border-[#23252a] bg-[#141516] p-4 text-sm text-[#8a8f98]"><span className="block text-xs text-[#62666d]">Latest progress update</span><span className="mt-1 block text-[#d0d6e0]">{task.metrics.progressNote}</span></p> : null}

        {task.status === TASK_STATUS.DELIVERED && pendingSubmission ? <section className="rounded-xl border border-[#5e6ad2]/60 bg-[#5e6ad2]/10 p-4 sm:p-5"><div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-[#b7bdf8]" /><h3 className="font-medium">Delivery awaiting review</h3></div><p className="mt-2 text-xs text-[#8a8f98]">Submitted {formatDate(pendingSubmission.created_at)}. Approval completes the task and creates its payment record.</p><div className="mt-4 space-y-2">{pendingSubmission.content?.deliverables?.map((item, index) => <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-[#34343a] bg-[#141516] px-3 py-3 text-sm text-[#b7bdf8] hover:text-white"><span className="truncate">{item.url}</span><ExternalLink className="h-4 w-4 shrink-0" /></a>)}</div>{pendingSubmission.content?.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-[#d0d6e0]">{pendingSubmission.content.notes}</p> : null}<label className="mt-5 block"><span className="team-label">Revision feedback</span><textarea className="team-input min-h-24 resize-y" value={revisionFeedback} onChange={(event) => setRevisionFeedback(event.target.value)} placeholder="Required when requesting a revision" maxLength={2000} /></label><div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={busy || !revisionFeedback.trim()} onClick={() => onReview(pendingSubmission.id, "request_revision", revisionFeedback.trim())} className="team-button-secondary">Request revision</button><button type="button" disabled={busy} onClick={() => setApproveOpen(true)} className="team-button-primary">Approve delivery</button></div></section> : null}

        {task.status === TASK_STATUS.CLIENT_REVISION && pendingSubmission?.client_review?.feedback ? <section className="rounded-xl border border-amber-900 bg-amber-950/20 p-4"><h3 className="text-sm font-medium text-amber-100">Revision requested</h3><p className="mt-2 whitespace-pre-wrap text-sm text-amber-200/80">{pendingSubmission.client_review.feedback}</p></section> : null}

        {task.status === TASK_STATUS.COMPLETED && !hasRated ? <section className="rounded-xl border border-[#23252a] bg-[#141516] p-4 sm:p-5"><div className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-300" /><h3 className="font-medium">Rate the freelancer</h3></div><div className="mt-4 flex gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} className="rounded p-1 focus:outline-none focus:ring-2 focus:ring-[#828fff]" aria-label={`${value} star${value === 1 ? "" : "s"}`}><Star className={`h-6 w-6 ${value <= rating ? "fill-amber-300 text-amber-300" : "text-[#62666d]"}`} /></button>)}</div><label className="mt-3 block"><span className="team-label">Feedback (optional)</span><textarea className="team-input min-h-20 resize-y" value={ratingFeedback} onChange={(event) => setRatingFeedback(event.target.value)} maxLength={2000} /></label><button disabled={busy} onClick={() => onRate(task.id, rating, ratingFeedback.trim())} className="team-button-primary mt-4">Submit rating</button></section> : null}
        {hasRated ? <p className="text-sm text-[#62666d]">You have already rated this completed task.</p> : null}

        <TaskCollaborationPanel task={task} />
      </div>}
      {approveOpen ? <div className="sticky bottom-0 border-t border-[#34343a] bg-[#141516] p-4"><p className="text-sm font-medium">Approve this delivery?</p><p className="mt-1 text-xs text-[#8a8f98]">This completes the task and cannot be repeated.</p><div className="mt-3 flex justify-end gap-2"><button disabled={busy} onClick={() => setApproveOpen(false)} className="team-button-secondary">Cancel</button><button disabled={busy} onClick={async () => { await onReview(pendingSubmission.id, "approve", ""); setApproveOpen(false); }} className="team-button-primary">Confirm approval</button></div></div> : null}
    </Dialog>
  );
};

const Detail = ({ icon: Icon, label, value }) => <div className="min-w-0 bg-[#141516] p-4"><dt className="flex items-center gap-2 text-xs text-[#62666d]"><Icon className="h-4 w-4" />{label}</dt><dd className="mt-2 truncate text-sm font-medium text-[#d0d6e0]">{value}</dd></div>;

export default TaskDetailsModal;
