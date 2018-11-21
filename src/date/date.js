const moment = require('moment');
const { now } = require('./utils');
const config = require('../config');

const getNextLunchDate = () => {
  let lunchDate = now();
  while (lunchDate.day() !== config.lunchDay) {
    lunchDate.add(1, 'days');
    lunchDate.hour(0);
  }
  return lunchDate;
};

const isLunchDayAfterPublish = () => {
  const date = now();
  return date.day() === config.lunchDay && date.hour() >= config.publishHour;
};

module.exports = {
  getNextLunchDate,
  isLunchDayAfterPublish
};
