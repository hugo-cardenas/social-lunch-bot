const moment = require('moment');
const config = require('../config');

const now = () => moment().utcOffset(config.utcOffset);

module.exports = {
  now
};
