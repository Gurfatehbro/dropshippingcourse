const handleRequest = require('../../server.js');

module.exports = async (req, res) => {
  req.endpoint = '/api/order/initiate';
  return handleRequest(req, res);
};
