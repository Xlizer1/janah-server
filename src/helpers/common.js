const { executeQuery, executeTransaction, buildInsertQuery, buildUpdateQuery } = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { TOKEN_KEY, EXPIRES_IN, SALT_ROUNDS, SECRET_KEY } = process.env;

const tokenKey = TOKEN_KEY || "cyka";
const tokenExpiry = EXPIRES_IN || "12h";
const saltRounds = SALT_ROUNDS || 10;

// Define the encryption algorithm, key, and IV (Initialization Vector)
const algorithm = "aes-256-cbc";
const secretKey = Buffer.from(SECRET_KEY || "hola_amigos", "hex");
const iv = crypto.randomBytes(16); // A 16-byte IV

function encryptObject(obj) {
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(obj)), cipher.final()]);
    return {
        iv: iv.toString("hex"),
        encryptedData: encrypted.toString("hex"),
    };
}

function decryptObject(encrypted) {
    if (!encrypted.iv || !encrypted.encryptedData) return false;
    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(encrypted.iv, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted.encryptedData, "hex")), decipher.final()]);
    return JSON.parse(decrypted.toString());
}

async function processTableEncryptedKey(qrData) {
    try {
        const [iv, encryptedData] = qrData.split(":"); // Split into iv and encryptedData
        const result = decryptObject({ iv, encryptedData });
        return result ? result : null;
    } catch (error) {
        console.error("Error processing QR code:", error);
        return null;
    }
}

const hash = (text) => {
    return new Promise(async (resolve, reject) => {
        try {
            bcrypt
                .hash(text, typeof saltRounds === "string" ? JSON.parse(saltRounds) : saltRounds)
                .then((hashedText) => resolve(hashedText))
                .catch((e) => console.log(e));
        } catch (error) {
            reject(`An error occurred while hashing: ${error.message}`);
        }
    });
};

const verifyPassword = (password, hashedPassword) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(password, hashedPassword)
            const comparisonResult = await bcrypt.compare(password, hashedPassword);
            resolve(comparisonResult);
        } catch (error) {
            reject("An error occured while verifying password: ", error);
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
            reject("An error occured while creating the token: ", error);
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

const userExists = async (username, email, phone) => {
    try {
        let sql = `
      SELECT
        *
      FROM
        users
      WHERE
        (username = ? OR email = ? OR phone = ?)
        AND deleted_at IS NULL
    `;
        const result = await executeQuery(sql, [username, email, phone], "userExists");
        if (result && result?.length) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        throw new Error(`An error occurred while checking if user exists: ${error.message}`);
    }
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

            const jwt = headerAuthorization || req?.headers["jwt"] || req?.headers["token"];
            const authorize = await verifyUserToken(jwt);

            if (!authorize || !authorize?.id || !authorize?.email) {
                res.json(resultObject(false, "Token is invalid!"));
                return;
            } else {
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
        if (token) {
            var data = jwt.verify(token, tokenKey);
            if (data?.data) {
                checkDataTokenValidation(data?.data, (result) => {
                    if (result) resolve(data?.data);
                    else resolve(null);
                });
            } else resolve(data?.data);
        } else {
            resultObject(false, "Token must be provided!");
            resolve(false);
        }
    });
};

async function checkDataTokenValidation(data, callback) {
    try {
        var sql = `
            SELECT 
                enabled 
            FROM 
                users 
            WHERE 
                id = ?
            AND
                deleted_at IS NULL
        `;
        const result = await executeQuery(sql, [data.id], "checkDataTokenValidation");
        if (result && result.length > 0 && result[0].enabled) callback(true);
        else callback(false);
    } catch (error) {
        throw new Error(`An error occurred while checking data token validation: ${error.message}`);
    }
}

const getUser = async (username) => {
    try {
        let sql = `
          SELECT
            u.*,
            d.id as department_id,
            d.name AS department_name,
            rest.name AS restaurant_name
          FROM
            users u
          LEFT JOIN
            departments d ON d.id = u.department_id
          LEFT JOIN
            restaurants rest ON rest.id = u.restaurant_id
          WHERE
            u.username = ?
            AND u.deleted_at IS NULL
        `;
        const result = await executeQuery(sql, [username], "getUser");
        if (result && result?.length && result[0]) {
            let user = result[0];
            // Return user with department_id instead of complex roles
            return user;
        } else {
            return null;
        }
    } catch (error) {
        throw new Error(`An error occurred while getting user: ${error.message}`);
    }
};

const getRestaurantLocation = async (id) => {
    try {
        let sql = `
          SELECT
            r.lat,
            r.long
          FROM
            restaurants r
          WHERE
            r.id = ?
        `;
        const result = await executeQuery(sql, [id], "getRestaurantLocation");
        if (result && result?.length && result[0]) {
            let restaurant = result[0];
            return { latitude: restaurant.lat, longitude: restaurant.long };
        } else {
            return null;
        }
    } catch (error) {
        throw new Error(`An error occurred while getting restaurant location: ${error.message}`);
    }
};

const checkCategoryForRestaurant = async (restaurant_id, category_id) => {
    try {
        let sql = `
      SELECT
        id
      FROM
        categories
      WHERE
        restaurant_id = ?
      AND
        id = ?
      AND
        deleted_at IS NULL
    `;
        const result = await executeQuery(sql, [restaurant_id, category_id], "checkCategoryForRestaurant");
        if (result && result?.length) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        throw new Error(`An error occurred while checking category for restaurant: ${error.message}`);
    }
};

const checkSubCategoryForRestaurant = async (restaurant_id, category_id) => {
    try {
        let sql = `
      SELECT
        id
      FROM
        sub_categories
      WHERE
        restaurant_id = ?
      AND
        id = ?
      AND
        deleted_at IS NULL
    `;
        const result = await executeQuery(sql, [restaurant_id, category_id], "checkSubCategoryForRestaurant");
        if (result && result?.length) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        throw new Error(`An error occurred while checking sub category for restaurant: ${error.message}`);
    }
};

module.exports = {
    hash,
    executeQuery,
    executeTransaction,
    buildInsertQuery,
    buildUpdateQuery,
    userExists,
    getUser,
    verifyPassword,
    resultObject,
    createToken,
    verifyUserToken,
    encryptObject,
    decryptObject,
    processTableEncryptedKey,
    checkCategoryForRestaurant,
    checkSubCategoryForRestaurant,
    getRestaurantLocation,
    checkUserAuthorized,
    getToken,
};
