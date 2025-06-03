const express = require("express");
const router = express.Router();
const { AnalyticsModel } = require("./model");
const { authenticateToken, requireAdmin } = require("../../../middleware/auth");
const { asyncHandler } = require("../../../middleware/errorHandler");

// All analytics routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Existing product/category analytics routes
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

// NEW: Order Analytics Routes

/**
 * @route GET /api/v1/analytics/orders
 * @desc Get order analytics overview
 * @access Admin
 */
router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;
    const options = {};
    if (start_date) options.startDate = start_date;
    if (end_date) options.endDate = end_date;

    const analytics = await AnalyticsModel.getOrderAnalytics(options);
    res.json({
      status: true,
      message: "Order analytics retrieved successfully",
      data: { analytics },
    });
  })
);

/**
 * @route GET /api/v1/analytics/orders/trends
 * @desc Get daily order trends
 * @access Admin
 */
router.get(
  "/orders/trends",
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const trends = await AnalyticsModel.getDailyOrderTrends(days);
    res.json({
      status: true,
      message: "Order trends retrieved successfully",
      data: { trends },
    });
  })
);

/**
 * @route GET /api/v1/analytics/orders/top-products
 * @desc Get top selling products
 * @access Admin
 */
router.get(
  "/orders/top-products",
  asyncHandler(async (req, res) => {
    const { limit, start_date, end_date } = req.query;
    const options = {
      limit: parseInt(limit) || 10,
    };
    if (start_date) options.startDate = start_date;
    if (end_date) options.endDate = end_date;

    const products = await AnalyticsModel.getTopSellingProducts(options);
    res.json({
      status: true,
      message: "Top selling products retrieved successfully",
      data: { products },
    });
  })
);

/**
 * @route GET /api/v1/analytics/orders/top-customers
 * @desc Get top customers by order value
 * @access Admin
 */
router.get(
  "/orders/top-customers",
  asyncHandler(async (req, res) => {
    const { limit, start_date, end_date } = req.query;
    const options = {
      limit: parseInt(limit) || 10,
    };
    if (start_date) options.startDate = start_date;
    if (end_date) options.endDate = end_date;

    const customers = await AnalyticsModel.getTopCustomers(options);
    res.json({
      status: true,
      message: "Top customers retrieved successfully",
      data: { customers },
    });
  })
);

/**
 * @route GET /api/v1/analytics/orders/fulfillment
 * @desc Get order fulfillment metrics
 * @access Admin
 */
router.get(
  "/orders/fulfillment",
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;
    const options = {};
    if (start_date) options.startDate = start_date;
    if (end_date) options.endDate = end_date;

    const metrics = await AnalyticsModel.getOrderFulfillmentMetrics(options);
    res.json({
      status: true,
      message: "Order fulfillment metrics retrieved successfully",
      data: { metrics },
    });
  })
);

/**
 * @route GET /api/v1/analytics/dashboard
 * @desc Get comprehensive dashboard analytics
 * @access Admin
 */
router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;
    const options = {};
    if (start_date) options.startDate = start_date;
    if (end_date) options.endDate = end_date;

    const dashboard = await AnalyticsModel.getDashboardAnalytics(options);
    res.json({
      status: true,
      message: "Dashboard analytics retrieved successfully",
      data: { dashboard },
    });
  })
);

module.exports = router;
