const VerificationCodeModel = require('../src/api/v1/auth/verificationModel');

require('dotenv').config();
require('../src/config/db');

async function cleanupExpiredCodes() {
    try {
        console.log('🧹 Starting cleanup of expired verification codes...');
        
        const deletedCount = await VerificationCodeModel.cleanupExpiredCodes();
        
        console.log(`✅ Cleanup completed. Removed ${deletedCount} expired codes.`);
        
        if (deletedCount > 0) {
            console.log('💡 Tip: Consider setting up a cron job to run this script regularly.');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    cleanupExpiredCodes();
}