const {
  executeQuery,
  buildInsertQuery,
  buildUpdateQuery,
} = require("../../../helpers/db");
const { DatabaseError } = require("../../../errors/customErrors");

class ProductModel {
  /**
   * Safely update image URLs JSON field
   */
  static async updateImageUrls(productId, imageUrlsJson) {
    try {
      // Try to update using JSON functions if available
      const sql = `
        UPDATE products 
        SET image_urls = CASE 
          WHEN ? IS NULL THEN NULL
          WHEN JSON_VALID(?) THEN ?
          ELSE image_urls
        END
        WHERE id = ?
      `;

      await executeQuery(
        sql,
        [imageUrlsJson, imageUrlsJson, imageUrlsJson, productId],
        "Update Product Image URLs"
      );

      return true;
    } catch (error) {
      console.error("Failed to update image URLs with JSON validation:", error);

      // Fallback: direct update without JSON validation
      try {
        const sql = `UPDATE products SET image_urls = ? WHERE id = ?`;
        await executeQuery(
          sql,
          [imageUrlsJson, productId],
          "Update Product Image URLs - Fallback"
        );
        return true;
      } catch (fallbackError) {
        console.error(
          "Failed to update image URLs with fallback method:",
          fallbackError
        );
        return false;
      }
    }
  }

  /**
   * Create new product with enhanced JSON handling
   */
  static async createProduct(productData) {
    try {
      // Generate slug if not provided
      if (!productData.slug && productData.name) {
        productData.slug = this.generateSlug(productData.name);
      }

      // Validate product code uniqueness within the same category
      if (productData.code && productData.category_id) {
        const existingProduct = await this.findProductByCodeAndCategory(
          productData.code,
          productData.category_id
        );
        if (existingProduct) {
          throw new Error(
            `Product code '${productData.code}' already exists in this category`
          );
        }
      }

      // Validate JSON before insertion
      if (productData.image_urls) {
        try {
          JSON.parse(productData.image_urls);
        } catch (jsonError) {
          console.warn(
            "Invalid JSON for image_urls, removing field:",
            jsonError
          );
          delete productData.image_urls;
        }
      }

      const query = buildInsertQuery("products", productData);

      try {
        const result = await executeQuery(
          query.sql,
          query.params,
          "Create Product"
        );

        if (result.insertId) {
          return await this.findById(result.insertId);
        }
        throw new Error("Failed to create product");
      } catch (error) {
        // Handle specific JSON index errors
        if (
          error.message.includes("idx_products_image_urls") ||
          error.message.includes("functional index") ||
          error.code === "ER_WARN_DATA_TRUNCATED_FUNCTIONAL_INDEX"
        ) {
          console.warn("JSON index error, retrying without image_urls field");

          // Retry without the problematic field
          const fallbackData = { ...productData };
          const imageUrls = fallbackData.image_urls;
          delete fallbackData.image_urls;

          const fallbackQuery = buildInsertQuery("products", fallbackData);
          const fallbackResult = await executeQuery(
            fallbackQuery.sql,
            fallbackQuery.params,
            "Create Product - Fallback"
          );

          if (fallbackResult.insertId) {
            // Try to update the image_urls separately
            if (imageUrls) {
              await this.updateImageUrls(fallbackResult.insertId, imageUrls);
            }
            return await this.findById(fallbackResult.insertId);
          }
        }

        throw error;
      }
    } catch (error) {
      throw new DatabaseError(
        `Error creating product: ${error.message}`,
        error
      );
    }
  }

