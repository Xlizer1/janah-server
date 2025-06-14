const express = require("express");
const router = express.Router();

const homeRouter = require("./home/router");
const authRouter = require("./auth/router");
const adminRouter = require("./admin/router");
const categoryRouter = require("./categories/router");
const productRouter = require("./products/router");
const orderRouter = require("./orders/router"); // NEW: Order routes
const analyticsRouter = require("./analytics/router");
const bulkRouter = require("./bulk/router");
const searchRouter = require("./search/router");
const importRouter = require("./import/router");

// Home route
router.use("/", homeRouter);

// Authentication routes
router.use("/auth", authRouter);

// Admin routes
router.use("/admin", adminRouter);

// Category routes
router.use("/categories", categoryRouter);

// Product routes
router.use("/products", productRouter);

// Order routes
router.use("/orders", orderRouter);

// Analytics routes
router.use("/analytics", analyticsRouter);

// Bulk operations routes
router.use("/bulk", bulkRouter);

// Search routes
router.use("/search", searchRouter);

// Import/Export routes
router.use("/import", importRouter);

module.exports = router;
