const mysql = require("mysql2");
const { DB_NAME, DB_HOST, DB_USER, DB_PASSWORD } = process.env;

const host = DB_HOST || "localhost";
const user = DB_USER || "root";
const password = DB_PASSWORD || "";
const database = DB_NAME || "kitedb";

let con = null;
let connectionReady = false;
let pendingQueries = [];

function connectWithRetry() {
    console.log("Trying to connect to the DB");
    con = mysql.createConnection({
        host,
        user,
        password,
        database,
        multipleStatements: true,
        charset: "utf8",
    });

    con.connect((err) => {
        if (err) {
            console.error("Error in DB connection:", err);
            console.log("Retrying DB connection in 5 seconds...");
            connectionReady = false;
            setTimeout(connectWithRetry, 5000);
        } else {
            console.log("DB Connected to:", database);
            connectionReady = true;

            while (pendingQueries.length > 0) {
                const { sqlOrOptions, paramsOrCallback, callbackOrUndefined } = pendingQueries.shift();
                con.query(sqlOrOptions, paramsOrCallback, callbackOrUndefined);
            }
        }
    });

    con.on("error", (err) => {
        if (err.code === "PROTOCOL_CONNECTION_LOST") {
            console.error("Database connection lost");
            console.log("Retrying DB connection in 5 seconds...");
            connectionReady = false;
            setTimeout(connectWithRetry, 5000);
        } else {
            console.error("Fatal error encountered:", err);
            connectionReady = false;
            if (con) con.destroy();
            setTimeout(connectWithRetry, 5000);
        }
    });
}

connectWithRetry();

module.exports.query = function (sqlOrOptions, paramsOrCallback, callbackOrUndefined) {
    const callback = typeof paramsOrCallback === "function" ? paramsOrCallback : callbackOrUndefined;

    if (!connectionReady) {
        console.log("Connection not ready, queueing query or executing immediately after connection");

        if (callback && typeof callback === "function") {
            pendingQueries.push({ sqlOrOptions, paramsOrCallback, callbackOrUndefined });
        } else {
            if (callback) callback(new Error("No database connection available"), null);
        }
        return;
    }

    con.query(sqlOrOptions, paramsOrCallback, callbackOrUndefined);
};

module.exports.mysqlConnection = {
    getConnection: function (callback) {
        if (!connectionReady) {
            console.error("Cannot get connection, connection not ready");
            callback(new Error("No database connection available"), null);
            return;
        }

        callback(null, {
            query: con.query.bind(con),
            beginTransaction: con.beginTransaction.bind(con),
            commit: con.commit.bind(con),
            rollback: con.rollback.bind(con),
            release: function () {},
        });
    },
};
