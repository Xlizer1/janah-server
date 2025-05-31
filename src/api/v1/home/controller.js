const { ServerAndAppVersion } = require("./model");

const getServerAndAppVersion = async (request, callBack) => {
  ServerAndAppVersion((result) => {
    callBack(result);
  });
};

module.exports = {
  ServerAndAppVersion: getServerAndAppVersion,
};
