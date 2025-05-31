const express = require("express");
const router = express.Router();

const validateRequest = require("../../../middleware/validateRequest");
const {
  authenticateToken,
  requireAdmin,
  optionalAuth,
} = require("../../../middleware/auth");
const { asyncHandler } = require("../../../middleware/errorHandler");
const { ProductController } = require("./controller");
const {
  getProductsSchema,
  createProductSchema,
  updateProductSchema,
  updateStockSchema,
  searchProductsSchema,
} = require("./validation");

// Public routes (no authentication required)

/**
 * @route GET /api/v1/products
 * @desc Get all products with filters
 * @access Public
 */
router.get(
  "/",
  optionalAuth,
  validateRequest(getProductsSchema),
  asyncHandler(ProductController.getAllProducts)
);

/**
 * @route GET /api/v1/products/featured
 * @desc Get featured products
 * @access Public
 */
router.get(
  "/featured",
  validateRequest(getProductsSchema),
  asyncHandler(ProductController.getFeaturedProducts)
);

/**
 * @route GET /api/v1/products/search
 * @desc Search products
 * @access Public
 */
router.get(
  "/search",
  validateRequest(searchProductsSchema),
  asyncHandler(ProductController.searchProducts)
);

/**
 * @route GET /api/v1/products/categories
 * @desc Get all categories
 * @access Public
 */
router.get("/categories", asyncHandler(ProductController.getCategories));

/**
 * @route GET /api/v1/products/category/:identifier
 * @desc Get products by category ID or slug (handled in controller)
 * @access Public
 */
router.get(
  "/category/:identifier",
  validateRequest(getProductsSchema),
  asyncHandler(ProductController.getProductsByCategory)
);

/**
 * @route GET /api/v1/products/:product_id
 * @desc Get product by ID or slug
 * @access Public
 */
router.get(
  "/:product_id",
  optionalAuth,
  asyncHandler(ProductController.getProductById)
);

// Admin routes (authentication required)

/**
 * @route GET /api/v1/products/admin/all
 * @desc Get all products (admin view)
 * @access Admin
 */
router.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  validateRequest(getProductsSchema),
  asyncHandler(ProductController.getAllProductsAdmin)
);

/**
 * @route POST /api/v1/products
 * @desc Create new product
 * @access Admin
 */
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  validateRequest(createProductSchema),
  asyncHandler(ProductController.createProduct)
);

/**
 * @route PUT /api/v1/products/:product_id
 * @desc Update product
 * @access Admin
 */
router.put(
  "/:product_id",
  authenticateToken,
  requireAdmin,
  validateRequest(updateProductSchema),
  asyncHandler(ProductController.updateProduct)
);

/**
 * @route PATCH /api/v1/products/:product_id/stock
 * @desc Update product stock quantity
 * @access Admin
 */
router.patch(
  "/:product_id/stock",
  authenticateToken,
  requireAdmin,
  validateRequest(updateStockSchema),
  asyncHandler(ProductController.updateProductStock)
);

/**
 * @route DELETE /api/v1/products/:product_id
 * @desc Delete product
 * @access Admin
 */
router.delete(
  "/:product_id",
  authenticateToken,
  requireAdmin,
  asyncHandler(ProductController.deleteProduct)
);

module.exports = router;
