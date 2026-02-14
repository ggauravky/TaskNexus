// backend/src/data/submissionData.js
const supabase = require('../config/supabase');

const createSubmission = async (submissionData) => {
    const { data, error } = await supabase
        .from('submissions')
        .insert([submissionData])
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data[0];
};

const findSubmissions = async (filters) => {
    let query = supabase.from('submissions').select('*');

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                query = query.in(key, value);
            } else {
                query = query.eq(key, value);
            }
        });
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return data;
};

const findSubmissionById = async (id) => {
    const { data, error } = await supabase
        .from('submissions')
        .select('*, task:tasks(*)')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(error.message);
    }

    return data;
};

const updateSubmission = async (id, updates) => {
    const { data, error } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data[0];
};

const getRevisionCount = async (taskId) => {
    const { count, error } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', taskId)
        .eq('submission_type', 'revision');

    if (error) {
        throw new Error(error.message);
    }

    return count;
};

module.exports = {
    createSubmission,
    findSubmissions,
    findSubmissionById,
    updateSubmission,
    getRevisionCount,
};