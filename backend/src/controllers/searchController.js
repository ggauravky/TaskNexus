const searchService = require("../services/searchService");
const { normalizeSearchQuery } = require("../serializers");

const search = async (req, res, next) => {
  try {
    const query = normalizeSearchQuery(req.query.q);
    const data = await searchService.search({
      query,
      viewer: { id: req.user.id, role: req.user.role },
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { search };
