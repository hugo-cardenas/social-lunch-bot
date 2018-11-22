const { CronJob } = require('cron');
const config = require('./config');
const { generateGroupsAndSendMessage } = require('./group');
const { sendReminder } = require('./reminder');

const setPublishGroupsCron = () => {
  /*
   * Generate and publish lunch groups on the lunch day at publish hour
   */
  new CronJob(`0 0 ${config.publishHour} * * ${config.lunchDay}`, async () => {
    generateGroupsAndSendMessage();
  }, null, true, 'Europe/Helsinki');
};

const setReminderCron = () => {
  /*
   * Send reminder on the lunch day at 9.00
   */
  new CronJob(`0 0 9 * * ${config.lunchDay}`, async () => {
    sendReminder();
  }, null, true, 'Europe/Helsinki');
};

module.exports = {
  setPublishGroupsCron,
  setReminderCron
};
