const version = require("../../../../package.json").version;

const getServerAndAppVersion = async (callBack) => {
    callBack({
        version: version,
        message: "Hello from API",
    });
};

module.exports = {
    ServerAndAppVersion: getServerAndAppVersion,
};
