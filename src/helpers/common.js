const { executeQuery, executeTransaction, buildInsertQuery, buildUpdateQuery } = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { TOKEN_KEY, EXPIRES_IN, SALT_ROUNDS } = process.env;

const tokenKey = TOKEN_KEY || "cyka";
const tokenExpiry = EXPIRES_IN || "12h";
const saltRounds = SALT_ROUNDS || 10;

const hash = (text) => {
    return new Promise(async (resolve, reject) => {
        try {
            bcrypt
                .hash(text, typeof saltRounds === "string" ? JSON.parse(saltRounds) : saltRounds)
                .then((hashedText) => resolve(hashedText))
                .catch((e) => reject(e));
        } catch (error) {
            reject(`An error occurred while hashing: ${error.message}`);
        }
    });
};

const verifyPassword = (password, hashedPassword) => {
    return new Promise(async (resolve, reject) => {
        try {
            const comparisonResult = await bcrypt.compare(password, hashedPassword);
            resolve(comparisonResult);
        } catch (error) {
            reject("An error occured while verifying password: " + error.message);
        }
    });
};

const createToken = (object) => {
    return new Promise(async (resolve, reject) => {
        try {
            delete object?.password;
            const token = await jwt.sign({ data: object }, tokenKey, { expiresIn: tokenExpiry });
            resolve(token);
        } catch (error) {
            reject("An error occured while creating the token: " + error.message);
        }
    });
};

const resultObject = (status, message, data) => {
    return {
        status: status,
        message: message,
        data: data,
    };
};

function getToken(req) {
    return new Promise(async (resolve, reject) => {
        const authHeader = req?.headers?.authorization || "";
        const parts = await authHeader.split(" ");
        const headerAuthorization = parts.length === 2 ? parts[1] : null;
        const token = headerAuthorization || req?.headers["jwt"] || req?.headers["token"];
        if (typeof token === "string" && token.length > 1) {
            resolve(token);
        } else {
            reject(false);
        }
    });
}

const checkUserAuthorized = () => {
    return async (req, res, next) => {
        try {
            const authHeader = req?.headers?.authorization || "";
            const parts = await authHeader.split(" ");
            const headerAuthorization = parts.length === 2 ? parts[1] : null;

            const jwtToken = headerAuthorization || req?.headers["jwt"] || req?.headers["token"];
            const authorize = await verifyUserToken(jwtToken);

            if (!authorize || !authorize?.id || !authorize?.email) {
                res.json(resultObject(false, "Token is invalid!"));
                return;
            } else {
                req.user = authorize;
                next();
            }
        } catch (error) {
            console.log(error);
            res.json(resultObject(false, "Token is invalid!"));
        }
    };
};

const verifyUserToken = (token) => {
    return new Promise((resolve, reject) => {
        if (!token) {
            resolve(null);
            return;
        }

        try {
            const data = jwt.verify(token, tokenKey);
            if (data?.data) {
                resolve(data.data);
            } else {
                resolve(null);
            }
        } catch (error) {
            console.error("Token verification error:", error.message);
            resolve(null);
        }
    });
};

/**
 * Utility function to validate email format
 */
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Utility function to validate phone number format
 */
const validatePhoneNumber = (phoneNumber) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/[\s-]/g, ''));
};

/**
 * Utility function to sanitize user input
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 1000); // Limit length
};

/**
 * Utility function to generate random string
 */
const generateRandomString = (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Utility function to format currency
 */
const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
};

/**
 * Utility function to calculate pagination
 */
const calculatePagination = (page, limit, total) => {
    const currentPage = Math.max(1, parseInt(page) || 1);
    const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const totalPages = Math.ceil(total / itemsPerPage);
    const offset = (currentPage - 1) * itemsPerPage;
    
    return {
        page: currentPage,
        limit: itemsPerPage,
        total,
        totalPages,
        offset,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
    };
};

module.exports = {
    hash,
    executeQuery,
    executeTransaction,
    buildInsertQuery,
    buildUpdateQuery,
    verifyPassword,
    resultObject,
    createToken,
    verifyUserToken,
    checkUserAuthorized,
    getToken,
    validateEmail,
    validatePhoneNumber,
    sanitizeInput,
    generateRandomString,
    formatCurrency,
    calculatePagination
};