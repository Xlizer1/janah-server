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

  /**
   * Update getProductById to handle multiple images
   */
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
   * Create new product with multiple image support (Admin only)
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

        // Store as JSON array for multiple images, or use first image for backward compatibility
        productData.image_url = imageUrls[0]; // Primary image (backward compatibility)
        productData.image_urls = JSON.stringify(imageUrls); // All images as JSON array
      } else if (req.file) {
        // Handle single file upload (backward compatibility)
        uploadedFiles = [req.file];
        imageUrls = [req.file.path];
        productData.image_url = req.file.path;
        productData.image_urls = JSON.stringify([req.file.path]);
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

      const product = await ProductModel.createProduct(productData);

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
   * Update product with multiple image support (Admin only)
   */
  static async updateProduct(req, res) {
    try {
      const { product_id } = req.params;

      const existingProduct = await ProductModel.findById(product_id);
      if (!existingProduct) {
        // Delete uploaded files if product doesn't exist
        if (req.files && req.files.length > 0) {
          await Promise.all(
            req.files.map((file) => FileUploadService.deleteFile(file.path))
          );
        } else if (req.file) {
          await FileUploadService.deleteFile(req.file.path);
        }
        throw new NotFoundError("Product not found");
      }

      const updateData = { ...req.body };
      let newImageUrls = [];
      let uploadedFiles = [];

      // Handle multiple uploaded images
      if (req.files && req.files.length > 0) {
        uploadedFiles = req.files;
        newImageUrls = req.files.map((file) => file.path);

        // Update image fields
        updateData.image_url = newImageUrls[0]; // Primary image
        updateData.image_urls = JSON.stringify(newImageUrls); // All images

        // Delete old image files if they exist and are local files
        const oldImageUrls = getExistingImageUrls(existingProduct);
        await Promise.all(
          oldImageUrls
            .filter((url) => url && !url.startsWith("http"))
            .map((url) => FileUploadService.deleteFile(url))
        );
      } else if (req.file) {
        // Handle single file upload (backward compatibility)
        uploadedFiles = [req.file];
        newImageUrls = [req.file.path];
        updateData.image_url = req.file.path;
        updateData.image_urls = JSON.stringify([req.file.path]);

        // Delete old images
        const oldImageUrls = getExistingImageUrls(existingProduct);
        await Promise.all(
          oldImageUrls
            .filter((url) => url && !url.startsWith("http"))
            .map((url) => FileUploadService.deleteFile(url))
        );
      }

      // Validate category exists if category_id is being updated
      if (updateData.category_id) {
        const category = await CategoryModel.findById(updateData.category_id);
        if (!category) {
          // Delete uploaded files if validation fails
          await Promise.all(
            uploadedFiles.map((file) => FileUploadService.deleteFile(file.path))
          );
          throw new ValidationError("Invalid category ID");
        }
      }

      const updatedProduct = await ProductModel.updateProduct(
        product_id,
        updateData
      );

      // Convert file paths to URLs for response
      const responseImageUrls = getProductImageUrls(req, updatedProduct);
      updatedProduct.image_urls = responseImageUrls;
      updatedProduct.total_images = responseImageUrls.length;
      updatedProduct.image_url = responseImageUrls[0] || null;

      res.json({
        status: true,
        message: `Product updated successfully${
          newImageUrls.length > 0 ? ` with ${newImageUrls.length} images` : ""
        }`,
        data: { product: updatedProduct },
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
