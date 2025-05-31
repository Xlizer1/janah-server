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
      message: "Import completed",
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

module.exports = router;
