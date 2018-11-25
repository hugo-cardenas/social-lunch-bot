const { getNextLunchDate, isLunchDay } = require('./date');
const config = require('./config');
const { sendSlackRequest } = require('./request');
const { getReminderText } = require('./messages');


const sendReminder = async () => {
  const date = getNextLunchDate();
  const isTodayLunchDay = isLunchDay();

  return sendSlackRequest(config.publishChannelUrl, {
    text: getReminderText(date, isTodayLunchDay)
  });
};

module.exports = {
  sendReminder
};