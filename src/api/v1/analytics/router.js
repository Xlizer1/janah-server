const express = require("express");
const router = express.Router();
const { AnalyticsModel } = require("./model");
const { authenticateToken, requireAdmin } = require("../../../middleware/auth");
const { asyncHandler } = require("../../../middleware/errorHandler");

// All analytics routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const analytics = await AnalyticsModel.getCategoryAnalytics(req.query);
    res.json({
      status: true,
      message: "Category analytics retrieved successfully",
      data: { analytics },
    });
  })
);

router.get(
  "/top-categories",
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const categories = await AnalyticsModel.getTopCategories(limit);
    res.json({
      status: true,
      message: "Top categories retrieved successfully",
      data: { categories },
    });
  })
);

router.get(
  "/inventory",
  asyncHandler(async (req, res) => {
    const inventory = await AnalyticsModel.getInventoryByCategory();
    res.json({
      status: true,
      message: "Inventory analytics retrieved successfully",
      data: { inventory },
    });
  })
);

router.get(
  "/products-needing-attention",
  asyncHandler(async (req, res) => {
    const products = await AnalyticsModel.getProductsNeedingAttention();
    res.json({
      status: true,
      message: "Products needing attention retrieved successfully",
      data: { products },
    });
  })
);

module.exports = router;
