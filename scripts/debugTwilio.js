require('dotenv').config();

console.log('=== TWILIO CONFIGURATION DEBUG ===');
console.log('Environment loaded:', !!process.env.NODE_ENV);
console.log('');

// Check if environment variables are loaded
const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER
} = process.env;

console.log('TWILIO_ACCOUNT_SID:', TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.slice(0, 8)}...` : 'NOT SET');
console.log('TWILIO_AUTH_TOKEN:', TWILIO_AUTH_TOKEN ? `${TWILIO_AUTH_TOKEN.slice(0, 8)}...` : 'NOT SET');
console.log('TWILIO_PHONE_NUMBER:', TWILIO_PHONE_NUMBER || 'NOT SET');
console.log('');

// Validate Account SID format
if (TWILIO_ACCOUNT_SID) {
    const isValidFormat = /^AC[a-f0-9]{32}$/i.test(TWILIO_ACCOUNT_SID);
    console.log('Account SID format valid:', isValidFormat);
    console.log('Account SID length:', TWILIO_ACCOUNT_SID.length, '(should be 34)');
} else {
    console.log('❌ Account SID is missing');
}

// Validate Auth Token format
if (TWILIO_AUTH_TOKEN) {
    const isValidFormat = /^[a-f0-9]{32}$/i.test(TWILIO_AUTH_TOKEN);
    console.log('Auth Token format valid:', isValidFormat);
    console.log('Auth Token length:', TWILIO_AUTH_TOKEN.length, '(should be 32)');
} else {
    console.log('❌ Auth Token is missing');
}

// Test Twilio connection
async function testTwilioConnection() {
    console.log('\n=== TESTING TWILIO CONNECTION ===');
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        console.log('❌ Cannot test - missing credentials');
        return;
    }

    try {
        const twilio = require('twilio');
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        
        // Test by fetching account info
        const account = await client.api.accounts(TWILIO_ACCOUNT_SID).fetch();
        console.log('✅ Connection successful!');
        console.log('Account Status:', account.status);
        console.log('Account Type:', account.type);
        console.log('Account Friendly Name:', account.friendlyName);
        
        // Check if it's a trial account
        if (account.type === 'Trial') {
            console.log('⚠️  WARNING: This is a TRIAL account with restrictions');
            console.log('   - Can only send to verified phone numbers');
            console.log('   - Has limited message credits');
        }
        
    } catch (error) {
        console.log('❌ Connection failed:', error.message);
        console.log('Error code:', error.code);
        console.log('Status:', error.status);
        
        if (error.code === 20003) {
            console.log('\n🔧 SOLUTIONS for Error 20003:');
            console.log('1. Verify your Account SID and Auth Token in Twilio Console');
            console.log('2. Make sure you copied them correctly (no extra spaces)');
            console.log('3. Check if your account is suspended');
            console.log('4. Ensure you\'re using the right credentials (not test credentials)');
        }
    }
}

testTwilioConnection();