const { ServerAndAppVersion } = require("./controller");

const express = require("express");

const router = express.Router();

router.get("/", (request, response) => {
  ServerAndAppVersion(request, (result) => {
    response.json(result);
  });
});

module.exports = router;
