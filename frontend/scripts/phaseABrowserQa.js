async page => {
  const taskId = "00000000-0000-4000-8000-000000000101";
  const task = {
    id: taskId,
    task_id: "TSK-101",
    client_id: "00000000-0000-4000-8000-000000000201",
    freelancer_id: "00000000-0000-4000-8000-000000000202",
    status: "delivered",
    task_details: {
      title: "Build the TaskNexus workspace",
      description: "Create a cohesive marketplace workspace with protected collaboration and delivery.",
      type: "web_development",
      budget: 1200,
      deadline: "2030-01-01T00:00:00.000Z",
      experienceLevel: "intermediate",
      skillsRequired: ["React", "Node.js"],
    },
    workflow: {
      assignedAt: "2026-10-02T00:00:00.000Z",
      startedAt: "2026-10-03T00:00:00.000Z",
      deliveredAt: "2026-10-10T00:00:00.000Z",
    },
    metrics: {
      progress: 100,
      stage: "ready_for_submission",
      progressNote: "Delivery ready",
      progressUpdatedAt: "2026-10-10T00:00:00.000Z",
    },
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-10T00:00:00.000Z",
  };
  const submission = {
    id: "00000000-0000-4000-8000-000000000301",
    task_id: taskId,
    freelancer_id: task.freelancer_id,
    submission_type: "initial",
    content: {
      deliverables: [{ type: "link", url: "https://example.com/work" }],
      notes: "Ready for review.",
    },
    client_review: { status: "pending" },
    version: 1,
    is_active: true,
    created_at: "2026-10-10T00:00:00.000Z",
  };
  const workspace = {
    task,
    viewer: { role: "client", relationship: "client" },
    participants: {
      client: { id: task.client_id, role: "client", name: "Cora Client", avatar_url: null },
      freelancer: { id: task.freelancer_id, role: "freelancer", name: "Finn Freelancer", avatar_url: null },
    },
    progress: {
      percentage: 100,
      stage: "ready_for_submission",
      note: "Delivery ready",
      updated_at: "2026-10-10T00:00:00.000Z",
    },
    current_submission: {
      id: submission.id,
      version: 1,
      is_active: true,
      submission_type: "initial",
      review_status: "pending",
      submitted_at: submission.created_at,
    },
    submission_summary: {
      has_active_submission: true,
      active_version: 1,
      review_status: "pending",
    },
    rating: { has_rated: false },
    permissions: {
      can_start: false,
      can_return_task: false,
      can_update_progress: false,
      can_submit: false,
      can_resubmit: false,
      can_review: true,
      can_request_revision: true,
      can_rate: false,
      can_manage_subtasks: true,
      can_collaborate: true,
    },
    available_actions: ["approve_delivery", "request_revision"],
  };

  page.__workspaceRequests = [];
  page.__browserErrors = [];
  page.on("pageerror", (error) => page.__browserErrors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") page.__browserErrors.push(`console:${message.text()}`);
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    page.__workspaceRequests.push(`${route.request().method()} ${url.pathname}${url.search}`);
    let payload = { success: true, data: {} };

    if (url.pathname.endsWith("/auth/me")) {
      payload = {
        success: true,
        data: {
          user: {
            id: task.client_id,
            role: "client",
            status: "active",
            email: "client@example.com",
            profile: { firstName: "Cora", lastName: "Client" },
          },
        },
      };
    } else if (url.pathname.endsWith(`/tasks/${taskId}/workspace`)) {
      payload = {
        success: true,
        data: url.searchParams.get("section") === "delivery"
          ? { ...workspace, delivery: { submissions: [submission], rating: { has_rated: false } } }
          : workspace,
      };
    } else if (url.pathname.endsWith(`/tasks/${taskId}/comments`)) {
      payload = {
        success: true,
        data: {
          comments: [{
            id: "comment-1",
            authorName: "Finn Freelancer",
            body: "Delivery is ready.",
            createdAt: "2026-10-10T00:00:00.000Z",
            mentions: [],
            attachments: [{
              id: "file-1",
              originalName: "handoff.pdf",
              url: `/api/tasks/${taskId}/attachments/private-file.pdf`,
            }],
          }],
          participants: [],
        },
      };
    } else if (url.pathname.endsWith(`/tasks/${taskId}/subtasks`)) {
      payload = {
        success: true,
        data: {
          subtasks: [{
            id: "subtask-1",
            title: "Implementation",
            completed: true,
            weight: 100,
            dueDate: "2026-10-09T00:00:00.000Z",
            order: 0,
          }],
          milestoneProgress: 100,
        },
      };
    } else if (url.pathname.endsWith(`/tasks/${taskId}/activity`)) {
      payload = {
        success: true,
        data: [{
          id: "activity-1",
          message: "Work submitted for client review",
          createdAt: "2026-10-10T00:00:00.000Z",
        }],
      };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  await page.goto(`http://127.0.0.1:5173/tasks/${taskId}`);
  await page.waitForLoadState("networkidle");
}
