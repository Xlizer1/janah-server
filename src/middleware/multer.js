const multer = require("multer");
var maxSize= process.env.maxFileSize === undefined ? 50 * 1024 * 1024 : process.env.maxFileSize; //default 3MB

exports.handle = (err, res) => {
    res.contentType("text/plain")
        .end("Oops! Something went wrong!");
};

exports.upload = multer({
    dest: __dirname + '/../../uploads/temp/',
    limits: { fileSize: maxSize }
});
