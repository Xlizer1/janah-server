const express = require('express');
const router = express.Router();
const { SearchController } = require('./controller');
const { optionalAuth } = require('../../../middleware/auth');
const { asyncHandler } = require('../../../middleware/errorHandler');

router.get('/global', 
    optionalAuth,
    asyncHandler(SearchController.globalSearch)
);

router.get('/suggestions', 
    asyncHandler(SearchController.getSearchSuggestions)
);

router.get('/filters', 
    asyncHandler(SearchController.getFilterOptions)
);

module.exports = router;