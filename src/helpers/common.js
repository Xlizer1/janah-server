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
                .catch((e) => console.log(e));
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
};
