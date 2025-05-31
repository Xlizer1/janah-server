const ProductModel = require("./model");
const CategoryModel = require("../categories/model");
const {
  NotFoundError,
  ValidationError,
} = require("../../../middleware/errorHandler");

class ProductController {
  /**
   * Get all products (for activated users)
   */
  static async getAllProducts(req, res) {
    try {
      const { page, limit, category, min_price, max_price, search } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        category,
        minPrice: min_price ? parseFloat(min_price) : undefined,
        maxPrice: max_price ? parseFloat(max_price) : undefined,
        search,
        isActive: true, // Only show active products to users
      };

      const result = await ProductModel.getAllProducts(options);

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

      res.json({
        status: true,
        message: `Products in category '${category.name}' retrieved successfully`,
        data: {
          ...result,
          category: {
            id: category.id,
            name: category.name,
            slug: category.slug,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get product by ID or slug
   */
  static async getProductById(req, res) {
    try {
      const { product_id } = req.params;

      // Check if it's numeric (ID) or string (slug)
      const isNumeric = /^\d+$/.test(product_id);
      const product = isNumeric
        ? await ProductModel.findById(product_id)
        : await ProductModel.findBySlug(product_id);

      if (!product) {
        throw new NotFoundError("Product not found");
      }

      // Don't show inactive products to regular users
      if (!product.is_active && req.user?.role !== "admin") {
        throw new NotFoundError("Product not found");
      }

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

      res.json({
        status: true,
        message: "Categories retrieved successfully",
        data: { categories },
      });
    } catch (error) {
      throw error;
    }
  }

  // Admin-only methods
  static async createProduct(req, res) {
    try {
      const productData = {
        ...req.body,
        is_active: true,
      };

      const product = await ProductModel.createProduct(productData);

      res.status(201).json({
        status: true,
        message: "Product created successfully",
        data: { product },
      });
    } catch (error) {
      throw error;
    }
  }

  static async updateProduct(req, res) {
    try {
      const { product_id } = req.params;

      const existingProduct = await ProductModel.findById(product_id);
      if (!existingProduct) {
        throw new NotFoundError("Product not found");
      }

      const updatedProduct = await ProductModel.updateProduct(
        product_id,
        req.body
      );

      res.json({
        status: true,
        message: "Product updated successfully",
        data: { product: updatedProduct },
      });
    } catch (error) {
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

  static async getAllProductsAdmin(req, res) {
    try {
      const { page, limit, category, min_price, max_price, search, is_active } =
        req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        category,
        minPrice: min_price ? parseFloat(min_price) : undefined,
        maxPrice: max_price ? parseFloat(max_price) : undefined,
        search,
        isActive: is_active !== undefined ? is_active === "true" : undefined,
      };

      const result = await ProductModel.getAllProducts(options);

      res.json({
        status: true,
        message: "Products retrieved successfully",
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = {
  ProductController,
};
