// backend/src/data/reviewData.js
const supabase = require('../config/supabase');

const createReview = async (reviewData) => {
    const { data, error } = await supabase
        .from('reviews')
        .insert([reviewData])
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data[0];
};

const findReviews = async (filters) => {
    let query = supabase.from('reviews').select('*');

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

const getAverageRating = async (userId) => {
    const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', userId);

    if (error) {
        throw new Error(error.message);
    }

    if (!data || data.length === 0) {
        return { averageRating: 0, totalReviews: 0 };
    }

    const totalReviews = data.length;
    const averageRating = data.reduce((sum, review) => sum + review.rating, 0) / totalReviews;

    return { averageRating, totalReviews };
};

module.exports = {
    createReview,
    findReviews,
    getAverageRating,
};
