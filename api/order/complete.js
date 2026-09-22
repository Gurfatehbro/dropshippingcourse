const handleRequest = require('../../server.js');

module.exports = async (req, res) => {
  req.endpoint = '/api/order/complete';
  return handleRequest(req, res);
};