  /**
   * Update product with enhanced JSON handling
   */
  static async updateProduct(id, updateData) {
    try {
      // Generate slug if name is being updated and slug is not provided
      if (updateData.name && !updateData.slug) {
        updateData.slug = this.generateSlug(updateData.name);
      }

      // Validate product code uniqueness within the same category if code or category is being updated
      if (updateData.code || updateData.category_id) {
        const currentProduct = await this.findById(id);
        if (!currentProduct) {
          throw new Error("Product not found");
        }

        const checkCode = updateData.code || currentProduct.code;
        const checkCategoryId =
          updateData.category_id || currentProduct.category_id;

        if (checkCode && checkCategoryId) {
          const existingProduct = await this.findProductByCodeAndCategory(
            checkCode,
            checkCategoryId
          );
          if (existingProduct && existingProduct.id !== parseInt(id)) {
            throw new Error(
              `Product code '${checkCode}' already exists in this category`
            );
          }
        }
      }

      // Validate JSON before update
      if (updateData.image_urls) {
        try {
          JSON.parse(updateData.image_urls);
        } catch (jsonError) {
          console.warn(
            "Invalid JSON for image_urls, removing field:",
            jsonError
          );
          delete updateData.image_urls;
        }
      }

      const query = buildUpdateQuery("products", updateData, { id });

      try {
        await executeQuery(query.sql, query.params, "Update Product");
        return await this.findById(id);
      } catch (error) {
        // Handle specific JSON index errors
        if (
          error.message.includes("idx_products_image_urls") ||
          error.message.includes("functional index") ||
          error.code === "ER_WARN_DATA_TRUNCATED_FUNCTIONAL_INDEX"
        ) {
          console.warn(
            "JSON index error during update, retrying without image_urls field"
          );

          // Retry without the problematic field
          const fallbackData = { ...updateData };
          const imageUrls = fallbackData.image_urls;
          delete fallbackData.image_urls;

          const fallbackQuery = buildUpdateQuery("products", fallbackData, {
            id,
          });
          await executeQuery(
            fallbackQuery.sql,
            fallbackQuery.params,
            "Update Product - Fallback"
          );

          // Try to update the image_urls separately
          if (imageUrls) {
            await this.updateImageUrls(id, imageUrls);
          }

          return await this.findById(id);
        }

        throw error;
      }
    } catch (error) {
      throw new DatabaseError(
        `Error updating product: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get all products with pagination and filters (enhanced with safer JSON handling)
   */
  static async getAllProducts(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        categoryId,
        isActive = true,
        minPrice,
        maxPrice,
        search,
        isFeatured,
        sortBy = "created_at",
        sortOrder = "DESC",
      } = options;

      const offset = (page - 1) * limit;
      let whereConditions = [];
      let params = [];

      // Only show active products to regular users
      if (isActive !== undefined) {
        whereConditions.push("p.is_active = ?");
        params.push(isActive);
      }

      if (categoryId) {
        whereConditions.push("p.category_id = ?");
        params.push(categoryId);
      }

      if (minPrice) {
        whereConditions.push("p.price >= ?");
        params.push(minPrice);
      }

      if (maxPrice) {
        whereConditions.push("p.price <= ?");
        params.push(maxPrice);
      }

      if (search) {
        whereConditions.push(
          "(p.name LIKE ? OR p.description LIKE ? OR p.code LIKE ? OR CONCAT(COALESCE(c.code, ''), p.code) LIKE ?)"
        );
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (isFeatured !== undefined) {
        whereConditions.push("p.is_featured = ?");
        params.push(isFeatured);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Validate and build ORDER BY clause
      const validSortFields = [
        "name",
        "price",
        "created_at",
        "stock_quantity",
        "id",
        "code",
        "full_code",
      ];
      const validSortOrders = ["ASC", "DESC"];

      const safeSortBy = validSortFields.includes(sortBy)
        ? sortBy
        : "created_at";
      const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

      // Handle full_code sorting
      let orderByClause;
      if (safeSortBy === "full_code") {
        orderByClause = `ORDER BY CONCAT(COALESCE(c.code, ''), p.code) ${safeSortOrder}`;
      } else {
        orderByClause = `ORDER BY p.${safeSortBy} ${safeSortOrder}`;
      }

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`;
      const countResult = await executeQuery(
        countSql,
        params,
        "Count Products"
      );
      const total = countResult[0].total;

      // Get products with category information and full code
      // Use COALESCE to handle NULL image_urls safely
      const sql = `
        SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
               p.stock_quantity, p.category_id, p.weight, 
               p.dimensions, p.is_active, p.is_featured, p.image_url, 
               COALESCE(p.image_urls, '[]') as image_urls,
               p.created_at, p.updated_at,
               c.name as category_name, c.code as category_code, c.slug as category_slug,
               CONCAT(COALESCE(c.code, ''), p.code) as full_code
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ${orderByClause}
        LIMIT ? OFFSET ?
      `;

      const products = await executeQuery(
        sql,
        [...params, limit, offset],
        "Get All Products"
      );

      // Safely parse image_urls JSON for each product
      const processedProducts = products.map((product) => {
        try {
          // Ensure image_urls is valid JSON
          if (product.image_urls && product.image_urls !== "[]") {
            JSON.parse(product.image_urls);
          }
        } catch (jsonError) {
          console.warn(
            `Invalid JSON for product ${product.id}, setting to empty array`
          );
          product.image_urls = "[]";
        }
        return product;
      });

      return {
        products: processedProducts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new DatabaseError(
        `Error getting products: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get product by ID with safe JSON handling
   */
  static async findById(id) {
    try {
      const sql = `
        SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
               p.stock_quantity, p.category_id, p.weight, 
               p.dimensions, p.is_active, p.is_featured, p.image_url, 
               COALESCE(p.image_urls, '[]') as image_urls,
               p.created_at, p.updated_at,
               c.name as category_name, c.code as category_code, c.slug as category_slug,
               CONCAT(COALESCE(c.code, ''), p.code) as full_code
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `;
      const result = await executeQuery(sql, [id], "Find Product By ID");

      if (result.length > 0) {
        const product = result[0];

        // Safely handle image_urls JSON
        try {
          if (product.image_urls && product.image_urls !== "[]") {
            JSON.parse(product.image_urls);
          }
        } catch (jsonError) {
          console.warn(
            `Invalid JSON for product ${product.id}, setting to empty array`
          );
          product.image_urls = "[]";
        }

        return product;
      }

      return null;
    } catch (error) {
      throw new DatabaseError(`Error finding product: ${error.message}`, error);
    }
  }

  // ... (keep all other existing methods from the original model)
  // The key changes are in the JSON handling for image_urls

  /**
   * Get product by slug
   */
  static async findBySlug(slug) {
    try {
      const sql = `
        SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
               p.stock_quantity, p.category_id, p.weight, 
               p.dimensions, p.is_active, p.is_featured, p.image_url, 
               COALESCE(p.image_urls, '[]') as image_urls,
               p.created_at, p.updated_at,
               c.name as category_name, c.code as category_code, c.slug as category_slug,
               CONCAT(COALESCE(c.code, ''), p.code) as full_code
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.slug = ? AND p.is_active = true
      `;
      const result = await executeQuery(sql, [slug], "Find Product By Slug");
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(
        `Error finding product by slug: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get product by code
   */
  static async findByCode(code) {
    try {
      const sql = `
        SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
               p.stock_quantity, p.category_id, p.weight, 
               p.dimensions, p.is_active, p.is_featured, p.image_url, 
               COALESCE(p.image_urls, '[]') as image_urls,
               p.created_at, p.updated_at,
               c.name as category_name, c.code as category_code, c.slug as category_slug,
               CONCAT(COALESCE(c.code, ''), p.code) as full_code
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.code = ?
      `;
      const result = await executeQuery(sql, [code], "Find Product By Code");
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(
        `Error finding product by code: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get product by full code (category_code + product_code)
   */
  static async findByFullCode(fullCode) {
    try {
      const sql = `
        SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
               p.stock_quantity, p.category_id, p.weight, 
               p.dimensions, p.is_active, p.is_featured, p.image_url, 
               COALESCE(p.image_urls, '[]') as image_urls,
               p.created_at, p.updated_at,
               c.name as category_name, c.code as category_code, c.slug as category_slug,
               CONCAT(COALESCE(c.code, ''), p.code) as full_code
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE CONCAT(COALESCE(c.code, ''), p.code) = ? AND p.is_active = true
      `;
      const result = await executeQuery(
        sql,
        [fullCode],
        "Find Product By Full Code"
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(
        `Error finding product by full code: ${error.message}`,
        error
      );
    }
  }

  /**
   * Find product by code and category
   */
  static async findProductByCodeAndCategory(code, categoryId) {
    try {
      const sql = `
        SELECT id FROM products 
        WHERE code = ? AND category_id = ?
      `;
      const result = await executeQuery(
        sql,
        [code, categoryId],
        "Find Product By Code And Category"
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      throw new DatabaseError(
        `Error finding product by code and category: ${error.message}`,
        error
      );
    }
  }

  /**
   * Delete product (admin only)
   */
  static async deleteProduct(id) {
    try {
      const sql = "DELETE FROM products WHERE id = ?";
      const result = await executeQuery(sql, [id], "Delete Product");
      return result.affectedRows > 0;
    } catch (error) {
      throw new DatabaseError(
        `Error deleting product: ${error.message}`,
        error
      );
    }
  }

  /**
   * Generate URL-friendly slug from name
   */
  static generateSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Additional utility methods for image handling

  /**
   * Get featured products with safe JSON handling
   */
  static async getFeaturedProducts(limit = 10) {
    try {
      const sql = `
        SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
               p.stock_quantity, p.category_id, p.image_url, 
               COALESCE(p.image_urls, '[]') as image_urls,
               p.created_at, p.updated_at,
               c.name as category_name, c.code as category_code, c.slug as category_slug,
               CONCAT(COALESCE(c.code, ''), p.code) as full_code
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_featured = true AND p.is_active = true
        ORDER BY p.created_at DESC
        LIMIT ?
      `;
      const result = await executeQuery(sql, [limit], "Get Featured Products");
      return {
        products: result,
        total: result.length,
      };
    } catch (error) {
      throw new DatabaseError(
        `Error getting featured products: ${error.message}`,
        error
      );
    }
  }

  /**
   * Search products with safe JSON handling
   */
  static async searchProducts(searchTerm, options = {}) {
    try {
      const {
        limit = 20,
        isActive = true,
        sortBy = "name",
        sortOrder = "ASC",
        categoryId,
      } = options;

      let whereConditions = [
        "(p.name LIKE ? OR p.description LIKE ? OR p.code LIKE ? OR CONCAT(COALESCE(c.code, ''), p.code) LIKE ?)",
      ];
      let params = [
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
      ];

      if (isActive !== undefined) {
        whereConditions.push("p.is_active = ?");
        params.push(isActive);
      }

      if (categoryId) {
        whereConditions.push("p.category_id = ?");
        params.push(categoryId);
      }

      const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

      // Validate sort parameters
      const validSortFields = [
        "name",
        "price",
        "created_at",
        "relevance",
        "full_code",
      ];
      const validSortOrders = ["ASC", "DESC"];

      let safeSortBy = validSortFields.includes(sortBy) ? sortBy : "name";
      const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "ASC";

      // Handle relevance and full_code sorting
      let orderByClause;
      if (safeSortBy === "relevance") {
        orderByClause = `ORDER BY 
          CASE 
            WHEN p.name LIKE ? THEN 1
            WHEN p.name LIKE ? THEN 2
            WHEN p.description LIKE ? THEN 3
            WHEN CONCAT(COALESCE(c.code, ''), p.code) LIKE ? THEN 4
            ELSE 5
          END, p.name ASC`;
        params.push(
          `${searchTerm}`,
          `%${searchTerm}%`,
          `%${searchTerm}%`,
          `%${searchTerm}%`
        );
      } else if (safeSortBy === "full_code") {
        orderByClause = `ORDER BY CONCAT(COALESCE(c.code, ''), p.code) ${safeSortOrder}`;
      } else {
        orderByClause = `ORDER BY p.${safeSortBy} ${safeSortOrder}`;
      }

      const countSql = `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`;
      const countParams = params.slice(0, whereConditions.length === 3 ? 7 : 6);
      const countResult = await executeQuery(
        countSql,
        countParams,
        "Count Search Products"
      );
      const total = countResult[0].total;

      const sql = `
        SELECT p.id, p.name, p.code, p.slug, p.description, p.price, 
               p.stock_quantity, p.category_id, p.image_url, 
               COALESCE(p.image_urls, '[]') as image_urls,
               p.created_at, p.updated_at,
               c.name as category_name, c.code as category_code, c.slug as category_slug,
               CONCAT(COALESCE(c.code, ''), p.code) as full_code
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ${orderByClause}
        LIMIT ?
      `;

      const products = await executeQuery(
        sql,
        [...params, limit],
        "Search Products"
      );

      return {
        products,
        pagination: {
          total,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new DatabaseError(
        `Error searching products: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get all categories (for backward compatibility)
   */
  static async getCategories() {
    try {
      const sql = `
        SELECT c.id, c.name, c.code, c.slug
        FROM categories c
        WHERE c.is_active = true
        ORDER BY c.sort_order ASC, c.name ASC
      `;
      const result = await executeQuery(sql, [], "Get Categories");
      return result;
    } catch (error) {
      throw new DatabaseError(
        `Error getting categories: ${error.message}`,
        error
      );
    }
  }
}

module.exports = ProductModel;
