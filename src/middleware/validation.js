const { resultObject } = require("../helpers/common");

const validateRequest = (schema) => {
    return (req, res, next) => {
        const errors = [];
        
        // Validate required fields and types
        Object.keys(schema).forEach(field => {
            const value = req.body[field];
            const rules = schema[field];

            // Check required fields
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                return;
            }

            // Skip further validation if field is not required and not provided
            if (!rules.required && (value === undefined || value === null || value === '')) {
                return;
            }

            // Validate type
            switch (rules.type) {
                case 'string':
                    if (typeof value !== 'string') {
                        errors.push(`${field} must be a string`);
                    }
                    break;
                case 'number':
                    if (typeof value !== 'number' || isNaN(value)) {
                        errors.push(`${field} must be a number`);
                    } else {
                        // Check min value if specified
                        if (rules.min !== undefined && value < rules.min) {
                            errors.push(`${field} must be greater than or equal to ${rules.min}`);
                        }
                        // Check max value if specified
                        if (rules.max !== undefined && value > rules.max) {
                            errors.push(`${field} must be less than or equal to ${rules.max}`);
                        }
                    }
                    break;
                case 'boolean':
                    if (typeof value !== 'boolean') {
                        errors.push(`${field} must be a boolean`);
                    }
                    break;
                case 'array':
                    if (!Array.isArray(value)) {
                        errors.push(`${field} must be an array`);
                    }
                    break;
                // Add more types as needed
            }
        });

        if (errors.length > 0) {
            return res.status(400).json(resultObject(false, "Validation failed", errors));
        }

        next();
    };
};

module.exports = {
    validateRequest
};
