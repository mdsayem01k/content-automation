const searchService = require("../services/searchService");

/**
 * Controller: receives { keyword } in JSON body or query param.
 * Returns JSON with links that include topAns=.
 */
exports.searchQuora = async (req, res, next) => {
  try {
    const keyword = (req.body.keyword || req.query.keyword || "").toString().trim();
    if (!keyword) {
      return res.status(400).json({ error: "keyword is required (in body or ?keyword=...)" });
    }

    const result = await searchService.fetchQuoraLinks(keyword);
    return res.json(result);
  } catch (err) {
    next(err);
  }
};
