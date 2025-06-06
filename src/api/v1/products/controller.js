const ProductModel = require("./model");
const CategoryModel = require("../categories/model");
const {
  NotFoundError,
  ValidationError,
  ConflictError,
} = require("../../../middleware/errorHandler");
const { FileUploadService } = require("../../../middleware/multer");

class ProductController {
  /**
   * Get all products (for activated users)
   */
  static async getAllProducts(req, res) {
    try {
      const { page, limit, category_id, min_price, max_price, search } =
        req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        categoryId: category_id,
        minPrice: min_price ? parseFloat(min_price) : undefined,
        maxPrice: max_price ? parseFloat(max_price) : undefined,
        search,
        isActive: true, // Only show active products to users
      };

      const result = await ProductModel.getAllProducts(options);

      // Convert file paths to URLs
      result.products = result.products.map((product) => ({
        ...product,
        image_url: product.image_url
          ? FileUploadService.getFileUrl(req, product.image_url)
          : null,
        image_urls: getProductImageUrls(req, product),
        total_images: getExistingImageUrls(product).length,
      }));

      res.json({
        status: true,
        message: "Products retrieved successfully",
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get featured products
   */
  static async getFeaturedProducts(req, res) {
    try {
      const { limit } = req.query;
      const limitNum = parseInt(limit) || 10;

      const result = await ProductModel.getFeaturedProducts(limitNum);

      // Convert file paths to URLs
      result.products = result.products.map((product) => ({
        ...product,
        image_url: product.image_url
          ? FileUploadService.getFileUrl(req, product.image_url)
          : null,
      }));

      res.json({
        status: true,
        message: "Featured products retrieved successfully",
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search products
   */
  static async searchProducts(req, res) {
    try {
      const { q: searchTerm, sort_by, sort_order, limit } = req.query;

      if (!searchTerm || searchTerm.trim().length < 2) {
        throw new ValidationError(
          "Search term must be at least 2 characters long"
        );
      }

      const options = {
        limit: parseInt(limit) || 20,
        isActive: true,
        sortBy: sort_by,
        sortOrder: sort_order,
      };

      const result = await ProductModel.searchProducts(
        searchTerm.trim(),
        options
      );

      // Convert file paths to URLs
      result.products = result.products.map((product) => ({
        ...product,
        image_url: product.image_url
          ? FileUploadService.getFileUrl(req, product.image_url)
          : null,
      }));

      res.json({
        status: true,
        message: "Product search completed successfully",
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get products by category ID or slug
   */
  static async getProductsByCategory(req, res) {
    try {
      const { identifier } = req.params;
      const { page, limit, sort_by, sort_order } = req.query;

      // Check if identifier is numeric (ID) or string (slug)
      const isNumeric = /^\d+$/.test(identifier);

      let category;
      if (isNumeric) {
        category = await CategoryModel.findById(identifier);
      } else {
        category = await CategoryModel.findBySlug(identifier);
      }

      if (!category) {
        throw new NotFoundError("Category not found");
      }

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        categoryId: category.id,
        isActive: true,
        sortBy: sort_by,
        sortOrder: sort_order,
      };

      const result = await ProductModel.getAllProducts(options);

      // Convert file paths to URLs
      result.products = result.products.map((product) => ({
        ...product,
        image_url: product.image_url
          ? FileUploadService.getFileUrl(req, product.image_url)
          : null,
      }));

      res.json({
        status: true,
        message: `Products in category '${category.name}' retrieved successfully`,
        data: {
          ...result,
          category: {
            id: category.id,
            name: category.name,
            code: category.code,
            slug: category.slug,
            image_url: category.image_url
              ? FileUploadService.getFileUrl(req, category.image_url)
              : null,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  static async getProductById(req, res) {
    try {
      const { product_id } = req.params;

      let product = null;

      // Check if it's numeric (ID)
      if (/^\d+$/.test(product_id)) {
        product = await ProductModel.findById(product_id);
      }
      // Check if it might be a full code (category_code + product_code)
      else if (/^[A-Z0-9]+$/.test(product_id)) {
        product = await ProductModel.findByFullCode(product_id);
        // If not found by full code, try by product code only
        if (!product) {
          product = await ProductModel.findByCode(product_id);
        }
      }
      // Otherwise treat as slug
      else {
        product = await ProductModel.findBySlug(product_id);
      }

      if (!product) {
        throw new NotFoundError("Product not found");
      }

      // Don't show inactive products to regular users
      if (!product.is_active && req.user?.role !== "admin") {
        throw new NotFoundError("Product not found");
      }

      // Convert file paths to URLs and handle multiple images
      const imageUrls = getProductImageUrls(req, product);
      product.image_url = imageUrls[0] || null;
      product.image_urls = imageUrls;
      product.total_images = imageUrls.length;

      res.json({
        status: true,
        message: "Product retrieved successfully",
        data: { product },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get product by full code (category_code + product_code)
   */
  static async getProductByFullCode(req, res) {
    try {
      const { full_code } = req.params;

      const product = await ProductModel.findByFullCode(full_code);

      if (!product) {
        throw new NotFoundError("Product not found");
      }

      // Don't show inactive products to regular users
      if (!product.is_active && req.user?.role !== "admin") {
        throw new NotFoundError("Product not found");
      }

      // Convert file path to URL
      product.image_url = product.image_url
        ? FileUploadService.getFileUrl(req, product.image_url)
        : null;

      res.json({
        status: true,
        message: "Product retrieved successfully",
        data: { product },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update product stock (Admin only)
   */
  static async updateProductStock(req, res) {
    try {
      const { product_id } = req.params;
      const { stock_quantity } = req.body;

      if (typeof stock_quantity !== "number" || stock_quantity < 0) {
        throw new ValidationError(
          "Stock quantity must be a non-negative number"
        );
      }

      const existingProduct = await ProductModel.findById(product_id);
      if (!existingProduct) {
        throw new NotFoundError("Product not found");
      }

      const updatedProduct = await ProductModel.updateProduct(product_id, {
        stock_quantity,
      });

      // Convert file path to URL
      updatedProduct.image_url = updatedProduct.image_url
        ? FileUploadService.getFileUrl(req, updatedProduct.image_url)
        : null;

      res.json({
        status: true,
        message: "Product stock updated successfully",
        data: {
          product: updatedProduct,
          old_stock: existingProduct.stock_quantity,
          new_stock: stock_quantity,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all categories
   */
  static async getCategories(req, res) {
    try {
      const categories = await ProductModel.getCategories();

      // Convert file paths to URLs
      const categoriesWithUrls = categories.map((category) => ({
        ...category,
        image_url: category.image_url
          ? FileUploadService.getFileUrl(req, category.image_url)
          : null,
      }));

      res.json({
        status: true,
        message: "Categories retrieved successfully",
        data: { categories: categoriesWithUrls },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create new product with enhanced error handling (Admin only)
   */
  static async createProduct(req, res) {
    try {
      const productData = {
        ...req.body,
        is_active: true,
        is_featured: JSON.parse(req.body.is_featured || "false"),
      };

      // Handle multiple uploaded images
      let imageUrls = [];
      let uploadedFiles = [];

      if (req.files && req.files.length > 0) {
        uploadedFiles = req.files;
        imageUrls = req.files.map((file) => file.path);
      } else if (req.file) {
        // Handle single file upload (backward compatibility)
        uploadedFiles = [req.file];
        imageUrls = [req.file.path];
      }

      // Set image fields with enhanced error handling
      if (imageUrls.length > 0) {
        productData.image_url = imageUrls[0]; // Primary image (backward compatibility)

        // Safely handle image_urls JSON
        const sanitizedImageUrls = sanitizeImageUrls(imageUrls);
        productData.image_urls = sanitizedImageUrls;

        console.log("Storing image URLs:", {
          primary: productData.image_url,
          count: imageUrls.length,
          jsonLength: sanitizedImageUrls ? sanitizedImageUrls.length : 0,
        });
      }

      // Validate category exists if category_id is provided
      if (productData.category_id) {
        const category = await CategoryModel.findById(productData.category_id);
        if (!category) {
          // Delete uploaded files if validation fails
          await Promise.all(
            uploadedFiles.map((file) => FileUploadService.deleteFile(file.path))
          );
          throw new ValidationError("Invalid category ID");
        }
      }

      let product;
      try {
        product = await ProductModel.createProduct(productData);
      } catch (error) {
        // Handle specific JSON/index errors
        if (
          error.message.includes("idx_products_image_urls") ||
          error.message.includes("Data truncated for functional index")
        ) {
          console.warn("JSON index error, retrying without image_urls field");

          // Retry without the image_urls JSON field
          delete productData.image_urls;
          product = await ProductModel.createProduct(productData);

          // Try to update the image_urls separately
          if (imageUrls.length > 1) {
            try {
              await ProductModel.updateProduct(product.id, {
                image_urls: sanitizeImageUrls(imageUrls),
              });
              product = await ProductModel.findById(product.id);
            } catch (updateError) {
              console.error(
                "Failed to update image_urls separately:",
                updateError
              );
              // Continue without multiple images support
            }
          }
        } else {
          throw error;
        }
      }

      // Convert file paths to URLs for response
      const responseImageUrls = imageUrls.map((imagePath) =>
        FileUploadService.getFileUrl(req, imagePath)
      );

      // Add image URLs to response
      product.image_url = responseImageUrls[0] || null; // Primary image
      product.image_urls = responseImageUrls; // All images array
      product.total_images = responseImageUrls.length;

      res.status(201).json({
        status: true,
        message: `Product created successfully${
          imageUrls.length > 1 ? ` with ${imageUrls.length} images` : ""
        }`,
        data: { product },
      });
    } catch (error) {
      // Delete uploaded files if error occurs
      if (req.files && req.files.length > 0) {
        await Promise.all(
          req.files.map((file) => FileUploadService.deleteFile(file.path))
        );
      } else if (req.file) {
        await FileUploadService.deleteFile(req.file.path);
      }
      throw error;
    }
  }

  /**
   * MAIN UPDATE FUNCTION - Fixed for Frontend Integration
   */
  static async updateProduct(req, res) {
    try {
      const { product_id } = req.params;

      const existingProduct = await ProductModel.findById(product_id);
      if (!existingProduct) {
        const uploadedFiles = req.files || [req.file].filter(Boolean);
        if (uploadedFiles.length > 0) {
          await Promise.all(
            uploadedFiles.map((file) => FileUploadService.deleteFile(file.path))
          );
        }
        throw new NotFoundError("Product not found");
      }

      const { existing_images, ...bodyWithoutImageFields } = req.body;

      const updateData = {
        ...bodyWithoutImageFields,
        is_active: JSON.parse(req.body.is_active),
        is_featured: JSON.parse(req.body.is_featured),
      };

      // Get current state
      const currentImageUrls = getExistingImageUrls(existingProduct);
      const newUploadedFiles = getNewUploadPaths(req);

      console.log("=== FRONTEND-BACKEND IMAGE SYNC ===");
      console.log("Current images in DB:", currentImageUrls);
      console.log("New uploaded files:", newUploadedFiles);
      console.log("existing_images from frontend:", req.body.existing_images);

      // Detect intentions using frontend-aware logic
      const intentions = detectFrontendImageIntentions(req, currentImageUrls);
      console.log("Detection result:", intentions);

      const imagesToKeep = intentions.keepExistingImages;
      const imagesToRemove = intentions.imagesToRemove;

      console.log("Final decision:");
      console.log("  - Keep existing:", imagesToKeep);
      console.log("  - Remove existing:", imagesToRemove);
      console.log("  - Add new:", newUploadedFiles);
      console.log("  - Strategy:", intentions.strategy);

      // Build final image list: kept existing + new uploads
      const finalImageUrls = [...imagesToKeep, ...newUploadedFiles];

      // Only update image fields if there are actual changes
      if (imagesToRemove.length > 0 || newUploadedFiles.length > 0) {
        updateData.image_url = finalImageUrls[0] || null;
        updateData.image_urls = sanitizeImageUrls(finalImageUrls);

        // Delete removed images (only local files)
        if (imagesToRemove.length > 0) {
          console.log("Deleting removed images:", imagesToRemove);
          await Promise.all(
            imagesToRemove
              .filter((url) => url && !url.startsWith("http"))
              .map((url) => FileUploadService.deleteFile(url))
          );
        }
      }

      // Validate category if being updated
      if (updateData.category_id) {
        const category = await CategoryModel.findById(updateData.category_id);
        if (!category) {
          const uploadedFiles = req.files || [req.file].filter(Boolean);
          await Promise.all(
            uploadedFiles.map((file) => FileUploadService.deleteFile(file.path))
          );
          throw new ValidationError("Invalid category ID");
        }
      }

      // Update the product
      let updatedProduct;
      try {
        updatedProduct = await ProductModel.updateProduct(
          product_id,
          updateData
        );
      } catch (error) {
        if (
          error.message.includes("idx_products_image_urls") ||
          error.message.includes("Data truncated for functional index")
        ) {
          console.warn("JSON index error, retrying without image_urls field");

          const fallbackUpdateData = { ...updateData };
          const imageUrls = fallbackUpdateData.image_urls;
          delete fallbackUpdateData.image_urls;

          updatedProduct = await ProductModel.updateProduct(
            product_id,
            fallbackUpdateData
          );

          if (imageUrls) {
            try {
              await ProductModel.updateImageUrls(product_id, imageUrls);
              updatedProduct = await ProductModel.findById(product_id);
            } catch (updateError) {
              console.error(
                "Failed to update image_urls separately:",
                updateError
              );
            }
          }
        } else {
          throw error;
        }
      }

      // Prepare response
      const responseImageUrls = getProductImageUrls(req, updatedProduct);
      updatedProduct.image_urls = responseImageUrls;
      updatedProduct.total_images = responseImageUrls.length;
      updatedProduct.image_url = responseImageUrls[0] || null;

      // Create status message
      let statusParts = [];
      if (newUploadedFiles.length > 0)
        statusParts.push(`${newUploadedFiles.length} added`);
      if (imagesToRemove.length > 0)
        statusParts.push(`${imagesToRemove.length} removed`);
      if (imagesToKeep.length > 0)
        statusParts.push(`${imagesToKeep.length} kept`);

      const imageStatus =
        statusParts.length > 0 ? ` (images: ${statusParts.join(", ")})` : "";
      const message = `Product updated successfully${imageStatus}`;

      res.json({
        status: true,
        message,
        data: {
          product: updatedProduct,
          image_analysis: {
            detection_mode: intentions.mode,
            strategy_used: intentions.strategy,
            confidence: intentions.confidence,
            changes: {
              added: newUploadedFiles.length,
              removed: imagesToRemove.length,
              kept: imagesToKeep.length,
              total_final: finalImageUrls.length,
            },
          },
        },
      });
    } catch (error) {
      const uploadedFiles = req.files || [req.file].filter(Boolean);
      if (uploadedFiles.length > 0) {
        await Promise.all(
          uploadedFiles.map((file) => FileUploadService.deleteFile(file.path))
        );
      }
      throw error;
    }
  }

  static async deleteProduct(req, res) {
    try {
      const { product_id } = req.params;

      const existingProduct = await ProductModel.findById(product_id);
      if (!existingProduct) {
        throw new NotFoundError("Product not found");
      }

      // Delete associated image file if it exists and is a local file
      if (
        existingProduct.image_url &&
        !existingProduct.image_url.startsWith("http")
      ) {
        await FileUploadService.deleteFile(existingProduct.image_url);
      }

      const deleted = await ProductModel.deleteProduct(product_id);
      if (!deleted) {
        throw new Error("Failed to delete product");
      }

      res.json({
        status: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update existing methods to handle multiple images
   */
  static async getAllProductsAdmin(req, res) {
    try {
      const { page, limit, category_id, min_price, max_price, search } =
        req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        categoryId: category_id,
        minPrice: min_price ? parseFloat(min_price) : undefined,
        maxPrice: max_price ? parseFloat(max_price) : undefined,
        search,
        isActive: true, // Only show active products to users
      };

      const result = await ProductModel.getAllProducts(options);

      // Convert file paths to URLs and handle multiple images
      result.products = result.products.map((product) => ({
        ...product,
        image_url: product.image_url
          ? FileUploadService.getFileUrl(req, product.image_url)
          : null,
        image_urls: getProductImageUrls(req, product),
        total_images: getExistingImageUrls(product).length,
      }));

      res.json({
        status: true,
        message: "Products retrieved successfully",
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get products by category code
   */
  static async getProductsByCategoryCode(req, res) {
    try {
      const { category_code } = req.params;
      const { page, limit, sort_by, sort_order } = req.query;

      const category = await CategoryModel.findByCode(category_code);
      if (!category) {
        throw new NotFoundError("Category not found");
      }

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        categoryId: category.id,
        isActive: true,
        sortBy: sort_by,
        sortOrder: sort_order,
      };

      const result = await ProductModel.getAllProducts(options);

      // Convert file paths to URLs
      result.products = result.products.map((product) => ({
        ...product,
        image_url: product.image_url
          ? FileUploadService.getFileUrl(req, product.image_url)
          : null,
      }));

      res.json({
        status: true,
        message: `Products in category '${category.name}' (${category.code}) retrieved successfully`,
        data: {
          ...result,
          category: {
            id: category.id,
            name: category.name,
            code: category.code,
            slug: category.slug,
            image_url: category.image_url
              ? FileUploadService.getFileUrl(req, category.image_url)
              : null,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Normalize image path for comparison - handles URL vs path differences
 */
function normalizeImagePath(imagePath) {
  if (!imagePath) return "";

  // If it's a full URL, extract the path part after domain
  if (imagePath.startsWith("http")) {
    try {
      const url = new URL(imagePath);
      // Extract path and remove leading /uploads/ if present
      return url.pathname.replace(/^\/uploads\//, "").replace(/^\//, "");
    } catch (e) {
      return imagePath;
    }
  }

  // If it's already a relative path, normalize it
  return imagePath.replace(/^\/+/, "").replace(/^uploads\//, "");
}

/**
 * Detect image intentions from frontend data
 */
function detectFrontendImageIntentions(req, currentImageUrls) {
  const newUploadedFiles = getNewUploadPaths(req);

  const intentions = {
    keepExistingImages: [],
    imagesToRemove: [],
    mode: "unknown",
    confidence: "high",
    strategy: "frontend_detection",
  };

  console.log("=== FRONTEND IMAGE DETECTION ===");
  console.log("New uploads:", newUploadedFiles.length);
  console.log("Request body keys:", Object.keys(req.body));

  // Check if frontend sent explicit list of existing images to keep
  if (req.body.existing_images) {
    try {
      const existingImagesToKeep = JSON.parse(req.body.existing_images);
      console.log(
        "Frontend sent existing_images to keep:",
        existingImagesToKeep
      );

      // Normalize paths for comparison
      intentions.keepExistingImages = currentImageUrls.filter((currentUrl) => {
        const normalizedCurrent = normalizeImagePath(currentUrl);
        return existingImagesToKeep.some((keepUrl) => {
          const normalizedKeep = normalizeImagePath(keepUrl);
          return normalizedCurrent === normalizedKeep;
        });
      });

      intentions.imagesToRemove = currentImageUrls.filter((currentUrl) => {
        const normalizedCurrent = normalizeImagePath(currentUrl);
        return !existingImagesToKeep.some((keepUrl) => {
          const normalizedKeep = normalizeImagePath(keepUrl);
          return normalizedCurrent === normalizedKeep;
        });
      });

      intentions.mode = "frontend_explicit_list";
      intentions.strategy = "frontend_existing_images_field";
    } catch (e) {
      console.warn("Could not parse existing_images field:", e);
      // Fallback to append mode
      intentions.keepExistingImages = [...currentImageUrls];
      intentions.imagesToRemove = [];
      intentions.mode = "frontend_append_fallback";
      intentions.strategy = "frontend_parse_error_fallback";
    }
  }
  // No explicit existing_images field
  else if (newUploadedFiles.length > 0) {
    // Frontend uploaded new images but didn't specify which existing ones to keep
    // Default to append mode (keep all existing + add new)
    intentions.keepExistingImages = [...currentImageUrls];
    intentions.imagesToRemove = [];
    intentions.mode = "frontend_append_mode";
    intentions.strategy = "frontend_no_explicit_list_append";

    console.log("No existing_images field found, defaulting to append mode");
  } else {
    // No new uploads, keep everything
    intentions.keepExistingImages = [...currentImageUrls];
    intentions.imagesToRemove = [];
    intentions.mode = "frontend_keep_all";
    intentions.strategy = "frontend_no_changes";
  }

  return intentions;
}

/**
 * Get paths of newly uploaded files
 */
function getNewUploadPaths(req) {
  let newUploads = [];
  if (req.files && req.files.length > 0) {
    newUploads = req.files.map((file) => file.path);
  } else if (req.file) {
    newUploads = [req.file.path];
  }
  return newUploads;
}

function sanitizeImageUrls(imageUrls) {
  try {
    if (!imageUrls || !Array.isArray(imageUrls)) {
      return null;
    }

    // Filter out any invalid URLs and limit length
    const validUrls = imageUrls
      .filter((url) => url && typeof url === "string" && url.length < 500)
      .slice(0, 10); // Limit to 10 images max

    if (validUrls.length === 0) {
      return null;
    }

    // Create a compact JSON string
    const jsonString = JSON.stringify(validUrls);

    // Check if JSON string is too long (MySQL has limits)
    if (jsonString.length > 65000) {
      // Conservative limit for TEXT fields
      console.warn("Image URLs JSON too long, truncating...");
      const truncatedUrls = validUrls.slice(
        0,
        Math.floor(validUrls.length / 2)
      );
      return JSON.stringify(truncatedUrls);
    }

    return jsonString;
  } catch (error) {
    console.error("Error sanitizing image URLs:", error);
    return null;
  }
}

function getExistingImageUrls(product) {
  const imageUrls = [];

  // Get from image_urls JSON field if it exists
  if (product.image_urls) {
    try {
      const parsed = JSON.parse(product.image_urls);
      if (Array.isArray(parsed)) {
        imageUrls.push(...parsed);
      }
    } catch (e) {
      console.warn("Failed to parse image_urls JSON:", e);
      // Fallback to single image_url if JSON parsing fails
      if (product.image_url) {
        imageUrls.push(product.image_url);
      }
    }
  } else if (product.image_url) {
    // Fallback to single image_url
    imageUrls.push(product.image_url);
  }

  return imageUrls;
}

function getProductImageUrls(req, product) {
  const imageUrls = getExistingImageUrls(product);
  return imageUrls.map((url) => FileUploadService.getFileUrl(req, url));
}

module.exports = {
  ProductController,
};
