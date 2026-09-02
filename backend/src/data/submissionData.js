// backend/src/data/submissionData.js
const supabase = require('../config/supabase');
const localSubmissionStore = require("./localSubmissionStore");
const { createSupabaseRunner } = require("./supabaseFallbackRunner");

const runQuery = createSupabaseRunner("submission");

const submitWorkAtomically = async ({ taskId, freelancerId, content, submissionType, idempotencyKey }) => {
    return runQuery(
        () => supabase.rpc('submit_task_work', {
            p_task_id: taskId,
            p_freelancer_id: freelancerId,
            p_content: content,
            p_submission_type: submissionType,
            p_idempotency_key: idempotencyKey,
        }),
        "submitting task work",
        {
            fallbackAction: async () => {
                const localTaskStore = require('./localTaskStore');
                const task = await localTaskStore.updateTaskIfStatus(taskId, 'in_progress', {
                    status: 'delivered',
                    workflow: { deliveredAt: new Date().toISOString() },
                });
                if (!task || task.freelancer_id !== freelancerId) return null;
                const submission = await localSubmissionStore.createSubmission({
                    task_id: taskId,
                    freelancer_id: freelancerId,
                    submission_type: submissionType,
                    content,
                    idempotency_key: idempotencyKey,
                });
                return { task, submission };
            },
        },
    );
};

const createSubmission = async (submissionData) => {
    const data = await runQuery(
        () => supabase.from('submissions').insert([submissionData]).select(),
        "creating submission",
        {
            fallbackAction: () => localSubmissionStore.createSubmission(submissionData),
        }
    );
    return Array.isArray(data) ? data[0] : data;
};

const findSubmissions = async (filters) => {
    const queryFactory = () => {
        let query = supabase.from('submissions').select('*');
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (key.includes('->>')) {
                    const [column, jsonPath] = key.split('->>');
                    query = query.filter(`${column}->>${jsonPath}`, 'eq', value);
                    return;
                }
                if (key.includes('->')) {
                    const [column, jsonPath] = key.split('->');
                    query = query.filter(`${column}->${jsonPath}`, 'eq', value);
                    return;
                }
                if (Array.isArray(value)) {
                    query = query.in(key, value);
                } else {
                    query = query.eq(key, value);
                }
            });
        }
        return query;
    };

    return runQuery(queryFactory, "finding submissions", {
        fallbackAction: () => localSubmissionStore.findSubmissions(filters),
    });
};

const findSubmissionById = async (id) => {
    return runQuery(
        () => supabase.from('submissions').select('*, task:tasks(*)').eq('id', id).single(),
        "finding submission by id",
        {
            allowNoRows: true,
            fallbackAction: () => localSubmissionStore.findSubmissionById(id),
        }
    );
};

const updateSubmission = async (id, updates) => {
    const data = await runQuery(
        () => supabase.from('submissions').update(updates).eq('id', id).select(),
        "updating submission",
        {
            fallbackAction: () => localSubmissionStore.updateSubmission(id, updates),
        }
    );
    return Array.isArray(data) ? data[0] : data;
};

const getRevisionCount = async (taskId) => {
    const submissions = await findSubmissions({
        task_id: taskId,
        submission_type: 'revision'
    });
    return submissions ? submissions.length : 0;
};

module.exports = {
    submitWorkAtomically,
    createSubmission,
    findSubmissions,
    findSubmissionById,
    updateSubmission,
    getRevisionCount,
};
