const express = require("express");
const router = express.Router();

const validateRequest = require("../../../middleware/validateRequest");
const {
  authenticateToken,
  requireAdmin,
  requireActiveUser,
  optionalAuth,
} = require("../../../middleware/auth");
const { asyncHandler } = require("../../../middleware/errorHandler");
const { ProductController } = require("./controller");
const {
  getProductsSchema,
  createProductSchema,
  updateProductSchema,
} = require("./validation");

router.get(
  "/",
  optionalAuth,
  validateRequest(getProductsSchema),
  asyncHandler(ProductController.getAllProducts)
);

router.get("/categories", asyncHandler(ProductController.getCategories));

router.get(
  "/:product_id",
  optionalAuth,
  asyncHandler(ProductController.getProductById)
);

// Admin routes
router.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  validateRequest(getProductsSchema),
  asyncHandler(ProductController.getAllProductsAdmin)
);

router.post(
  "/",
  authenticateToken,
  requireAdmin,
  validateRequest(createProductSchema),
  asyncHandler(ProductController.createProduct)
);

router.put(
  "/:product_id",
  authenticateToken,
  requireAdmin,
  validateRequest(updateProductSchema),
  asyncHandler(ProductController.updateProduct)
);

router.delete(
  "/:product_id",
  authenticateToken,
  requireAdmin,
  asyncHandler(ProductController.deleteProduct)
);

module.exports = router;
