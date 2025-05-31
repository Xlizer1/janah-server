const express = require("express");
const router = express.Router();

const homeRouter = require("./home/router");

router.use("/", homeRouter);

module.exports = router;