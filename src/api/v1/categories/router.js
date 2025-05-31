const express = require('express');
const router = express.Router();

const CategoryController = require('./controller');
const validateRequest = require('../../../middleware/validateRequest');
const { authenticateToken, requireAdmin, optionalAuth } = require('../../../middleware/auth');
const { asyncHandler } = require('../../../middleware/errorHandler');

const {
    getCategoriesSchema,
    createCategorySchema,
    updateCategorySchema,
    sortOrderSchema
} = require('./validation');

// Public routes
router.get('/', 
    validateRequest(getCategoriesSchema),
    asyncHandler(CategoryController.getAllCategories)
);

router.get('/with-counts', 
    asyncHandler(CategoryController.getCategoriesWithCounts)
);

router.get('/options', 
    asyncHandler(CategoryController.getCategoryOptions)
);

router.get('/search', 
    asyncHandler(CategoryController.searchCategories)
);

router.get('/:identifier', 
    asyncHandler(CategoryController.getCategory)
);

// Admin routes
router.post('/', 
    authenticateToken,
    requireAdmin,
    validateRequest(createCategorySchema),
    asyncHandler(CategoryController.createCategory)
);

router.put('/:category_id', 
    authenticateToken,
    requireAdmin,
    validateRequest(updateCategorySchema),
    asyncHandler(CategoryController.updateCategory)
);

router.delete('/:category_id', 
    authenticateToken,
    requireAdmin,
    asyncHandler(CategoryController.deleteCategory)
);

router.put('/sort-orders/update', 
    authenticateToken,
    requireAdmin,
    validateRequest(sortOrderSchema),
    asyncHandler(CategoryController.updateSortOrders)
);

module.exports = router;