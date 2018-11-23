const { getNextLunchDate } = require('./date');
const moment = require('moment');
const config = require('./config');
const { sendSlackRequest } = require('./request');
const { getReminderText } = require('./messages');


const sendReminder = async () => {
  const date = getNextLunchDate();
  const isLunchDay = moment().day() === config.lunchDay;

  return sendSlackRequest(config.publishChannelUrl, {
    text: getReminderText(date, isLunchDay)
  });
};

module.exports = {
  sendReminder
};