const handleRequest = require('../../server.js');

module.exports = async (req, res) => {
  req.endpoint = '/api/admin/health';
  return handleRequest(req, res);
};
