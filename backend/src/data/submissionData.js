// backend/src/data/submissionData.js
const supabase = require('../config/supabase');
const localSubmissionStore = require("./localSubmissionStore");
const { createSupabaseRunner } = require("./supabaseFallbackRunner");

const runQuery = createSupabaseRunner("submission");

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
    createSubmission,
    findSubmissions,
    findSubmissionById,
    updateSubmission,
    getRevisionCount,
};
