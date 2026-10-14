import TaskCollaborationPanel from "../common/TaskCollaborationPanel";

const DISCUSSION_SECTIONS = Object.freeze(["comments"]);

const TaskDiscussion = ({ task }) => (
  <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
    <TaskCollaborationPanel task={task} sections={DISCUSSION_SECTIONS} title="Discussion and attachments" />
  </section>
);

export default TaskDiscussion;
