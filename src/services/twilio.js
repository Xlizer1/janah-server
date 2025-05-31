const twilio = require('twilio');

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

class TwilioService {
    /**
     * Send SMS message
     * @param {string} to - Phone number to send to
     * @param {string} message - Message content
     * @returns {Promise<object>} Twilio response
     */
    static async sendSMS(to, message) {
        try {
            const response = await twilioClient.messages.create({
                body: message,
                from: TWILIO_PHONE_NUMBER,
                to: to
            });
            
            console.log(`SMS sent successfully to ${to}: ${response.sid}`);
            return {
                success: true,
                sid: response.sid,
                status: response.status
            };
        } catch (error) {
            console.error('Twilio SMS Error:', error);
            throw new Error(`Failed to send SMS: ${error.message}`);
        }
    }

    /**
     * Send verification code
     * @param {string} phoneNumber - Phone number
     * @param {string} code - Verification code
     * @param {string} type - Type of verification (registration, password_reset)
     * @returns {Promise<object>} Response
     */
    static async sendVerificationCode(phoneNumber, code, type = 'registration') {
        let message;
        
        switch (type) {
            case 'registration':
                message = `Welcome to Janah! Your verification code is: ${code}. This code expires in 10 minutes.`;
                break;
            case 'password_reset':
                message = `Your Janah password reset code is: ${code}. This code expires in 10 minutes. If you didn't request this, please ignore.`;
                break;
            default:
                message = `Your Janah verification code is: ${code}`;
        }

        return await this.sendSMS(phoneNumber, message);
    }

    /**
     * Send account activation notification
     * @param {string} phoneNumber - Phone number
     * @param {string} firstName - User's first name
     * @returns {Promise<object>} Response
     */
    static async sendActivationNotification(phoneNumber, firstName) {
        const message = `Hi ${firstName}! Great news - your Janah account has been activated! You can now access all our products and start shopping.`;
        return await this.sendSMS(phoneNumber, message);
    }

    /**
     * Generate random verification code
     * @param {number} length - Code length (default: 6)
     * @returns {string} Verification code
     */
    static generateVerificationCode(length = 6) {
        const digits = '0123456789';
        let code = '';
        
        for (let i = 0; i < length; i++) {
            code += digits[Math.floor(Math.random() * digits.length)];
        }
        
        return code;
    }

    /**
     * Validate phone number format
     * @param {string} phoneNumber - Phone number to validate
     * @returns {object} Validation result
     */
    static validatePhoneNumber(phoneNumber) {
        // Basic phone number validation (you can enhance this)
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        
        if (!phoneNumber) {
            return { isValid: false, message: 'Phone number is required' };
        }
        
        // Remove spaces and dashes
        const cleanPhone = phoneNumber.replace(/[\s-]/g, '');
        
        if (!phoneRegex.test(cleanPhone)) {
            return { isValid: false, message: 'Invalid phone number format' };
        }
        
        return { isValid: true, cleanPhone };
    }

    /**
     * Format phone number with country code
     * @param {string} phoneNumber - Phone number
     * @param {string} defaultCountryCode - Default country code (e.g., '+1')
     * @returns {string} Formatted phone number
     */
    static formatPhoneNumber(phoneNumber, defaultCountryCode = '+1') {
        const { isValid, cleanPhone } = this.validatePhoneNumber(phoneNumber);
        
        if (!isValid) {
            throw new Error('Invalid phone number');
        }
        
        // If phone doesn't start with +, add default country code
        if (!cleanPhone.startsWith('+')) {
            return `${defaultCountryCode}${cleanPhone}`;
        }
        
        return cleanPhone;
    }
}

module.exports = TwilioService;