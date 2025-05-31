require("dotenv").config();
const mysql = require("mysql2/promise");

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

async function checkSchema() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: DB_HOST || "localhost",
      user: DB_USER || "root",
      password: DB_PASSWORD || "",
      database: DB_NAME,
    });

    console.log("🔍 Checking database schema...\n");

    // Check if products table exists and what columns it has
    console.log("📋 PRODUCTS TABLE STRUCTURE:");
    try {
      const [productColumns] = await connection.execute(
        `
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
                FROM information_schema.COLUMNS 
                WHERE table_schema = ? AND table_name = 'products'
                ORDER BY ORDINAL_POSITION
            `,
        [DB_NAME]
      );

      if (productColumns.length > 0) {
        console.log("✅ Products table exists with columns:");
        productColumns.forEach((col) => {
          console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
      } else {
        console.log("❌ Products table does not exist");
      }
    } catch (error) {
      console.log("❌ Error checking products table:", error.message);
    }

    console.log("\n📋 CATEGORIES TABLE STRUCTURE:");
    try {
      const [categoryColumns] = await connection.execute(
        `
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
                FROM information_schema.COLUMNS 
                WHERE table_schema = ? AND table_name = 'categories'
                ORDER BY ORDINAL_POSITION
            `,
        [DB_NAME]
      );

      if (categoryColumns.length > 0) {
        console.log("✅ Categories table exists with columns:");
        categoryColumns.forEach((col) => {
          console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
      } else {
        console.log("❌ Categories table does not exist");
      }
    } catch (error) {
      console.log("❌ Error checking categories table:", error.message);
    }

    console.log("\n📊 SAMPLE DATA:");
    try {
      const [productCount] = await connection.execute(
        "SELECT COUNT(*) as count FROM products"
      );
      console.log(`Products count: ${productCount[0].count}`);

      const [categoryCount] = await connection.execute(
        "SELECT COUNT(*) as count FROM categories"
      );
      console.log(`Categories count: ${categoryCount[0].count}`);
    } catch (error) {
      console.log("❌ Error checking counts:", error.message);
    }

    console.log("\n🔗 FOREIGN KEY CONSTRAINTS:");
    try {
      const [constraints] = await connection.execute(
        `
                SELECT 
                    CONSTRAINT_NAME,
                    TABLE_NAME,
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE table_schema = ? 
                AND REFERENCED_TABLE_NAME IS NOT NULL
            `,
        [DB_NAME]
      );

      if (constraints.length > 0) {
        console.log("✅ Found foreign key constraints:");
        constraints.forEach((constraint) => {
          console.log(
            `   - ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`
          );
        });
      } else {
        console.log("❌ No foreign key constraints found");
      }
    } catch (error) {
      console.log("❌ Error checking constraints:", error.message);
    }
  } catch (error) {
    console.error("❌ Database connection failed:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkSchema();

// Run: node check_schema.js
