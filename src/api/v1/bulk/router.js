const express = require("express");
const router = express.Router();
const { BulkController } = require("./controller");
const { authenticateToken, requireAdmin } = require("../../../middleware/auth");
const { asyncHandler } = require("../../../middleware/errorHandler");
const validateRequest = require("../../../middleware/validateRequest");
const Joi = require("joi");

// Validation schemas
const bulkUpdateCategoriesSchema = Joi.object({
  updates: Joi.array()
    .items(
      Joi.object({
        // Either product_id or product_code is required
        product_id: Joi.number().integer().positive().optional(),
        product_code: Joi.string()
          .pattern(/^[A-Z0-9]+$/)
          .optional(),
        // Either category_id or category_code is required
        category_id: Joi.number().integer().positive().allow(null).optional(),
        category_code: Joi.string()
          .pattern(/^[A-Z0-9]+$/)
          .optional(),
      }).or("product_id", "product_code")
    )
    .min(1)
    .max(100)
    .required(),
});

const bulkUpdatePricesSchema = Joi.object({
  operation: Joi.string()
    .valid("set", "increase", "decrease", "percentage")
    .default("set"),
  updates: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.number().integer().positive().optional(),
        product_code: Joi.string()
          .pattern(/^[A-Z0-9]+$/)
          .optional(),
        value: Joi.number().required(),
      }).or("product_id", "product_code")
    )
    .min(1)
    .max(100)
    .required(),
});

const bulkUpdateStatusSchema = Joi.object({
  product_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
  product_codes: Joi.array()
    .items(Joi.string().pattern(/^[A-Z0-9]+$/))
    .optional(),
  is_active: Joi.boolean().required(),
}).or("product_ids", "product_codes");

const bulkUpdateCodesSchema = Joi.object({
  updates: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.number().integer().positive().optional(),
        product_code: Joi.string()
          .pattern(/^[A-Z0-9]+$/)
          .optional(),
        new_code: Joi.string()
          .pattern(/^[A-Z0-9]+$/)
          .required()
          .messages({
            "string.pattern.base":
              "New code must contain only uppercase letters and numbers",
          }),
      }).or("product_id", "product_code")
    )
    .min(1)
    .max(100)
    .required(),
});

// All bulk routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

router.put(
  "/categories",
  validateRequest(bulkUpdateCategoriesSchema),
  asyncHandler(BulkController.bulkUpdateCategories)
);

router.put(
  "/prices",
  validateRequest(bulkUpdatePricesSchema),
  asyncHandler(BulkController.bulkUpdatePrices)
);

router.put(
  "/status",
  validateRequest(bulkUpdateStatusSchema),
  asyncHandler(BulkController.bulkUpdateStatus)
);

router.put(
  "/codes",
  validateRequest(bulkUpdateCodesSchema),
  asyncHandler(BulkController.bulkUpdateCodes)
);

module.exports = router;
