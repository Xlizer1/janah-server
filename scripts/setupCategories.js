const fs = require("fs");
const path = require("path");

function setupCategoriesModule() {
  console.log("📂 Setting up Categories module...\n");

  try {
    // Create directories
    const categoriesDir = path.join(__dirname, "../src/api/v1/categories");

    if (!fs.existsSync(categoriesDir)) {
      fs.mkdirSync(categoriesDir, { recursive: true });
      console.log("✅ Created categories directory");
    } else {
      console.log("📁 Categories directory already exists");
    }

    // Check required files
    const requiredFiles = [
      "model.js",
      "controller.js",
      "validation.js",
      "router.js",
    ];

    let missingFiles = [];

    requiredFiles.forEach((file) => {
      const filePath = path.join(categoriesDir, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      } else {
        console.log(`✅ ${file} exists`);
      }
    });

    if (missingFiles.length > 0) {
      console.log(`\n⚠️  Missing files: ${missingFiles.join(", ")}`);
      console.log("\n📝 Please create these files with the provided content:");

      missingFiles.forEach((file) => {
        console.log(`   - src/api/v1/categories/${file}`);
      });
    } else {
      console.log("\n✅ All category files are present");
    }

    // Check main router integration
    const mainRouterPath = path.join(__dirname, "../src/api/v1/index.js");
    if (fs.existsSync(mainRouterPath)) {
      const mainRouterContent = fs.readFileSync(mainRouterPath, "utf8");

      if (
        mainRouterContent.includes("categories/router") &&
        mainRouterContent.includes("/categories")
      ) {
        console.log("✅ Categories routes integrated in main router");
      } else {
        console.log("⚠️  Categories routes not integrated in main router");
        console.log("   Add this to src/api/v1/index.js:");
        console.log(
          '   const categoryRouter = require("./categories/router");'
        );
        console.log('   router.use("/categories", categoryRouter);');
      }
    }

    console.log("\n🎯 Next Steps:");
    console.log("1. Copy the provided file contents to the missing files");
    console.log("2. Run: npm run db:migrate (to create categories table)");
    console.log("3. Start server: npm run dev");
    console.log("4. Test: curl http://localhost:8000/api/v1/categories");

    console.log("\n✅ Categories module setup completed!");
  } catch (error) {
    console.error("❌ Setup failed:", error);
  }
}

// Run if called directly
if (require.main === module) {
  setupCategoriesModule();
}

module.exports = setupCategoriesModule;
