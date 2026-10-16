import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckSquare,
  Clock,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { apiError } from "../../utils/marketplace";
import { resolveCollaborationPermissions } from "../../utils/taskWorkspacePermissions";

const TAB_IDS = {
  COMMENTS: "comments",
  MILESTONES: "milestones",
  ACTIVITY: "activity",
};

const DEFAULT_SECTIONS = Object.freeze(Object.values(TAB_IDS));

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTaskId = (task) => task?.id || null;

const TaskCollaborationPanel = ({
  task,
  sections = DEFAULT_SECTIONS,
  title = "Collaboration",
  authoritativePermissions,
}) => {
  const { user } = useAuth();
  const taskId = getTaskId(task);

  const { canCollaborate, canManageSubtasks } = useMemo(
    () => resolveCollaborationPermissions({ task, user, authoritative: authoritativePermissions }),
    [authoritativePermissions, task, user],
  );

  const enabledSections = useMemo(
    () => DEFAULT_SECTIONS.filter((section) => sections.includes(section)),
    [sections],
  );
  const sectionKey = enabledSections.join("|");
  const [activeTab, setActiveTab] = useState(enabledSections[0] || TAB_IDS.COMMENTS);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [activity, setActivity] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [milestoneProgress, setMilestoneProgress] = useState(0);

  const [commentBody, setCommentBody] = useState("");
  const [commentFiles, setCommentFiles] = useState([]);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [newSubtask, setNewSubtask] = useState({
    title: "",
    dueDate: "",
    weight: 0,
  });
  const [creatingSubtask, setCreatingSubtask] = useState(false);

  const refreshTaskCollaboration = useCallback(async () => {
    if (!taskId) return;

    setLoading(true);
    try {
      const [commentsRes, activityRes, subtasksRes] = await Promise.all([
        enabledSections.includes(TAB_IDS.COMMENTS)
          ? api.get(`/tasks/${taskId}/comments`)
          : Promise.resolve(null),
        enabledSections.includes(TAB_IDS.ACTIVITY)
          ? api.get(`/tasks/${taskId}/activity`)
          : Promise.resolve(null),
        enabledSections.includes(TAB_IDS.MILESTONES)
          ? api.get(`/tasks/${taskId}/subtasks`)
          : Promise.resolve(null),
      ]);

      if (commentsRes) {
        setComments(commentsRes.data?.data?.comments || []);
        setParticipants(commentsRes.data?.data?.participants || []);
      }
      if (activityRes) setActivity(activityRes.data?.data || []);
      if (subtasksRes) {
        setSubtasks(subtasksRes.data?.data?.subtasks || []);
        setMilestoneProgress(Number(subtasksRes.data?.data?.milestoneProgress || 0));
      }
    } catch (error) {
      toast.error(apiError(error, "Failed to load collaboration panel"));
    } finally {
      setLoading(false);
    }
  }, [enabledSections, taskId]);

  useEffect(() => {
    if (!taskId) {
      setComments([]);
      setParticipants([]);
      setActivity([]);
      setSubtasks([]);
      setMilestoneProgress(0);
      return;
    }

    refreshTaskCollaboration();
  }, [taskId, refreshTaskCollaboration]);

  useEffect(() => {
    if (!enabledSections.includes(activeTab)) {
      setActiveTab(enabledSections[0] || TAB_IDS.COMMENTS);
    }
  }, [activeTab, enabledSections, sectionKey]);

  const mentionQuery = useMemo(() => {
    const tokens = commentBody.split(/\s+/);
    const last = tokens[tokens.length - 1] || "";
    if (!last.startsWith("@") || last.length < 2) {
      return "";
    }
    return last.slice(1).toLowerCase();
  }, [commentBody]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionQuery) return [];
    return participants
      .filter((participant) => {
        const display = String(participant.displayName || "").toLowerCase();
        const emailLocal = String(participant.email || "")
          .split("@")[0]
          .toLowerCase();
        return (
          display.includes(mentionQuery) ||
          emailLocal.includes(mentionQuery) ||
          display.replace(/\s+/g, "").includes(mentionQuery)
        );
      })
      .slice(0, 5);
  }, [mentionQuery, participants]);

  const insertMention = (participant) => {
    const mentionToken =
      String(participant.email || "").split("@")[0] ||
      String(participant.displayName || "").replace(/\s+/g, "");
    const tokens = commentBody.split(/\s+/);
    tokens[tokens.length - 1] = `@${mentionToken}`;
    setCommentBody(`${tokens.join(" ")} `);
  };

  const submitComment = async () => {
    if (!taskId) return;
    if (!commentBody.trim() && commentFiles.length === 0) {
      toast.error("Write a comment or attach a file");
      return;
    }

    try {
      setSubmittingComment(true);
      const form = new FormData();
      form.append("body", commentBody.trim());
      commentFiles.forEach((file) => {
        form.append("attachments", file);
      });

      await api.post(`/tasks/${taskId}/comments`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setCommentBody("");
      setCommentFiles([]);
      await refreshTaskCollaboration();
      toast.success("Comment posted");
    } catch (error) {
      toast.error(apiError(error, "Failed to post comment"));
    } finally {
      setSubmittingComment(false);
    }
  };

  const createSubtask = async () => {
    if (!taskId) return;
    if (!newSubtask.title.trim()) {
      toast.error("Milestone title is required");
      return;
    }

    try {
      setCreatingSubtask(true);
      await api.post(`/tasks/${taskId}/subtasks`, {
        title: newSubtask.title.trim(),
        dueDate: newSubtask.dueDate || null,
        weight: Number(newSubtask.weight || 0),
      });
      setNewSubtask({ title: "", dueDate: "", weight: 0 });
      await refreshTaskCollaboration();
      toast.success("Milestone added");
    } catch (error) {
      toast.error(apiError(error, "Failed to create milestone"));
    } finally {
      setCreatingSubtask(false);
    }
  };

  const toggleSubtask = async (subtask) => {
    if (!taskId) return;
    try {
      await api.patch(`/tasks/${taskId}/subtasks/${subtask.id}`, {
        completed: !subtask.completed,
      });
      await refreshTaskCollaboration();
    } catch (error) {
      toast.error(apiError(error, "Failed to update milestone"));
    }
  };

  const deleteSubtask = async (subtaskId) => {
    if (!taskId) return;
    try {
      await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
      await refreshTaskCollaboration();
      toast.success("Milestone removed");
    } catch (error) {
      toast.error(apiError(error, "Failed to remove milestone"));
    }
  };

  const downloadAttachment = async (file) => {
    try {
      const url = new URL(file.url, window.location.origin);
      const apiPath = url.pathname.replace(/^\/api/, "");
      const response = await api.get(apiPath, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.originalName || "attachment";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error(apiError(error, "Failed to download attachment"));
    }
  };

  if (!taskId) {
    return null;
  }

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-base font-medium text-[#f7f8f8]">{title}</h3>
        {enabledSections.length > 1 ? <div role="tablist" aria-label="Task collaboration sections" className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: TAB_IDS.COMMENTS, icon: MessageSquare, label: `Comments (${comments.length})` },
            { id: TAB_IDS.MILESTONES, icon: CheckSquare, label: `Milestones (${subtasks.length})` },
            { id: TAB_IDS.ACTIVITY, icon: Activity, label: `Activity (${activity.length})` },
          ].filter((tab) => enabledSections.includes(tab.id)).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`collaboration-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`collaboration-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border inline-flex items-center gap-1 ${
                activeTab === tab.id
                  ? "border-[#5e6ad2] bg-[#5e6ad2]/15 text-[#dfe2ff]"
                  : "border-[#34343a] bg-[#141516] text-[#8a8f98]"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div> : null}
      </div>

      {loading ? (
        <div className="text-sm text-[#8a8f98]" role="status">Loading task data...</div>
      ) : (
        <>
          {activeTab === TAB_IDS.COMMENTS && (
            <div role="tabpanel" id="collaboration-panel-comments" aria-labelledby="collaboration-tab-comments" className="space-y-4">
              {canCollaborate && (
                <div className="rounded-xl border border-[#34343a] bg-[#141516] p-3 sm:p-4">
                  <label htmlFor="task-comment" className="sr-only">Comment</label>
                  <textarea
                    id="task-comment"
                    rows={3}
                    maxLength={5000}
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    className="team-input"
                    placeholder="Write an update and mention people with @username"
                  />
                  <div className="mt-1 text-right text-[10px] text-[#62666d]">
                    {commentBody.length}/5000
                  </div>
                  {mentionSuggestions.length > 0 && (
                    <div className="mt-2 rounded-md border border-[#34343a] bg-[#0f1011]">
                      {mentionSuggestions.map((participant) => (
                        <button
                          key={participant.id}
                          type="button"
                          onClick={() => insertMention(participant)}
                          className="block w-full px-3 py-2 text-left text-sm text-[#d0d6e0] hover:bg-[#18191a]"
                        >
                          {participant.displayName}
                          <span className="ml-2 text-xs text-[#62666d]">
                            @{String(participant.email || "").split("@")[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#8a8f98]">
                      <Paperclip className="w-4 h-4" />
                      Attach files
                      <input
                        type="file"
                        multiple
                        onChange={(event) =>
                          setCommentFiles(Array.from(event.target.files || []))
                        }
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={submitComment}
                      disabled={submittingComment}
                      className="team-button-primary"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      {submittingComment ? "Posting..." : "Post"}
                    </button>
                  </div>
                  {commentFiles.length > 0 && (
                    <div className="mt-2 text-xs text-[#8a8f98]">
                      {commentFiles.length} attachment(s) selected
                    </div>
                  )}
                </div>
              )}

              {comments.length === 0 ? (
                <p className="text-sm text-[#8a8f98]">No comments yet.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <article key={comment.id} className="rounded-xl border border-[#23252a] bg-[#141516] p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-[#f7f8f8]">
                          {comment.authorName || "Unknown"}
                        </p>
                        <p className="text-xs text-[#62666d]">
                          {formatDateTime(comment.createdAt)}
                        </p>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[#d0d6e0]">
                        {comment.body}
                      </p>
                      {Array.isArray(comment.mentions) && comment.mentions.length > 0 && (
                        <div className="mt-2 text-xs text-[#b7bdf8]">
                          Mentioned:{" "}
                          {comment.mentions.map((item) => item.displayName).join(", ")}
                        </div>
                      )}
                      {Array.isArray(comment.attachments) &&
                        comment.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {comment.attachments.map((file) => (
                              <button
                                key={file.id}
                                type="button"
                                onClick={() => downloadAttachment(file)}
                                className="rounded border border-[#34343a] bg-[#18191a] px-2 py-1 text-xs text-[#d0d6e0] hover:border-[#5e6ad2]"
                              >
                                <Paperclip className="w-3 h-3 inline mr-1" />
                                {file.originalName}
                              </button>
                            ))}
                          </div>
                        )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === TAB_IDS.MILESTONES && (
            <div role="tabpanel" id="collaboration-panel-milestones" aria-labelledby="collaboration-tab-milestones" className="space-y-4">
              <div className="rounded-xl border border-[#23252a] bg-[#141516] p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[#f7f8f8]">Milestone progress</p>
                  <span className="text-sm text-[#b7bdf8]">{milestoneProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#23252a]">
                  <div
                    className="h-full bg-[#5e6ad2]"
                    style={{ width: `${milestoneProgress}%` }}
                  />
                </div>
              </div>

              {canManageSubtasks && (
                <div className="rounded-xl border border-[#34343a] bg-[#141516] p-3 sm:p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <label htmlFor="milestone-title" className="sr-only">Milestone title</label>
                    <input
                      id="milestone-title"
                      value={newSubtask.title}
                      onChange={(event) =>
                        setNewSubtask((prev) => ({ ...prev, title: event.target.value }))
                      }
                      className="team-input md:col-span-2"
                      placeholder="Add milestone title"
                    />
                    <label htmlFor="milestone-date" className="sr-only">Milestone due date</label>
                    <input
                      id="milestone-date"
                      type="date"
                      value={newSubtask.dueDate}
                      onChange={(event) =>
                        setNewSubtask((prev) => ({ ...prev, dueDate: event.target.value }))
                      }
                      className="team-input"
                    />
                    <label htmlFor="milestone-weight" className="sr-only">Milestone weight percentage</label>
                    <input
                      id="milestone-weight"
                      type="number"
                      min="0"
                      max="100"
                      value={newSubtask.weight}
                      onChange={(event) =>
                        setNewSubtask((prev) => ({ ...prev, weight: Number(event.target.value || 0) }))
                      }
                      className="team-input"
                      placeholder="Weight %"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={createSubtask}
                    disabled={creatingSubtask}
                    className="team-button-primary mt-3"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {creatingSubtask ? "Adding..." : "Add milestone"}
                  </button>
                </div>
              )}

              {subtasks.length === 0 ? (
                <p className="text-sm text-[#8a8f98]">No milestones yet.</p>
              ) : (
                <div className="space-y-2">
                  {subtasks
                    .slice()
                    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
                    .map((subtask) => (
                      <div
                        key={subtask.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#23252a] bg-[#141516] p-3 sm:p-4"
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              subtask.completed
                                ? "text-[#62666d] line-through"
                                : "text-[#f7f8f8]"
                            }`}
                          >
                            {subtask.title}
                          </p>
                          <p className="mt-1 text-xs text-[#8a8f98]">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Due: {subtask.dueDate ? formatDateTime(subtask.dueDate) : "No date"}
                            {", "}Weight: {Number(subtask.weight || 0)}%
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {canManageSubtasks ? (
                            <button
                              type="button"
                              aria-label={`${subtask.completed ? "Reopen" : "Complete"} milestone ${subtask.title}`}
                              onClick={() => toggleSubtask(subtask)}
                              className={`px-2 py-1 text-xs rounded-full border ${
                                subtask.completed
                                  ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
                                  : "border-[#34343a] bg-[#18191a] text-[#8a8f98]"
                              }`}
                            >
                              {subtask.completed ? "Completed" : "Mark done"}
                            </button>
                          ) : (
                            <span
                              className={`px-2 py-1 text-xs rounded-full border ${
                                subtask.completed
                                  ? "border-emerald-800 bg-emerald-950/30 text-emerald-200"
                                  : "border-[#34343a] bg-[#18191a] text-[#8a8f98]"
                              }`}
                            >
                              {subtask.completed ? "Completed" : "Pending"}
                            </span>
                          )}
                          {canManageSubtasks && (
                            <button
                              type="button"
                              onClick={() => deleteSubtask(subtask.id)}
                              className="rounded p-1 text-rose-300 hover:bg-rose-950/30 hover:text-rose-200"
                              aria-label={`Delete milestone ${subtask.title}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === TAB_IDS.ACTIVITY && (
            <div role="tabpanel" id="collaboration-panel-activity" aria-labelledby="collaboration-tab-activity" className="space-y-2">
              {activity.length === 0 ? (
                <p className="text-sm text-[#8a8f98]">No activity yet.</p>
              ) : (
                activity.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[#23252a] bg-[#141516] px-3 py-3 sm:px-4">
                    <p className="text-sm text-[#d0d6e0]">{entry.message}</p>
                    <p className="mt-1 text-xs text-[#62666d]">{formatDateTime(entry.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default TaskCollaborationPanel;
