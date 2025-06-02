const express = require("express");
const router = express.Router();
const multer = require("multer");
const { DataImporter } = require("../../../utils/dataImport");
const { authenticateToken, requireAdmin } = require("../../../middleware/auth");
const { asyncHandler } = require("../../../middleware/errorHandler");
const { ValidationError } = require("../../../middleware/errorHandler");

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/temp/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new ValidationError("Only CSV files are allowed"));
    }
  },
});

// All import routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Product Import/Export
router.post(
  "/products/csv",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError("CSV file is required");
    }

    const options = {
      dryRun: req.body.dry_run === "true",
      skipErrors: req.body.skip_errors === "true",
    };

    const results = await DataImporter.importProductsFromCSV(
      req.file.path,
      options
    );

    // Clean up uploaded file
    const fs = require("fs").promises;
    try {
      await fs.unlink(req.file.path);
    } catch (error) {
      console.warn("Failed to delete temp file:", error);
    }

    res.json({
      status: true,
      message: "Product import completed",
      data: results,
    });
  })
);

router.get(
  "/products/csv",
  asyncHandler(async (req, res) => {
    const options = {
      categoryId: req.query.category_id
        ? parseInt(req.query.category_id)
        : undefined,
      isActive:
        req.query.is_active !== undefined
          ? req.query.is_active === "true"
          : undefined,
    };

    const csv = await DataImporter.exportProductsToCSV(options);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=products.csv");
    res.send(csv);
  })
);

// Category Import/Export
router.post(
  "/categories/csv",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError("CSV file is required");
    }

    const options = {
      dryRun: req.body.dry_run === "true",
      skipErrors: req.body.skip_errors === "true",
    };

    const results = await DataImporter.importCategoriesFromCSV(
      req.file.path,
      options
    );

    // Clean up uploaded file
    const fs = require("fs").promises;
    try {
      await fs.unlink(req.file.path);
    } catch (error) {
      console.warn("Failed to delete temp file:", error);
    }

    res.json({
      status: true,
      message: "Category import completed",
      data: results,
    });
  })
);

router.get(
  "/categories/csv",
  asyncHandler(async (req, res) => {
    const options = {
      includeInactive: req.query.include_inactive === "true",
    };

    const csv = await DataImporter.exportCategoriesToCSV(options);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=categories.csv");
    res.send(csv);
  })
);

// CSV Templates
router.get(
  "/templates/products",
  asyncHandler(async (req, res) => {
    const csv = DataImporter.generateProductCSVTemplate();

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=products_template.csv"
    );
    res.send(csv);
  })
);

router.get(
  "/templates/categories",
  asyncHandler(async (req, res) => {
    const csv = DataImporter.generateCategoryCSVTemplate();

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=categories_template.csv"
    );
    res.send(csv);
  })
);

module.exports = router;
