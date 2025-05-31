const { handleError } = require("./src/middleware/errorHandler");
const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const { resultObject } = require("./src/helpers/common");

const app = express();

app.use(
    cors({
        origin: ["http://localhost:3000"],
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
        optionsSuccessStatus: 200,
    })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

app.use("/uploads", express.static(__dirname + "/uploads"));
app.use("/uploads/files", express.static(path.join(__dirname, "/../../../uploads")));

const apiRoutes = require("./src/api");

app.use("/api", apiRoutes);

app.use((req, res, next) => {
    res.status(404).json(resultObject(false, "Endpoint was not found"));
});

app.use(handleError);

module.exports = app;
