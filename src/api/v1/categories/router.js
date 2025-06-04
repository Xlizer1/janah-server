const express = require("express");
const router = express.Router();

const CategoryController = require("./controller");
const validateRequest = require("../../../middleware/validateRequest");
const {
  authenticateToken,
  requireAdmin,
  optionalAuth,
} = require("../../../middleware/auth");
const { asyncHandler } = require("../../../middleware/errorHandler");

const {
  getCategoriesSchema,
  createCategorySchema,
  updateCategorySchema,
  sortOrderSchema,
} = require("./validation");
const {
  uploadMiddlewares,
  handleMulterError,
} = require("../../../middleware/multer");

// Public routes
router.get(
  "/",
  validateRequest(getCategoriesSchema),
  asyncHandler(CategoryController.getAllCategories)
);

router.get(
  "/with-counts",
  asyncHandler(CategoryController.getCategoriesWithCounts)
);

router.get("/options", asyncHandler(CategoryController.getCategoryOptions));

router.get("/search", asyncHandler(CategoryController.searchCategories));

/**
 * @route GET /api/v1/categories/code/:code
 * @desc Get category by code
 * @access Public
 */
router.get("/code/:code", asyncHandler(CategoryController.getCategoryByCode));

router.get("/:identifier", asyncHandler(CategoryController.getCategory));

// Admin routes with file upload support
/**
 * @route POST /api/v1/categories
 * @desc Create new category with optional image upload
 * @access Admin
 */
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  uploadMiddlewares.category,
  handleMulterError,
  validateRequest(createCategorySchema),
  asyncHandler(CategoryController.createCategory)
);

/**
 * @route PUT /api/v1/categories/:category_id
 * @desc Update category with optional image upload
 * @access Admin
 */
router.put(
  "/:category_id",
  authenticateToken,
  requireAdmin,
  uploadMiddlewares.category,
  handleMulterError,
  validateRequest(updateCategorySchema),
  asyncHandler(CategoryController.updateCategory)
);

router.delete(
  "/:category_id",
  authenticateToken,
  requireAdmin,
  asyncHandler(CategoryController.deleteCategory)
);

router.put(
  "/sort-orders/update",
  authenticateToken,
  requireAdmin,
  validateRequest(sortOrderSchema),
  asyncHandler(CategoryController.updateSortOrders)
);

module.exports = router;
