const ProductModel = require("../products/model");
const CategoryModel = require("../categories/model");
const {
  ValidationError,
  BusinessLogicError,
} = require("../../../middleware/errorHandler");

class BulkController {
  /**
   * Bulk update product categories
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
          const { product_id, category_id } = update;

          // Validate product exists
          const product = await ProductModel.findById(product_id);
          if (!product) {
            results.not_found.push(product_id);
            continue;
          }

          // Validate category exists if provided
          if (category_id) {
            const category = await CategoryModel.findById(category_id);
            if (!category) {
              results.failed.push({
                product_id,
                reason: "Invalid category ID",
              });
              continue;
            }
          }

          // Update product
          await ProductModel.updateProduct(product_id, { category_id });
          results.updated.push(product_id);
        } catch (error) {
          results.failed.push({
            product_id: update.product_id,
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
   * Bulk update product prices
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
          const { product_id, value } = update;

          const product = await ProductModel.findById(product_id);
          if (!product) {
            results.not_found.push(product_id);
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
            product_id,
            old_price: currentPrice,
            new_price: newPrice,
          });
        } catch (error) {
          results.failed.push({
            product_id: update.product_id,
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
   * Bulk update product status (active/inactive)
   */
  static async bulkUpdateStatus(req, res) {
    try {
      const { product_ids, is_active } = req.body;

      if (!Array.isArray(product_ids) || product_ids.length === 0) {
        throw new ValidationError("Product IDs array is required");
      }

      if (typeof is_active !== "boolean") {
        throw new ValidationError("is_active must be boolean");
      }

      const results = {
        updated: [],
        failed: [],
        not_found: [],
      };

      for (const productId of product_ids) {
        try {
          const product = await ProductModel.findById(productId);
          if (!product) {
            results.not_found.push(productId);
            continue;
          }

          await ProductModel.updateProduct(productId, { is_active });
          results.updated.push(productId);
        } catch (error) {
          results.failed.push({
            product_id: productId,
            reason: error.message,
          });
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
}

module.exports = { BulkController };
