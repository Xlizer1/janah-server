const db = require("../config/db");
const { DatabaseError } = require("../errors/customErrors");

/**
 * Execute a parameterized query safely
 * @param {string} sql - SQL query with placeholders
 * @param {Array|Object} params - Query parameters
 * @param {string} logName - Name for logging purposes
 * @returns {Promise<any>} Query result
 */
const executeQuery = async (sql, params = [], logName = 'DB Query') => {
    return new Promise((resolve, reject) => {
        try {
            db.query(
                {
                    sql: sql,
                    timeout: 40000,
                    values: params
                },
                (error, result) => {
                    if (!error) {
                        resolve(result);
                    } else {
                        console.error(`${logName} SQL: ${sql}`);
                        console.error(`${logName} Params:`, params);
                        console.error(`${logName} Error:`, error);
                        reject(new DatabaseError(error.message, error));
                    }
                }
            );
        } catch (e) {
            console.error(`Error in db.js -> executeQuery: ${e}`);
            reject(new DatabaseError('Database error occurred', e));
        }
    });
};

/**
 * Execute multiple queries in a transaction
 * @param {Array<{sql: string, params: Array|Object}>} queries - Array of queries with their parameters
 * @param {string} logName - Name for logging purposes
 * @returns {Promise<Array>} Array of results
 */
const executeTransaction = async (queries, logName = 'Transaction') => {
    const connection = await new Promise((resolve, reject) => {
        db.mysqlConnection.getConnection((err, conn) => {
            if (err) {
                console.error(`${logName} Connection Error:`, err);
                reject(new DatabaseError('Failed to get database connection', err));
                return;
            }
            resolve(conn);
        });
    });

    try {
        await new Promise((resolve, reject) => {
            connection.beginTransaction(err => {
                if (err) {
                    reject(new DatabaseError('Failed to start transaction', err));
                    return;
                }
                resolve();
            });
        });

        const results = [];
        for (const query of queries) {
            const result = await new Promise((resolve, reject) => {
                connection.query(
                    {
                        sql: query.sql,
                        timeout: 40000,
                        values: query.params
                    },
                    (error, result) => {
                        if (error) {
                            console.error(`${logName} SQL: ${query.sql}`);
                            console.error(`${logName} Params:`, query.params);
                            console.error(`${logName} Error:`, error);
                            reject(new DatabaseError(error.message, error));
                            return;
                        }
                        resolve(result);
                    }
                );
            });
            results.push(result);
        }

        await new Promise((resolve, reject) => {
            connection.commit(err => {
                if (err) {
                    reject(new DatabaseError('Failed to commit transaction', err));
                    return;
                }
                resolve();
            });
        });

        return results;
    } catch (error) {
        await new Promise(resolve => {
            connection.rollback(() => resolve());
        });
        throw new DatabaseError(error.message || 'Transaction failed', error);
    } finally {
        connection.release();
    }
};

/**
 * Build a safe INSERT query
 * @param {string} table - Table name
 * @param {Object} data - Data to insert
 * @returns {{sql: string, params: Array}} Query object
 */
const buildInsertQuery = (table, data) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = new Array(keys.length).fill('?').join(', ');
    
    return {
        sql: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
        params: values
    };
};

/**
 * Build a safe UPDATE query
 * @param {string} table - Table name
 * @param {Object} data - Data to update
 * @param {Object} where - Where conditions
 * @returns {{sql: string, params: Array}} Query object
 */
const buildUpdateQuery = (table, data, where) => {
    const setKeys = Object.keys(data);
    const whereKeys = Object.keys(where);
    
    const setClause = setKeys.map(key => `${key} = ?`).join(', ');
    const whereClause = whereKeys.map(key => `${key} = ?`).join(' AND ');
    
    return {
        sql: `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`,
        params: [...Object.values(data), ...Object.values(where)]
    };
};

module.exports = {
    executeQuery,
    executeTransaction,
    buildInsertQuery,
    buildUpdateQuery
};
