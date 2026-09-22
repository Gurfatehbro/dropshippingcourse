const handleRequest = require('../../server.js');

module.exports = async (req, res) => {
  req.endpoint = '/api/admin/orders';
  return handleRequest(req, res);
};
