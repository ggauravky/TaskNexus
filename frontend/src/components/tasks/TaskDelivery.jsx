import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileCheck2, Loader2, Plus, Send, Star, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { apiError, formatDate } from "../../utils/marketplace";

const DELIVERABLE_TYPES = Object.freeze(["link", "document", "file"]);
const emptyDeliverable = () => ({ type: "link", url: "" });

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const TaskDelivery = ({ workspace, onWorkspaceChanged }) => {
  const taskId = workspace.task.id;
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [deliverables, setDeliverables] = useState([emptyDeliverable()]);
  const [comments, setComments] = useState("");
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [confirmApproval, setConfirmApproval] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState("");

  const loadDelivery = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/tasks/${taskId}/workspace`, {
        params: { section: "delivery" },
        signal,
      });
      setDelivery(response.data?.data?.delivery || { submissions: [] });
    } catch (requestError) {
      if (requestError?.code !== "ERR_CANCELED") {
        setError(apiError(requestError, "Delivery details could not be loaded"));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    const controller = new AbortController();
    loadDelivery(controller.signal);
    return () => controller.abort();
  }, [loadDelivery]);

  const submissions = delivery?.submissions || [];
  const activeSubmission = submissions.find((submission) => submission.is_active) || submissions[0] || null;

  useEffect(() => {
    if (!activeSubmission || !workspace.permissions.can_resubmit) return;
    const existing = activeSubmission.content?.deliverables || [];
    setDeliverables(existing.length ? existing.map((item) => ({ type: item.type || "link", url: item.url || "" })) : [emptyDeliverable()]);
    setComments(activeSubmission.content?.notes || "");
  }, [activeSubmission, workspace.permissions.can_resubmit]);

  const mutate = async (key, request, success) => {
    if (busy) return;
    setBusy(key);
    try {
      await request();
      toast.success(success);
      await onWorkspaceChanged();
      await loadDelivery();
    } catch (requestError) {
      toast.error(apiError(requestError));
    } finally {
      setBusy("");
    }
  };

  const updateDeliverable = (index, field, value) => {
    setDeliverables((items) => items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const submitWork = (event) => {
    event.preventDefault();
    const normalized = deliverables.map((item) => ({ type: item.type, url: item.url.trim() }));
    if (!normalized.length || normalized.some((item) => !DELIVERABLE_TYPES.includes(item.type) || !isHttpsUrl(item.url))) {
      toast.error("Every deliverable needs a valid HTTPS URL and supported type");
      return;
    }
    const payload = { deliverables: normalized, comments: comments.trim() };
    if (workspace.permissions.can_resubmit && activeSubmission?.id) {
      mutate("resubmit_work", () => api.put(`/freelancer/submissions/${activeSubmission.id}`, payload), "Revision submitted for review");
    } else {
      mutate("submit_work", () => api.post(`/tasks/${taskId}/submit`, payload), "Work submitted for review");
    }
  };

  const review = (action) => {
    if (!activeSubmission?.id) return;
    if (action === "request_revision" && !revisionFeedback.trim()) {
      toast.error("Revision feedback is required");
      return;
    }
    mutate(
      action,
      () => api.post(`/client/submissions/${activeSubmission.id}/review`, {
        action,
        feedback: action === "approve" ? "" : revisionFeedback.trim(),
        revisionRequested: action === "request_revision" ? revisionFeedback.trim() : undefined,
      }),
      action === "approve" ? "Delivery approved" : "Revision requested",
    );
    setConfirmApproval(false);
  };

  const rateFreelancer = () => mutate(
    "rate_freelancer",
    () => api.post("/client/rate-freelancer", { taskId, rating, feedback: ratingFeedback.trim() }),
    "Rating submitted",
  );

  if (loading) return <div className="flex min-h-64 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-[#828fff]" /><span className="sr-only">Loading delivery</span></div>;
  if (error) return <section className="rounded-xl border border-rose-950 bg-rose-950/10 p-5"><h2 className="text-base font-medium text-rose-100">Delivery unavailable</h2><p className="mt-2 text-sm text-rose-200/75">{error}</p><button type="button" onClick={() => loadDelivery()} className="team-button-secondary mt-4">Try again</button></section>;

  return (
    <div className="space-y-5">
      {(workspace.permissions.can_submit || workspace.permissions.can_resubmit) ? <form onSubmit={submitWork} className="rounded-xl border border-[#5e6ad2]/60 bg-[#5e6ad2]/10 p-4 sm:p-5">
        <div className="flex items-center gap-2"><Send className="h-5 w-5 text-[#b7bdf8]" /><h2 className="font-medium text-[#f7f8f8]">{workspace.permissions.can_resubmit ? "Submit revision" : "Submit work"}</h2></div>
        <p className="mt-2 text-xs leading-5 text-[#8a8f98]">Add HTTPS locations for each deliverable. These fields use the existing marketplace submission contract.</p>
        <div className="mt-5 space-y-3">{deliverables.map((deliverable, index) => <div key={index} className="grid gap-2 rounded-lg border border-[#34343a] bg-[#141516] p-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
          <label><span className="team-label">Type</span><select className="team-input" value={deliverable.type} onChange={(event) => updateDeliverable(index, "type", event.target.value)}>{DELIVERABLE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label><span className="team-label">HTTPS URL</span><input className="team-input" type="url" required placeholder="https://example.com/delivery" value={deliverable.url} onChange={(event) => updateDeliverable(index, "url", event.target.value)} /></label>
          <button type="button" aria-label={`Remove deliverable ${index + 1}`} className="team-icon-button self-end" disabled={deliverables.length === 1 || Boolean(busy)} onClick={() => setDeliverables((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></button>
        </div>)}</div>
        <button type="button" className="team-button-secondary mt-3" disabled={Boolean(busy)} onClick={() => setDeliverables((items) => [...items, emptyDeliverable()])}><Plus className="h-4 w-4" />Add deliverable</button>
        <label className="mt-4 block"><span className="team-label">Delivery comments</span><textarea className="team-input min-h-24 resize-y" maxLength={3000} value={comments} onChange={(event) => setComments(event.target.value)} /></label>
        <button type="submit" disabled={Boolean(busy)} className="team-button-primary mt-4">{["submit_work", "resubmit_work"].includes(busy) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{workspace.permissions.can_resubmit ? "Submit revision" : "Submit work"}</button>
      </form> : null}

      {workspace.permissions.can_review && activeSubmission ? <section className="rounded-xl border border-[#5e6ad2]/60 bg-[#5e6ad2]/10 p-4 sm:p-5">
        <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-[#b7bdf8]" /><h2 className="font-medium text-[#f7f8f8]">Delivery awaiting review</h2></div>
        <SubmissionContent submission={activeSubmission} />
        <label className="mt-5 block"><span className="team-label">Revision feedback</span><textarea className="team-input min-h-24 resize-y" maxLength={2000} value={revisionFeedback} onChange={(event) => setRevisionFeedback(event.target.value)} placeholder="Required when requesting a revision" /></label>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={Boolean(busy) || !revisionFeedback.trim()} onClick={() => review("request_revision")} className="team-button-secondary">Request revision</button><button type="button" disabled={Boolean(busy)} onClick={() => setConfirmApproval(true)} className="team-button-primary">Approve delivery</button></div>
        {confirmApproval ? <div className="mt-4 rounded-lg border border-[#34343a] bg-[#141516] p-4"><p className="text-sm font-medium text-[#f7f8f8]">Approve this delivery and complete the task?</p><p className="mt-1 text-xs text-[#8a8f98]">This creates the existing payment record and cannot be repeated.</p><div className="mt-3 flex justify-end gap-2"><button type="button" className="team-button-secondary" disabled={Boolean(busy)} onClick={() => setConfirmApproval(false)}>Cancel</button><button type="button" className="team-button-primary" disabled={Boolean(busy)} onClick={() => review("approve")}>{busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Confirm approval</button></div></div> : null}
      </section> : null}

      {workspace.permissions.can_rate ? <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
        <h2 className="font-medium text-[#f7f8f8]">Rate the freelancer</h2>
        <div className="mt-4 flex gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} className="rounded p-1 focus:outline-none focus:ring-2 focus:ring-[#828fff]" aria-label={`${value} star${value === 1 ? "" : "s"}`}><Star className={`h-6 w-6 ${value <= rating ? "fill-amber-300 text-amber-300" : "text-[#62666d]"}`} /></button>)}</div>
        <label className="mt-3 block"><span className="team-label">Feedback (optional)</span><textarea className="team-input min-h-20 resize-y" maxLength={2000} value={ratingFeedback} onChange={(event) => setRatingFeedback(event.target.value)} /></label>
        <button type="button" className="team-button-primary mt-4" disabled={Boolean(busy)} onClick={rateFreelancer}>{busy === "rate_freelancer" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Submit rating</button>
      </section> : null}

      <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-medium text-[#f7f8f8]">Submission history</h2><p className="mt-1 text-xs text-[#62666d]">Recorded versions and client review outcomes.</p></div><span className="team-chip">{submissions.length}</span></div>
        {submissions.length ? <div className="mt-4 space-y-3">{submissions.map((submission) => <article key={submission.id} className="rounded-xl border border-[#23252a] bg-[#141516] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-[#f7f8f8]">Version {submission.version || 1}</p><span className="team-chip">{String(submission.client_review?.status || "pending").replaceAll("_", " ")}</span></div><SubmissionContent submission={submission} /></article>)}</div> : <p className="mt-4 text-sm text-[#8a8f98]">No work has been submitted yet.</p>}
      </section>
    </div>
  );
};

const SubmissionContent = ({ submission }) => (
  <div className="mt-4">
    <p className="text-xs text-[#62666d]">Submitted {formatDate(submission.created_at)}</p>
    {submission.content?.notes ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#d0d6e0]">{submission.content.notes}</p> : null}
    <div className="mt-3 space-y-2">{(submission.content?.deliverables || []).map((item, index) => (
      isHttpsUrl(item.url) ? <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-[#34343a] bg-[#18191a] px-3 py-3 text-sm text-[#b7bdf8] hover:border-[#5e6ad2] hover:text-white"><span className="min-w-0 truncate">{item.url}</span><span className="flex shrink-0 items-center gap-1 text-xs capitalize text-[#8a8f98]">{item.type}<ExternalLink className="h-3.5 w-3.5" /></span></a> : <p key={`${item.url}-${index}`} className="rounded-lg border border-rose-950 bg-rose-950/10 px-3 py-2 text-xs text-rose-200">Invalid deliverable URL withheld</p>
    ))}</div>
    {submission.client_review?.feedback ? <div className="mt-3 rounded-lg border border-amber-900 bg-amber-950/20 p-3"><p className="text-xs font-medium text-amber-100">Client feedback</p><p className="mt-1 whitespace-pre-wrap text-sm text-amber-200/80">{submission.client_review.feedback}</p></div> : null}
  </div>
);

export default TaskDelivery;
