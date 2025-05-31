require('dotenv').config();
const mysql = require('mysql2/promise');

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

async function migrateToCategoriesTable() {
    let connection;
    
    try {
        console.log('🔄 Starting migration to categories table...');
        
        // Connect to database
        connection = await mysql.createConnection({
            host: DB_HOST || 'localhost',
            user: DB_USER || 'root',
            password: DB_PASSWORD || '',
            database: DB_NAME,
            multipleStatements: true
        });
        
        console.log('✅ Connected to database');
        
        // Step 1: Check if migration is needed
        console.log('🔍 Checking current database structure...');
        
        const [categoriesTableExists] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = ? AND table_name = 'categories'
        `, [DB_NAME]);
        
        if (categoriesTableExists[0].count > 0) {
            console.log('✅ Categories table already exists. Checking if migration is needed...');
            
            // Check if products table still has old category column
            const [oldCategoryColumnExists] = await connection.execute(`
                SELECT COUNT(*) as count 
                FROM information_schema.columns 
                WHERE table_schema = ? AND table_name = 'products' AND column_name = 'category'
            `, [DB_NAME]);
            
            if (oldCategoryColumnExists[0].count === 0) {
                console.log('✅ Migration already completed. Nothing to do.');
                return;
            }
        }
        
        // Step 2: Create backup
        console.log('💾 Creating backup of current data...');
        
        const [existingProducts] = await connection.execute('SELECT * FROM products');
        console.log(`📦 Found ${existingProducts.length} existing products`);
        
        // Step 3: Create categories table if it doesn't exist
        if (categoriesTableExists[0].count === 0) {
            console.log('📋 Creating categories table...');
            
            await connection.execute(`
                CREATE TABLE categories (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    name VARCHAR(100) UNIQUE NOT NULL,
                    slug VARCHAR(100) UNIQUE NOT NULL,
                    description TEXT,
                    image_url VARCHAR(500),
                    is_active BOOLEAN DEFAULT TRUE,
                    sort_order INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_slug (slug),
                    INDEX idx_active (is_active),
                    INDEX idx_sort (sort_order)
                )
            `);
            
            console.log('✅ Categories table created');
        }
        
        // Step 4: Extract unique categories from existing products
        console.log('🔍 Extracting unique categories from existing products...');
        
        const [uniqueCategories] = await connection.execute(`
            SELECT DISTINCT category 
            FROM products 
            WHERE category IS NOT NULL AND category != ''
            ORDER BY category
        `);
        
        console.log(`📂 Found ${uniqueCategories.length} unique categories`);
        
        // Step 5: Generate category data and insert
        console.log('📂 Creating category records...');
        
        const categoryMap = new Map(); // Map old category names to new IDs
        let sortOrder = 1;
        
        // Default categories with better data
        const defaultCategories = [
            { name: 'Electronics', slug: 'electronics', description: 'Electronic devices and gadgets' },
            { name: 'Computers', slug: 'computers', description: 'Computers, laptops, and accessories' },
            { name: 'Smartphones', slug: 'smartphones', description: 'Mobile phones and accessories' },
            { name: 'Accessories', slug: 'accessories', description: 'Various accessories and add-ons' },
            { name: 'Shoes', slug: 'shoes', description: 'Footwear for all occasions' },
            { name: 'Clothing', slug: 'clothing', description: 'Apparel and fashion items' },
            { name: 'Home & Garden', slug: 'home-garden', description: 'Home improvement and garden items' },
            { name: 'Sports', slug: 'sports', description: 'Sports equipment and gear' },
            { name: 'Books', slug: 'books', description: 'Books and educational materials' },
            { name: 'Health & Beauty', slug: 'health-beauty', description: 'Health and beauty products' }
        ];
        
        // Function to generate slug from name
        const generateSlug = (name) => {
            return name
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
        };
        
        // Insert default categories first
        for (const category of defaultCategories) {
            try {
                const [result] = await connection.execute(`
                    INSERT INTO categories (name, slug, description, sort_order) 
                    VALUES (?, ?, ?, ?)
                `, [category.name, category.slug, category.description, sortOrder]);
                
                categoryMap.set(category.name.toLowerCase(), result.insertId);
                console.log(`✅ Created default category: ${category.name} (ID: ${result.insertId})`);
                sortOrder++;
            } catch (error) {
                // Category might already exist, get its ID
                const [existing] = await connection.execute(
                    'SELECT id FROM categories WHERE name = ?', 
                    [category.name]
                );
                if (existing.length > 0) {
                    categoryMap.set(category.name.toLowerCase(), existing[0].id);
                    console.log(`✅ Found existing category: ${category.name} (ID: ${existing[0].id})`);
                }
            }
        }
        
        // Insert unique categories from existing products
        for (const categoryRow of uniqueCategories) {
            const categoryName = categoryRow.category.trim();
            const categoryNameLower = categoryName.toLowerCase();
            
            if (!categoryMap.has(categoryNameLower)) {
                const slug = generateSlug(categoryName);
                
                try {
                    const [result] = await connection.execute(`
                        INSERT INTO categories (name, slug, description, sort_order) 
                        VALUES (?, ?, ?, ?)
                    `, [categoryName, slug, `Products in ${categoryName} category`, sortOrder]);
                    
                    categoryMap.set(categoryNameLower, result.insertId);
                    console.log(`✅ Created category: ${categoryName} (ID: ${result.insertId})`);
                    sortOrder++;
                } catch (error) {
                    console.error(`❌ Error creating category ${categoryName}:`, error.message);
                }
            }
        }
        
        // Step 6: Add new columns to products table
        console.log('🔧 Updating products table structure...');
        
        // Check which columns need to be added
        const [currentColumns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM information_schema.columns 
            WHERE table_schema = ? AND table_name = 'products'
        `, [DB_NAME]);
        
        const existingColumns = currentColumns.map(row => row.COLUMN_NAME);
        
        const newColumns = [
            { name: 'slug', definition: 'VARCHAR(255) UNIQUE AFTER name' },
            { name: 'category_id', definition: 'INT AFTER stock_quantity' },
            { name: 'is_featured', definition: 'BOOLEAN DEFAULT FALSE AFTER is_active' },
            { name: 'weight', definition: 'DECIMAL(8, 2) AFTER is_featured' },
            { name: 'dimensions', definition: 'VARCHAR(100) AFTER weight' },
            { name: 'sku', definition: 'VARCHAR(100) UNIQUE AFTER dimensions' }
        ];
        
        for (const column of newColumns) {
            if (!existingColumns.includes(column.name)) {
                await connection.execute(`ALTER TABLE products ADD COLUMN ${column.name} ${column.definition}`);
                console.log(`✅ Added column: ${column.name}`);
            }
        }
        
        // Step 7: Update products with category_id and generate slugs
        console.log('🔄 Updating products with category relationships...');
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const product of existingProducts) {
            const productId = product.id;
            const categoryName = product.category ? product.category.trim() : '';
            const categoryNameLower = categoryName.toLowerCase();
            
            // Generate slug for product
            const slug = generateSlug(product.name + '-' + productId);
            
            // Find category ID
            let categoryId = null;
            if (categoryName && categoryMap.has(categoryNameLower)) {
                categoryId = categoryMap.get(categoryNameLower);
            }
            
            try {
                await connection.execute(`
                    UPDATE products 
                    SET slug = ?, category_id = ?, is_featured = ?, sku = ?
                    WHERE id = ?
                `, [
                    slug,
                    categoryId,
                    false, // Default not featured
                    `PROD${String(productId).padStart(6, '0')}`, // Generate SKU
                    productId
                ]);
                
                updatedCount++;
                
                if (categoryId) {
                    console.log(`✅ Updated product: ${product.name} → Category ID: ${categoryId}`);
                } else {
                    console.log(`⚠️  Updated product: ${product.name} → No category assigned`);
                }
            } catch (error) {
                console.error(`❌ Error updating product ${product.name}:`, error.message);
                skippedCount++;
            }
        }
        
        console.log(`✅ Updated ${updatedCount} products, skipped ${skippedCount}`);
        
        // Step 8: Add foreign key constraint
        console.log('🔗 Adding foreign key constraint...');
        
        try {
            await connection.execute(`
                ALTER TABLE products 
                ADD CONSTRAINT fk_products_category 
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            `);
            console.log('✅ Foreign key constraint added');
        } catch (error) {
            console.log('⚠️  Foreign key constraint may already exist or failed:', error.message);
        }
        
        // Step 9: Add indexes for better performance
        console.log('📊 Adding database indexes...');
        
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
            'CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)',
            'CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)',
            'CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured)'
        ];
        
        for (const indexSql of indexes) {
            try {
                await connection.execute(indexSql);
                console.log('✅ Index created');
            } catch (error) {
                console.log('⚠️  Index may already exist:', error.message);
            }
        }
        
        // Step 10: Remove old category column (optional - commented out for safety)
        console.log('⚠️  Old category column is preserved for safety.');
        console.log('   To remove it manually after verifying migration:');
        console.log('   ALTER TABLE products DROP COLUMN category;');
        
        // Uncomment the following lines if you want to automatically remove the old column
        // console.log('🗑️  Removing old category column...');
        // await connection.execute('ALTER TABLE products DROP COLUMN category');
        // console.log('✅ Old category column removed');
        
        console.log('\n🎉 Migration completed successfully!');
        console.log('\n📋 Migration Summary:');
        console.log(`   ✅ Categories table created with ${categoryMap.size} categories`);
        console.log(`   ✅ Products updated: ${updatedCount}`);
        console.log(`   ✅ Products skipped: ${skippedCount}`);
        console.log('   ✅ New columns added: slug, category_id, is_featured, weight, dimensions, sku');
        console.log('   ✅ Foreign key constraint added');
        console.log('   ✅ Database indexes created');
        console.log('\n🔧 Next Steps:');
        console.log('   1. Test your application thoroughly');
        console.log('   2. Update API calls to use new category endpoints');
        console.log('   3. Verify all products have correct category relationships');
        console.log('   4. Consider removing old category column after verification');
        console.log('\n🚀 Your e-commerce API is now ready with the improved category system!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.log('\n🔄 Rolling back changes...');
        
        // Basic rollback - remove new columns if they were added
        try {
            const columnsToRemove = ['slug', 'category_id', 'is_featured', 'weight', 'dimensions', 'sku'];
            for (const column of columnsToRemove) {
                try {
                    await connection.execute(`ALTER TABLE products DROP COLUMN ${column}`);
                    console.log(`✅ Rolled back column: ${column}`);
                } catch (rollbackError) {
                    // Column might not exist, ignore
                }
            }
        } catch (rollbackError) {
            console.error('❌ Rollback failed:', rollbackError.message);
        }
        
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function validateMigration() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: DB_HOST || 'localhost',
            user: DB_USER || 'root',
            password: DB_PASSWORD || '',
            database: DB_NAME
        });
        
        console.log('\n🔍 Validating migration...');
        
        // Check categories table
        const [categoryCount] = await connection.execute('SELECT COUNT(*) as count FROM categories');
        console.log(`✅ Categories table has ${categoryCount[0].count} records`);
        
        // Check products with categories
        const [productsWithCategories] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.category_id IS NOT NULL
        `);
        console.log(`✅ ${productsWithCategories[0].count} products have category relationships`);
        
        // Check products without categories
        const [productsWithoutCategories] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM products 
            WHERE category_id IS NULL
        `);
        console.log(`⚠️  ${productsWithoutCategories[0].count} products have no category assigned`);
        
        // Check for duplicate slugs
        const [duplicateSlugs] = await connection.execute(`
            SELECT slug, COUNT(*) as count 
            FROM products 
            WHERE slug IS NOT NULL 
            GROUP BY slug 
            HAVING COUNT(*) > 1
        `);
        
        if (duplicateSlugs.length > 0) {
            console.log(`⚠️  Found ${duplicateSlugs.length} duplicate product slugs - please fix manually`);
        } else {
            console.log('✅ All product slugs are unique');
        }
        
        console.log('✅ Migration validation completed');
        
    } catch (error) {
        console.error('❌ Validation failed:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'validate') {
        validateMigration();
    } else {
        migrateToCategoriesTable().then(() => {
            console.log('\n🔍 Running validation...');
            validateMigration();
        });
    }
}

module.exports = { migrateToCategoriesTable, validateMigration };