// backend/src/data/reviewData.js
const supabase = require('../config/supabase');
const localReviewStore = require("./localReviewStore");
const { createSupabaseRunner } = require("./supabaseFallbackRunner");

const runQuery = createSupabaseRunner("review");

const createReview = async (reviewData) => {
    const data = await runQuery(
        () => supabase.from('reviews').insert([reviewData]).select(),
        "creating review",
        {
            fallbackAction: () => localReviewStore.createReview(reviewData),
        }
    );

    return Array.isArray(data) ? data[0] : data;
};

const findReviews = async (filters) => {
    const queryFactory = () => {
        let query = supabase.from('reviews').select('*');

        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
        }

        return query;
    };

    return runQuery(queryFactory, "finding reviews", {
        fallbackAction: () => localReviewStore.findReviews(filters),
    });
};

const getAverageRating = async (userId) => {
    try {
        const reviews = await findReviews({ reviewee_id: userId });

        if (!reviews || reviews.length === 0) {
            return { averageRating: 0, totalReviews: 0 };
        }

        const totalReviews = reviews.length;
        const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;

        return { averageRating, totalReviews };
    } catch (error) {
        throw error;
    }
};

module.exports = {
    createReview,
    findReviews,
    getAverageRating,
};
