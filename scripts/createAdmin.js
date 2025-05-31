require('dotenv').config();
require('../src/config/db');
const UserModel = require('../src/api/v1/auth/model');
const { hash } = require('../src/helpers/common');
const TwilioService = require('../src/services/twilio');

async function createAdmin() {
    try {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const question = (prompt) => new Promise(resolve => {
            readline.question(prompt, resolve);
        });
        
        console.log('👤 Create New Admin User');
        console.log('========================\n');
        
        const phoneNumber = await question('Phone Number (with country code): ');
        const firstName = await question('First Name: ');
        const lastName = await question('Last Name: ');
        const email = await question('Email (optional): ');
        const password = await question('Password: ');
        
        readline.close();
        
        // Validate phone number
        const { isValid, cleanPhone } = TwilioService.validatePhoneNumber(phoneNumber);
        if (!isValid) {
            throw new Error('Invalid phone number format');
        }
        
        const formattedPhone = TwilioService.formatPhoneNumber(cleanPhone);
        
        // Check if user already exists
        const existingUser = await UserModel.findByPhoneNumber(formattedPhone);
        if (existingUser) {
            throw new Error('User with this phone number already exists');
        }
        
        // Hash password
        const hashedPassword = await hash(password);
        
        // Create admin user
        const adminData = {
            phone_number: formattedPhone,
            password: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            is_phone_verified: true,
            is_active: true,
            role: 'admin',
            activated_at: new Date()
        };
        
        const newAdmin = await UserModel.createUser(adminData);
        
        console.log('\n✅ Admin user created successfully!');
        console.log(`📱 Phone: ${formattedPhone}`);
        console.log(`👤 Name: ${firstName} ${lastName}`);
        console.log(`📧 Email: ${email || 'Not provided'}`);
        console.log(`🆔 User ID: ${newAdmin.id}`);
        
    } catch (error) {
        console.error('❌ Failed to create admin:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    createAdmin();
}
