const ProductModel = require("../products/model");
const CategoryModel = require("../categories/model");
const {
  ValidationError,
  BusinessLogicError,
} = require("../../../middleware/errorHandler");

class BulkController {
  /**
   * Bulk update product categories (supports both ID and code)
   */
  static async bulkUpdateCategories(req, res) {
    try {
      const { updates } = req.body; // [{ product_id: 1, category_id: 2 }, ...]

      if (!Array.isArray(updates) || updates.length === 0) {
        throw new ValidationError("Updates array is required");
      }

      if (updates.length > 100) {
        throw new BusinessLogicError(
          "Cannot update more than 100 products at once"
        );
      }

      const results = {
        updated: [],
        failed: [],
        not_found: [],
      };

      for (const update of updates) {
        try {
          let { product_id, category_id, product_code, category_code } = update;

          // Find product by ID or code
          let product;
          if (product_id) {
            product = await ProductModel.findById(product_id);
          } else if (product_code) {
            product = await ProductModel.findByCode(product_code);
            product_id = product?.id;
          } else {
            throw new Error("Either product_id or product_code is required");
          }

          if (!product) {
            results.not_found.push(product_id || product_code);
            continue;
          }

          // Find category by ID or code
          let category;
          if (category_id) {
            category = await CategoryModel.findById(category_id);
          } else if (category_code) {
            category = await CategoryModel.findByCode(category_code);
            category_id = category?.id;
          }

          // Validate category exists if provided
          if ((category_id || category_code) && !category) {
            results.failed.push({
              product_id: product_id || product_code,
              reason: "Invalid category ID or code",
            });
            continue;
          }

          // Update product
          await ProductModel.updateProduct(product_id, { category_id });
          results.updated.push({
            product_id: product_id,
            product_code: product.code,
            new_category_id: category_id,
            new_category_code: category?.code,
          });
        } catch (error) {
          results.failed.push({
            product_id: update.product_id || update.product_code,
            reason: error.message,
          });
        }
      }

      res.json({
        status: true,
        message: "Bulk category update completed",
        data: results,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk update product prices (supports both ID and code)
   */
  static async bulkUpdatePrices(req, res) {
    try {
      const { updates, operation = "set" } = req.body;
      // operation: 'set', 'increase', 'decrease', 'percentage'
      // updates: [{ product_id: 1, value: 99.99 }, ...]

      if (!Array.isArray(updates) || updates.length === 0) {
        throw new ValidationError("Updates array is required");
      }

      const results = {
        updated: [],
        failed: [],
        not_found: [],
      };

      for (const update of updates) {
        try {
          let { product_id, product_code, value } = update;

          // Find product by ID or code
          let product;
          if (product_id) {
            product = await ProductModel.findById(product_id);
          } else if (product_code) {
            product = await ProductModel.findByCode(product_code);
            product_id = product?.id;
          } else {
            throw new Error("Either product_id or product_code is required");
          }

          if (!product) {
            results.not_found.push(product_id || product_code);
            continue;
          }

          let newPrice;
          const currentPrice = parseFloat(product.price);

          switch (operation) {
            case "set":
              newPrice = parseFloat(value);
              break;
            case "increase":
              newPrice = currentPrice + parseFloat(value);
              break;
            case "decrease":
              newPrice = Math.max(0, currentPrice - parseFloat(value));
              break;
            case "percentage":
              newPrice = currentPrice * (1 + parseFloat(value) / 100);
              break;
            default:
              throw new Error("Invalid operation");
          }

          await ProductModel.updateProduct(product_id, { price: newPrice });
          results.updated.push({
            product_id: product_id,
            product_code: product.code,
            full_code: product.full_code,
            old_price: currentPrice,
            new_price: newPrice,
          });
        } catch (error) {
          results.failed.push({
            product_id: update.product_id || update.product_code,
            reason: error.message,
          });
        }
      }

      res.json({
        status: true,
        message: "Bulk price update completed",
        data: results,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk update product status (supports both ID and code)
   */
  static async bulkUpdateStatus(req, res) {
    try {
      const { product_ids, product_codes, is_active } = req.body;

      if (!product_ids && !product_codes) {
        throw new ValidationError(
          "Either product_ids or product_codes array is required"
        );
      }

      if (typeof is_active !== "boolean") {
        throw new ValidationError("is_active must be boolean");
      }

      const results = {
        updated: [],
        failed: [],
        not_found: [],
      };

      // Process product IDs
      if (product_ids && Array.isArray(product_ids)) {
        for (const productId of product_ids) {
          try {
            const product = await ProductModel.findById(productId);
            if (!product) {
              results.not_found.push(productId);
              continue;
            }

            await ProductModel.updateProduct(productId, { is_active });
            results.updated.push({
              product_id: productId,
              product_code: product.code,
              full_code: product.full_code,
            });
          } catch (error) {
            results.failed.push({
              product_id: productId,
              reason: error.message,
            });
          }
        }
      }

      // Process product codes
      if (product_codes && Array.isArray(product_codes)) {
        for (const productCode of product_codes) {
          try {
            const product = await ProductModel.findByCode(productCode);
            if (!product) {
              results.not_found.push(productCode);
              continue;
            }

            await ProductModel.updateProduct(product.id, { is_active });
            results.updated.push({
              product_id: product.id,
              product_code: product.code,
              full_code: product.full_code,
            });
          } catch (error) {
            results.failed.push({
              product_code: productCode,
              reason: error.message,
            });
          }
        }
      }

      res.json({
        status: true,
        message: `Products ${
          is_active ? "activated" : "deactivated"
        } successfully`,
        data: results,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk update product codes
   */
  static async bulkUpdateCodes(req, res) {
    try {
      const { updates } = req.body; // [{ product_id: 1, new_code: "ABC123" }, ...]

      if (!Array.isArray(updates) || updates.length === 0) {
        throw new ValidationError("Updates array is required");
      }

      if (updates.length > 100) {
        throw new BusinessLogicError(
          "Cannot update more than 100 products at once"
        );
      }

      const results = {
        updated: [],
        failed: [],
        not_found: [],
      };

      for (const update of updates) {
        try {
          let { product_id, product_code, new_code } = update;

          if (!new_code) {
            throw new Error("new_code is required");
          }

          // Validate new code format
          if (!/^[A-Z0-9]+$/.test(new_code)) {
            throw new Error(
              "Code must contain only uppercase letters and numbers"
            );
          }

          // Find product by ID or current code
          let product;
          if (product_id) {
            product = await ProductModel.findById(product_id);
          } else if (product_code) {
            product = await ProductModel.findByCode(product_code);
            product_id = product?.id;
          } else {
            throw new Error("Either product_id or product_code is required");
          }

          if (!product) {
            results.not_found.push(product_id || product_code);
            continue;
          }

          const oldCode = product.code;
          const oldFullCode = product.full_code;

          // Update product code
          await ProductModel.updateProduct(product_id, { code: new_code });

          // Get updated product to show new full code
          const updatedProduct = await ProductModel.findById(product_id);

          results.updated.push({
            product_id: product_id,
            old_code: oldCode,
            new_code: new_code,
            old_full_code: oldFullCode,
            new_full_code: updatedProduct.full_code,
          });
        } catch (error) {
          results.failed.push({
            product_id: update.product_id || update.product_code,
            reason: error.message,
          });
        }
      }

      res.json({
        status: true,
        message: "Bulk code update completed",
        data: results,
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = { BulkController };
