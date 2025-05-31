require("dotenv").config();
require("./src/config/db");
const { IP, PORT } = process.env;

const http = require("http");

const app = require("./app");

const ip = IP || "localhost";
const port = PORT || "8000";

const server = http.createServer(app);

server.listen(port).on("error", (e) => {
    console.log(e);
});

console.log("**********" + ip + ":" + port + "**********");
