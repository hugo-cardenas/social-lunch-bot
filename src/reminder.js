const { getNextLunchDate } = require('./date');
const { getUsers } = require('./db');
const moment = require('moment');
const config = require('./config');
const { sendSlackRequest } = require('./request');
const { getReminderText } = require('./messages');


const sendReminder = async () => {
  const date = getNextLunchDate();
  const users = await getUsers(date);
  const userIds = Object.keys(users);
  const numUsers = userIds.length;
  const isLunchDay = moment().day() === config.lunchDay;

  return sendSlackRequest(config.publishChannelUrl, {
    text: getReminderText(date, numUsers, isLunchDay)
  });
};

module.exports = {
  sendReminder
};