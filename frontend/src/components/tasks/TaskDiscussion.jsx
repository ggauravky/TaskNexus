import TaskCollaborationPanel from "../common/TaskCollaborationPanel";

const DISCUSSION_SECTIONS = Object.freeze(["comments"]);

const TaskDiscussion = ({ workspace }) => (
  <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
    <TaskCollaborationPanel
      task={workspace.task}
      sections={DISCUSSION_SECTIONS}
      title="Discussion and attachments"
      authoritativePermissions={workspace.permissions}
    />
  </section>
);

export default TaskDiscussion;
