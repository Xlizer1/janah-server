require('dotenv').config();
const mysql = require('mysql2/promise');
const { hash } = require('../src/helpers/common');

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

async function setupDatabase() {
    let connection;
    
    try {
        console.log('🔧 Starting database setup...');
        
        // Connect to MySQL (without selecting database first)
        connection = await mysql.createConnection({
            host: DB_HOST || 'localhost',
            user: DB_USER || 'root',
            password: DB_PASSWORD || '',
            multipleStatements: true
        });
        
        console.log('✅ Connected to MySQL server');
        
        // Create database if it doesn't exist
        await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
        console.log(`✅ Database '${DB_NAME}' created/verified`);
        
        // Use the database
        await connection.execute(`USE \`${DB_NAME}\``);
        
        // Create tables
        console.log('📋 Creating tables...');
        
        // Users table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE,
                is_phone_verified BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT FALSE,
                role ENUM('user', 'admin') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                activated_at TIMESTAMP NULL,
                activated_by INT NULL,
                INDEX idx_phone (phone_number),
                INDEX idx_email (email),
                FOREIGN KEY (activated_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Users table created');
        
        // Phone verification codes table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS phone_verification_codes (
                id INT PRIMARY KEY AUTO_INCREMENT,
                phone_number VARCHAR(20) NOT NULL,
                code VARCHAR(10) NOT NULL,
                type ENUM('registration', 'password_reset') NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_phone_code (phone_number, code),
                INDEX idx_expires (expires_at)
            )
        `);
        console.log('✅ Phone verification codes table created');
        
        // Products table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                stock_quantity INT DEFAULT 0,
                category VARCHAR(100),
                image_url VARCHAR(500),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_category (category),
                INDEX idx_active (is_active),
                INDEX idx_price (price)
            )
        `);
        console.log('✅ Products table created');
        
        // Check if admin user exists
        const [adminExists] = await connection.execute(
            'SELECT id FROM users WHERE role = "admin" LIMIT 1'
        );
        
        if (adminExists.length === 0) {
            console.log('👤 Creating default admin user...');
            
            // Create default admin user
            const adminPassword = await hash('admin123');
            await connection.execute(`
                INSERT INTO users (
                    phone_number, 
                    password, 
                    first_name, 
                    last_name, 
                    email, 
                    is_phone_verified, 
                    is_active, 
                    role,
                    activated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                '+1234567890',
                adminPassword,
                'Admin',
                'User',
                'admin@janah.com',
                true,
                true,
                'admin',
                new Date()
            ]);
            
            console.log('✅ Default admin user created');
            console.log('📱 Admin Phone: +1234567890');
            console.log('🔑 Admin Password: admin123');
            console.log('⚠️  Please change the admin password after first login!');
        } else {
            console.log('✅ Admin user already exists');
        }
        
        // Insert sample products if none exist
        const [productsExist] = await connection.execute(
            'SELECT id FROM products LIMIT 1'
        );
        
        if (productsExist.length === 0) {
            console.log('📦 Creating sample products...');
            
            const sampleProducts = [
                {
                    name: 'iPhone 15 Pro',
                    description: 'Latest Apple iPhone with advanced camera system',
                    price: 999.99,
                    stock_quantity: 25,
                    category: 'electronics',
                    image_url: 'https://example.com/iphone15.jpg'
                },
                {
                    name: 'Samsung Galaxy S24',
                    description: 'Premium Android smartphone with AI features',
                    price: 899.99,
                    stock_quantity: 30,
                    category: 'electronics',
                    image_url: 'https://example.com/galaxy-s24.jpg'
                },
                {
                    name: 'MacBook Air M3',
                    description: 'Ultra-thin laptop with M3 chip',
                    price: 1299.99,
                    stock_quantity: 15,
                    category: 'computers',
                    image_url: 'https://example.com/macbook-air.jpg'
                },
                {
                    name: 'AirPods Pro',
                    description: 'Wireless earbuds with noise cancellation',
                    price: 249.99,
                    stock_quantity: 50,
                    category: 'accessories',
                    image_url: 'https://example.com/airpods-pro.jpg'
                },
                {
                    name: 'Nike Air Max 270',
                    description: 'Comfortable running shoes with air cushioning',
                    price: 129.99,
                    stock_quantity: 40,
                    category: 'shoes',
                    image_url: 'https://example.com/nike-air-max.jpg'
                }
            ];
            
            for (const product of sampleProducts) {
                await connection.execute(`
                    INSERT INTO products (name, description, price, stock_quantity, category, image_url)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    product.name,
                    product.description,
                    product.price,
                    product.stock_quantity,
                    product.category,
                    product.image_url
                ]);
            }
            
            console.log(`✅ ${sampleProducts.length} sample products created`);
        } else {
            console.log('✅ Products already exist in database');
        }
        
        console.log('\n🎉 Database setup completed successfully!');
        console.log('\n📋 Setup Summary:');
        console.log('   ✅ Database created');
        console.log('   ✅ Tables created');
        console.log('   ✅ Admin user ready');
        console.log('   ✅ Sample products added');
        console.log('\n🚀 You can now start the server with: npm run dev');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase;