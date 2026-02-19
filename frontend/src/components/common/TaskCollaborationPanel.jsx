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

const TAB_IDS = {
  COMMENTS: "comments",
  MILESTONES: "milestones",
  ACTIVITY: "activity",
};

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

const getTaskId = (task) => task?.id || task?._id || null;

const TaskCollaborationPanel = ({ task }) => {
  const taskId = getTaskId(task);

  const [activeTab, setActiveTab] = useState(TAB_IDS.COMMENTS);
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
        api.get(`/tasks/${taskId}/comments`),
        api.get(`/tasks/${taskId}/activity`),
        api.get(`/tasks/${taskId}/subtasks`),
      ]);

      setComments(commentsRes.data?.data?.comments || []);
      setParticipants(commentsRes.data?.data?.participants || []);
      setActivity(activityRes.data?.data || []);
      setSubtasks(subtasksRes.data?.data?.subtasks || []);
      setMilestoneProgress(
        Number(subtasksRes.data?.data?.milestoneProgress || 0),
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to load collaboration panel",
      );
    } finally {
      setLoading(false);
    }
  }, [taskId]);

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
      toast.error(error?.response?.data?.message || "Failed to post comment");
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
      toast.error(error?.response?.data?.message || "Failed to create milestone");
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
      toast.error(error?.response?.data?.message || "Failed to update milestone");
    }
  };

  const deleteSubtask = async (subtaskId) => {
    if (!taskId) return;
    try {
      await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
      await refreshTaskCollaboration();
      toast.success("Milestone removed");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to remove milestone");
    }
  };

  if (!taskId) {
    return null;
  }

  return (
    <section className="border-t border-gray-200 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Collaboration</h3>
        <div className="flex items-center gap-2">
          {[
            { id: TAB_IDS.COMMENTS, icon: MessageSquare, label: `Comments (${comments.length})` },
            { id: TAB_IDS.MILESTONES, icon: CheckSquare, label: `Milestones (${subtasks.length})` },
            { id: TAB_IDS.ACTIVITY, icon: Activity, label: `Activity (${activity.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border inline-flex items-center gap-1 ${
                activeTab === tab.id
                  ? "bg-primary-50 text-primary-700 border-primary-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading collaboration data...</div>
      ) : (
        <>
          {activeTab === TAB_IDS.COMMENTS && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/80">
                <textarea
                  rows={3}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  className="input"
                  placeholder="Write an update and mention people with @username"
                />
                {mentionSuggestions.length > 0 && (
                  <div className="mt-2 rounded-md border border-slate-200 bg-white">
                    {mentionSuggestions.map((participant) => (
                      <button
                        key={participant.id}
                        type="button"
                        onClick={() => insertMention(participant)}
                        className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                      >
                        {participant.displayName}
                        <span className="text-xs text-slate-500 ml-2">
                          @{String(participant.email || "").split("@")[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
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
                    className="btn-sm btn-primary inline-flex items-center"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    {submittingComment ? "Posting..." : "Post"}
                  </button>
                </div>
                {commentFiles.length > 0 && (
                  <div className="mt-2 text-xs text-slate-600">
                    {commentFiles.length} attachment(s) selected
                  </div>
                )}
              </div>

              {comments.length === 0 ? (
                <p className="text-sm text-slate-500">No comments yet.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {comment.authorName || "Unknown"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(comment.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {comment.body}
                      </p>
                      {Array.isArray(comment.mentions) && comment.mentions.length > 0 && (
                        <div className="mt-2 text-xs text-primary-700">
                          Mentioned:{" "}
                          {comment.mentions.map((item) => item.displayName).join(", ")}
                        </div>
                      )}
                      {Array.isArray(comment.attachments) &&
                        comment.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {comment.attachments.map((file) => (
                              <a
                                key={file.id}
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100"
                              >
                                <Paperclip className="w-3 h-3 inline mr-1" />
                                {file.originalName}
                              </a>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === TAB_IDS.MILESTONES && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-900">Milestone progress</p>
                  <span className="text-sm text-slate-700">{milestoneProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-cyan-500"
                    style={{ width: `${milestoneProgress}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    value={newSubtask.title}
                    onChange={(event) =>
                      setNewSubtask((prev) => ({ ...prev, title: event.target.value }))
                    }
                    className="input md:col-span-2"
                    placeholder="Add milestone title"
                  />
                  <input
                    type="date"
                    value={newSubtask.dueDate}
                    onChange={(event) =>
                      setNewSubtask((prev) => ({ ...prev, dueDate: event.target.value }))
                    }
                    className="input"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newSubtask.weight}
                    onChange={(event) =>
                      setNewSubtask((prev) => ({ ...prev, weight: Number(event.target.value || 0) }))
                    }
                    className="input"
                    placeholder="Weight %"
                  />
                </div>
                <button
                  type="button"
                  onClick={createSubtask}
                  disabled={creatingSubtask}
                  className="btn-sm btn-primary mt-3 inline-flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {creatingSubtask ? "Adding..." : "Add milestone"}
                </button>
              </div>

              {subtasks.length === 0 ? (
                <p className="text-sm text-slate-500">No milestones yet.</p>
              ) : (
                <div className="space-y-2">
                  {subtasks
                    .slice()
                    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
                    .map((subtask) => (
                      <div
                        key={subtask.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              subtask.completed
                                ? "text-slate-500 line-through"
                                : "text-slate-900"
                            }`}
                          >
                            {subtask.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Due: {subtask.dueDate ? formatDateTime(subtask.dueDate) : "No date"}
                            {" · "}Weight: {Number(subtask.weight || 0)}%
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSubtask(subtask)}
                            className={`px-2 py-1 text-xs rounded-full border ${
                              subtask.completed
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            {subtask.completed ? "Completed" : "Mark done"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSubtask(subtask.id)}
                            className="text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === TAB_IDS.ACTIVITY && (
            <div className="space-y-2">
              {activity.length === 0 ? (
                <p className="text-sm text-slate-500">No activity yet.</p>
              ) : (
                activity.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-sm text-slate-800">{entry.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatDateTime(entry.createdAt)}</p>
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
