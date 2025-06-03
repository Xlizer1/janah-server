const express = require("express");
const router = express.Router();

const OrderController = require("./controller");
const validateRequest = require("../../../middleware/validateRequest");
const { authenticateToken, requireAdmin } = require("../../../middleware/auth");
const { asyncHandler } = require("../../../middleware/errorHandler");

const {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  getOrdersSchema,
  orderStatisticsSchema,
} = require("./validation");

// User routes (authentication required)

/**
 * @route POST /api/v1/orders
 * @desc Create a new order
 * @access Private (User)
 */
router.post(
  "/",
  authenticateToken,
  validateRequest(createOrderSchema),
  asyncHandler(OrderController.createOrder)
);

/**
 * @route GET /api/v1/orders/my-orders
 * @desc Get current user's orders
 * @access Private (User)
 */
router.get(
  "/my-orders",
  authenticateToken,
  validateRequest(getOrdersSchema),
  asyncHandler(OrderController.getUserOrders)
);

/**
 * @route GET /api/v1/orders/my-orders/:order_id
 * @desc Get specific order by ID (user's own orders only)
 * @access Private (User)
 */
router.get(
  "/my-orders/:order_id",
  authenticateToken,
  asyncHandler(OrderController.getUserOrder)
);

/**
 * @route GET /api/v1/orders/track/:order_number
 * @desc Track order by order number (user's own orders only)
 * @access Private (User)
 */
router.get(
  "/track/:order_number",
  authenticateToken,
  asyncHandler(OrderController.getUserOrderByNumber)
);

// Admin routes (authentication + admin role required)

/**
 * @route GET /api/v1/orders/admin/all
 * @desc Get all orders with filters
 * @access Admin
 */
router.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  validateRequest(getOrdersSchema),
  asyncHandler(OrderController.getAllOrders)
);

/**
 * @route GET /api/v1/orders/admin/:order_id
 * @desc Get order by ID with full details
 * @access Admin
 */
router.get(
  "/admin/:order_id",
  authenticateToken,
  requireAdmin,
  asyncHandler(OrderController.getOrderById)
);

/**
 * @route PUT /api/v1/orders/admin/:order_id/status
 * @desc Update order status
 * @access Admin
 */
router.put(
  "/admin/:order_id/status",
  authenticateToken,
  requireAdmin,
  validateRequest(updateOrderStatusSchema),
  asyncHandler(OrderController.updateOrderStatus)
);

/**
 * @route POST /api/v1/orders/admin/:order_id/cancel
 * @desc Cancel an order
 * @access Admin
 */
router.post(
  "/admin/:order_id/cancel",
  authenticateToken,
  requireAdmin,
  validateRequest(cancelOrderSchema),
  asyncHandler(OrderController.cancelOrder)
);

/**
 * @route GET /api/v1/orders/admin/status/:status
 * @desc Get orders by status
 * @access Admin
 */
router.get(
  "/admin/status/:status",
  authenticateToken,
  requireAdmin,
  validateRequest(getOrdersSchema),
  asyncHandler(OrderController.getOrdersByStatus)
);

/**
 * @route GET /api/v1/orders/admin/statistics
 * @desc Get order statistics
 * @access Admin
 */
router.get(
  "/admin/statistics",
  authenticateToken,
  requireAdmin,
  validateRequest(orderStatisticsSchema),
  asyncHandler(OrderController.getOrderStatistics)
);

/**
 * @route GET /api/v1/orders/admin/:order_id/history
 * @desc Get order status change history
 * @access Admin
 */
router.get(
  "/admin/:order_id/history",
  authenticateToken,
  requireAdmin,
  asyncHandler(OrderController.getOrderStatusHistory)
);

module.exports = router;
