const moment = require('moment');
const config = require('./config');

const getNextLunchDate = () => {
  let lunchDate = moment();
  while (lunchDate.day() !== config.lunchDay) {
    lunchDate.add(1, 'days');
    lunchDate.hour(0);
  }
  return lunchDate;
};

const isLunchDayAfterPublish = () => {
  const now = moment();
  return now.day() === config.lunchDay && now.hour() >= config.publishHour;
};

module.exports = {
  getNextLunchDate,
  isLunchDayAfterPublish
};
