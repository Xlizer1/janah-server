const express = require('express');
const router = express.Router();
const { BulkController } = require('./controller');
const { authenticateToken, requireAdmin } = require('../../../middleware/auth');
const { asyncHandler } = require('../../../middleware/errorHandler');
const validateRequest = require('../../../middleware/validateRequest');
const Joi = require('joi');

// Validation schemas
const bulkUpdateCategoriesSchema = Joi.object({
    updates: Joi.array().items(
        Joi.object({
            product_id: Joi.number().integer().positive().required(),
            category_id: Joi.number().integer().positive().allow(null).required()
        })
    ).min(1).max(100).required()
});

const bulkUpdatePricesSchema = Joi.object({
    operation: Joi.string().valid('set', 'increase', 'decrease', 'percentage').default('set'),
    updates: Joi.array().items(
        Joi.object({
            product_id: Joi.number().integer().positive().required(),
            value: Joi.number().required()
        })
    ).min(1).max(100).required()
});

const bulkUpdateStatusSchema = Joi.object({
    product_ids: Joi.array().items(
        Joi.number().integer().positive()
    ).min(1).max(100).required(),
    is_active: Joi.boolean().required()
});

// All bulk routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

router.put('/categories', 
    validateRequest(bulkUpdateCategoriesSchema),
    asyncHandler(BulkController.bulkUpdateCategories)
);

router.put('/prices', 
    validateRequest(bulkUpdatePricesSchema),
    asyncHandler(BulkController.bulkUpdatePrices)
);

router.put('/status', 
    validateRequest(bulkUpdateStatusSchema),
    asyncHandler(BulkController.bulkUpdateStatus)
);

module.exports = router;