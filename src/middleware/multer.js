const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const sharp = require("sharp");

const { MAX_FILE_SIZE = 524288000 } = process.env; // 50MB default

class FileUploadService {
  constructor() {
    this.ensureUploadDirectories();
  }

  /**
   * Ensure upload directories exist
   */
  ensureUploadDirectories() {
    const directories = [
      "uploads",
      "uploads/products",
      "uploads/categories",
      "uploads/users",
      "uploads/temp",
      "uploads/optimized", // For optimized images
    ];

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  /**
   * Generate unique filename
   */
  generateFilename(originalname, prefix = "") {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(originalname).toLowerCase();
    const cleanName = prefix ? `${prefix}_` : "";
    return `${cleanName}${timestamp}_${randomBytes}${ext}`;
  }

  /**
   * Create storage configuration for specific type
   */
  createStorage(uploadType) {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = `uploads/${uploadType}`;
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const filename = this.generateFilename(file.originalname, uploadType);
        cb(null, filename);
      },
    });
  }

  /**
   * File filter for images with enhanced validation
   */
  imageFileFilter(req, file, cb) {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP, and GIF images are allowed.`
        ),
        false
      );
    }

    // Check file extension
    if (!allowedExtensions.includes(fileExtension)) {
      return cb(
        new Error(
          `Invalid file extension: ${fileExtension}. Only .jpg, .jpeg, .png, .webp, and .gif files are allowed.`
        ),
        false
      );
    }

    // Additional security check for file size (preliminary)
    if (file.size && file.size > MAX_FILE_SIZE) {
      return cb(
        new Error(
          `File too large. Maximum size is ${(
            MAX_FILE_SIZE /
            (1024 * 1024)
          ).toFixed(1)}MB`
        ),
        false
      );
    }

    cb(null, true);
  }

  /**
   * Create multer instance for specific upload type
   */
  createUploader(uploadType, options = {}) {
    const {
      maxFileSize = MAX_FILE_SIZE,
      allowMultiple = false,
      maxFiles = 5,
      requireAuth = true,
    } = options;

    const multerConfig = {
      storage: this.createStorage(uploadType),
      limits: {
        fileSize: parseInt(maxFileSize),
        files: maxFiles,
        fieldSize: 1024 * 1024, // 1MB for form fields
        fieldNameSize: 100,
        fields: 20,
      },
      fileFilter: this.imageFileFilter.bind(this),
    };

    const upload = multer(multerConfig);

    // Return appropriate upload method
    if (allowMultiple) {
      return upload.array("images", maxFiles);
    } else {
      return upload.single("image");
    }
  }

  /**
   * Optimize image using Sharp (optional feature)
   */
  static async optimizeImage(inputPath, outputPath, options = {}) {
    try {
      const {
        width = 800,
        height = 600,
        quality = 80,
        format = "jpeg",
      } = options;

      await sharp(inputPath)
        .resize(width, height, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality })
        .png({ quality })
        .webp({ quality })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error("Image optimization failed:", error);
      throw new Error("Failed to optimize image");
    }
  }

  /**
   * Delete file safely
   */
  static async deleteFile(filePath) {
    try {
      if (!filePath) return false;

      // Handle both absolute and relative paths
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(filePath);

      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        console.log(`Deleted file: ${fullPath}`);
        return true;
      }

      console.warn(`File not found for deletion: ${fullPath}`);
      return false;
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Get file URL from path
   */
  static getFileUrl(req, filePath) {
    if (!filePath) return null;

    // If it's already a full URL, return as is
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      return filePath;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    // Remove 'uploads/' from the beginning if it exists
    const cleanPath = filePath.replace(/^uploads\//, "");
    return `${baseUrl}/uploads/${cleanPath}`;
  }

  /**
   * Extract file path from URL
   */
  static getFilePathFromUrl(imageUrl, baseUrl) {
    if (!imageUrl || !imageUrl.startsWith(baseUrl)) return null;

    const urlParts = imageUrl.replace(baseUrl, "").replace("/uploads/", "");
    return `uploads/${urlParts}`;
  }

  /**
   * Validate file type by content (magic numbers)
   */
  static async validateFileByContent(filePath) {
    try {
      const buffer = await fs.promises.readFile(filePath, {
        start: 0,
        end: 11,
      });
      const hex = buffer.toString("hex").toUpperCase();

      // Common image file signatures
      const signatures = {
        FFD8FF: "jpeg",
        "89504E47": "png",
        47494638: "gif",
        52494646: "webp", // RIFF format (WebP uses RIFF)
      };

      for (const [signature, type] of Object.entries(signatures)) {
        if (hex.startsWith(signature)) {
          return { valid: true, type };
        }
      }

      return { valid: false, type: null };
    } catch (error) {
      console.error("File validation error:", error);
      return { valid: false, type: null };
    }
  }

  /**
   * Clean up temp files older than specified time
   */
  static async cleanupTempFiles(maxAgeHours = 24) {
    try {
      const tempDir = "uploads/temp";
      if (!fs.existsSync(tempDir)) return;

      const files = await fs.promises.readdir(tempDir);
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.promises.stat(filePath);
        const age = Date.now() - stats.mtime.getTime();

        if (age > maxAge) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(
          `Cleaned up ${deletedCount} temp files older than ${maxAgeHours} hours`
        );
      }
    } catch (error) {
      console.error("Temp file cleanup error:", error);
    }
  }

  /**
   * Get file info
   */
  static async getFileInfo(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = await fs.promises.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();

      return {
        path: filePath,
        size: stats.size,
        extension: ext,
        mimeType: this.getMimeTypeFromExtension(ext),
        created: stats.birthtime,
        modified: stats.mtime,
        isImage: [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext),
      };
    } catch (error) {
      console.error("Error getting file info:", error);
      return null;
    }
  }

  /**
   * Get MIME type from file extension
   */
  static getMimeTypeFromExtension(ext) {
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };

    return mimeTypes[ext.toLowerCase()] || "application/octet-stream";
  }
}

// Create service instance
const fileUploadService = new FileUploadService();

// Export upload middlewares for different types
const uploadMiddlewares = {
  // Product image upload
  product: fileUploadService.createUploader("products", {
    maxFileSize: MAX_FILE_SIZE,
    allowMultiple: false,
  }),

  // Category image upload
  category: fileUploadService.createUploader("categories", {
    maxFileSize: MAX_FILE_SIZE,
    allowMultiple: false,
  }),

  // User profile image upload
  user: fileUploadService.createUploader("users", {
    maxFileSize: Math.min(MAX_FILE_SIZE, 5 * 1024 * 1024), // Max 5MB for profile pictures
    allowMultiple: false,
  }),

  // Multiple images upload (for future use)
  productGallery: fileUploadService.createUploader("products", {
    allowMultiple: true,
    maxFiles: 5,
    maxFileSize: MAX_FILE_SIZE,
  }),

  // General purpose uploader
  general: fileUploadService.createUploader("temp", {
    maxFileSize: MAX_FILE_SIZE,
    allowMultiple: false,
  }),
};

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message;

    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        message = `File too large. Maximum size is ${(
          MAX_FILE_SIZE /
          (1024 * 1024)
        ).toFixed(1)}MB`;
        break;
      case "LIMIT_FILE_COUNT":
        message = "Too many files uploaded";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message =
          'Unexpected file field. Use "image" field name for single uploads or "images" for multiple.';
        break;
      case "LIMIT_PART_COUNT":
        message = "Too many parts in multipart form";
        break;
      case "LIMIT_FIELD_KEY":
        message = "Field name too long";
        break;
      case "LIMIT_FIELD_VALUE":
        message = "Field value too long";
        break;
      case "LIMIT_FIELD_COUNT":
        message = "Too many fields in form";
        break;
      default:
        message = `Upload error: ${error.message}`;
    }

    return res.status(400).json({
      status: false,
      message,
      error_code: error.code,
    });
  }

  // Handle custom validation errors
  if (
    error.message.includes("Invalid file type") ||
    error.message.includes("Invalid file extension") ||
    error.message.includes("File too large")
  ) {
    return res.status(400).json({
      status: false,
      message: error.message,
    });
  }

  // Handle other errors
  if (error.message.includes("upload")) {
    return res.status(400).json({
      status: false,
      message: `Upload failed: ${error.message}`,
    });
  }

  next(error);
};

// Middleware to validate uploaded file after multer processing
const validateUploadedFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(); // No file uploaded, continue
    }

    // Validate file by content (magic numbers)
    const validation = await FileUploadService.validateFileByContent(
      req.file.path
    );

    if (!validation.valid) {
      // Delete invalid file
      await FileUploadService.deleteFile(req.file.path);

      return res.status(400).json({
        status: false,
        message: "Invalid file format. The uploaded file is not a valid image.",
      });
    }

    // Add validation info to request
    req.fileValidation = validation;
    next();
  } catch (error) {
    // Clean up file on error
    if (req.file) {
      await FileUploadService.deleteFile(req.file.path);
    }

    return res.status(500).json({
      status: false,
      message: "File validation failed",
    });
  }
};

// Cleanup middleware to run temp file cleanup periodically
const setupFileCleanup = () => {
  // Run cleanup every 6 hours
  setInterval(() => {
    FileUploadService.cleanupTempFiles(24).catch(console.error);
  }, 6 * 60 * 60 * 1000);

  // Run cleanup on startup
  setTimeout(() => {
    FileUploadService.cleanupTempFiles(24).catch(console.error);
  }, 10000); // Wait 10 seconds after startup
};

// Helper function to create upload endpoint with consistent error handling
const createUploadEndpoint = (uploadMiddleware, validationSchema = null) => {
  return [
    uploadMiddleware,
    handleMulterError,
    validateUploadedFile,
    ...(validationSchema
      ? [require("../middleware/validateRequest")(validationSchema)]
      : []),
  ];
};

// Export everything
module.exports = {
  FileUploadService,
  uploadMiddlewares,
  handleMulterError,
  validateUploadedFile,
  setupFileCleanup,
  createUploadEndpoint,
  fileUploadService,
};
