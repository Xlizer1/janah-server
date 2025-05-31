const Papa = require("papaparse");
const fs = require("fs").promises;

class DataImporter {
  /**
   * Import products from CSV
   */
  static async importProductsFromCSV(filePath, options = {}) {
    try {
      const csvContent = await fs.readFile(filePath, "utf8");
      const { dryRun = false, skipErrors = false } = options;

      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) =>
          header.trim().toLowerCase().replace(/\s+/g, "_"),
      });

      if (parsed.errors.length > 0) {
        throw new Error(
          `CSV parsing errors: ${parsed.errors
            .map((e) => e.message)
            .join(", ")}`
        );
      }

      const results = {
        total: parsed.data.length,
        successful: 0,
        failed: 0,
        errors: [],
      };

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];

        try {
          // Map CSV columns to product fields
          const productData = {
            name: row.name || row.product_name,
            description: row.description,
            price: parseFloat(row.price),
            stock_quantity: parseInt(row.stock_quantity) || 0,
            category_id: parseInt(row.category_id),
            sku: row.sku,
            weight: row.weight ? parseFloat(row.weight) : null,
            dimensions: row.dimensions,
            is_featured: row.is_featured === "true" || row.is_featured === "1",
            image_url: row.image_url,
          };

          // Validate required fields
          if (!productData.name) {
            throw new Error("Product name is required");
          }

          if (!productData.price || productData.price <= 0) {
            throw new Error("Valid price is required");
          }

          if (!dryRun) {
            await ProductModel.createProduct(productData);
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            data: row,
            error: error.message,
          });

          if (!skipErrors) {
            throw new Error(`Row ${i + 1}: ${error.message}`);
          }
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  /**
   * Export products to CSV
   */
  static async exportProductsToCSV(options = {}) {
    try {
      const { categoryId, isActive = true } = options;

      const productsResult = await ProductModel.getAllProducts({
        categoryId,
        isActive,
        limit: 10000, // Large limit to get all products
      });

      const csvData = productsResult.products.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        stock_quantity: product.stock_quantity,
        category_id: product.category_id,
        category_name: product.category_name,
        sku: product.sku,
        weight: product.weight,
        dimensions: product.dimensions,
        is_active: product.is_active,
        is_featured: product.is_featured,
        image_url: product.image_url,
        created_at: product.created_at,
      }));

      const csv = Papa.unparse(csvData);
      return csv;
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }
}

module.exports = { DataImporter };
