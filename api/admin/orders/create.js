const handleRequest = require('../../../server.js');

module.exports = async (req, res) => {
  req.endpoint = '/api/admin/orders/create';
  return handleRequest(req, res);
};
