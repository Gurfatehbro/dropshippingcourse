const handleRequest = require('../../server.js');

module.exports = async (req, res) => {
  req.endpoint = '/api/admin/capi-test';
  return handleRequest(req, res);
};
