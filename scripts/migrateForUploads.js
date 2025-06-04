const { executeQuery } = require("../src/helpers/db");

/**
 * Migration script to add profile_picture support to users table
 * Run this script to update your database schema
 */

async function addProfilePictureColumn() {
  try {
    console.log("🔄 Adding profile_picture column to users table...");

    // Check if column already exists
    const checkColumnSql = `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'profile_picture'
        `;

    const columnExists = await executeQuery(
      checkColumnSql,
      [],
      "Check Profile Picture Column"
    );

    if (columnExists.length > 0) {
      console.log("✅ profile_picture column already exists in users table");
      return;
    }

    // Add profile_picture column
    const addColumnSql = `
            ALTER TABLE users 
            ADD COLUMN profile_picture VARCHAR(500) NULL AFTER email,
            ADD INDEX idx_users_profile_picture (profile_picture)
        `;

    await executeQuery(addColumnSql, [], "Add Profile Picture Column");
    console.log("✅ Successfully added profile_picture column to users table");
  } catch (error) {
    console.error("❌ Error adding profile_picture column:", error);
    throw error;
  }
}

async function createFileUploadDirectories() {
  try {
    console.log("🔄 Ensuring upload directories exist...");

    const fs = require("fs");
    const directories = [
      "uploads",
      "uploads/products",
      "uploads/categories",
      "uploads/users",
      "uploads/temp",
    ];

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } else {
        console.log(`✅ Directory already exists: ${dir}`);
      }
    });

    // Create .gitkeep files to ensure directories are tracked in git
    directories.forEach((dir) => {
      const gitkeepPath = `${dir}/.gitkeep`;
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, "");
        console.log(`✅ Created .gitkeep in ${dir}`);
      }
    });
  } catch (error) {
    console.error("❌ Error creating upload directories:", error);
    throw error;
  }
}

async function updateImageUrlColumns() {
  try {
    console.log("🔄 Updating image_url columns to support local file paths...");

    // Update products table
    const updateProductsSql = `
            ALTER TABLE products 
            MODIFY COLUMN image_url VARCHAR(500) NULL
        `;

    await executeQuery(
      updateProductsSql,
      [],
      "Update Products Image URL Column"
    );
    console.log("✅ Updated products.image_url column");

    // Update categories table
    const updateCategoriesSql = `
            ALTER TABLE categories 
            MODIFY COLUMN image_url VARCHAR(500) NULL
        `;

    await executeQuery(
      updateCategoriesSql,
      [],
      "Update Categories Image URL Column"
    );
    console.log("✅ Updated categories.image_url column");
  } catch (error) {
    console.error("❌ Error updating image_url columns:", error);
    throw error;
  }
}

async function runMigration() {
  try {
    console.log("🚀 Starting file upload migration...");

    await addProfilePictureColumn();
    await createFileUploadDirectories();
    await updateImageUrlColumns();

    console.log("🎉 File upload migration completed successfully!");
    console.log("");
    console.log("📝 Next steps:");
    console.log(
      "1. Make sure your uploads directory has proper write permissions"
    );
    console.log("2. Configure MAX_FILE_SIZE in your .env file (default: 50MB)");
    console.log("3. Test file uploads with the new endpoints");
    console.log("");
    console.log("🔗 New endpoints available:");
    console.log("- POST /api/v1/auth/profile/picture (upload profile picture)");
    console.log(
      "- DELETE /api/v1/auth/profile/picture (remove profile picture)"
    );
    console.log(
      "- PUT /api/v1/auth/profile (update profile with optional picture)"
    );
    console.log("- POST /api/v1/products (create product with optional image)");
    console.log(
      "- PUT /api/v1/products/:id (update product with optional image)"
    );
    console.log(
      "- POST /api/v1/categories (create category with optional image)"
    );
    console.log(
      "- PUT /api/v1/categories/:id (update category with optional image)"
    );
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
}

// Run migration if script is called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = {
  addProfilePictureColumn,
  createFileUploadDirectories,
  updateImageUrlColumns,
  runMigration,
};
