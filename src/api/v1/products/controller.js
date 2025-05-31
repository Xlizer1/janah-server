const { ProductModel } = require("./model");
const { NotFoundError } = require("../../../middleware/errorHandler");

export class ProductController {
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
   * Get product by ID
   */
  static async getProductById(req, res) {
    try {
      const { product_id } = req.params;

      const product = await ProductModel.findById(product_id);
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
