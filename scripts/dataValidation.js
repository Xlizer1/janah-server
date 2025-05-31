async function validateDataIntegrity() {
  const mysql = require("mysql2/promise");
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  let connection;

  try {
    connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    });

    console.log("🔍 Validating data integrity...\n");

    // Check for orphaned products (invalid category_id)
    const [orphanedProducts] = await connection.execute(`
            SELECT p.id, p.name, p.category_id
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.category_id IS NOT NULL AND c.id IS NULL
        `);

    if (orphanedProducts.length > 0) {
      console.log(
        `⚠️  Found ${orphanedProducts.length} orphaned products with invalid category_id`
      );
      orphanedProducts.forEach((p) => {
        console.log(
          `   Product ID ${p.id}: "${p.name}" has category_id ${p.category_id} which doesn't exist`
        );
      });
    } else {
      console.log("✅ No orphaned products found");
    }

    // Check for duplicate slugs
    const [duplicateSlugs] = await connection.execute(`
            SELECT slug, COUNT(*) as count
            FROM products
            WHERE slug IS NOT NULL
            GROUP BY slug
            HAVING COUNT(*) > 1
        `);

    if (duplicateSlugs.length > 0) {
      console.log(`⚠️  Found ${duplicateSlugs.length} duplicate product slugs`);
      duplicateSlugs.forEach((s) => {
        console.log(`   Slug "${s.slug}" appears ${s.count} times`);
      });
    } else {
      console.log("✅ No duplicate product slugs found");
    }

    // Check for products without prices
    const [productsWithoutPrices] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM products
            WHERE price IS NULL OR price <= 0
        `);

    if (productsWithoutPrices[0].count > 0) {
      console.log(
        `⚠️  Found ${productsWithoutPrices[0].count} products without valid prices`
      );
    } else {
      console.log("✅ All products have valid prices");
    }

    // Check for categories without products
    const [emptyCategories] = await connection.execute(`
            SELECT c.id, c.name
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
            WHERE c.is_active = true AND p.id IS NULL
        `);

    if (emptyCategories.length > 0) {
      console.log(
        `📋 Found ${emptyCategories.length} categories without active products`
      );
    } else {
      console.log("✅ All active categories have products");
    }

    console.log("\n✅ Data integrity validation completed");
  } catch (error) {
    console.error("❌ Validation failed:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

module.exports = {
  validateDataIntegrity,
};
