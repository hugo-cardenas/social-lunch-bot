const { CronJob } = require('cron');
const config = require('./config');
const { generateGroupsAndSendMessage } = require('./group');
const { sendReminder } = require('./reminder');

const setPublishGroupsCron = () => {
  /*
   * Generate and publish lunch groups on the lunch day at publish hour
   */
  new CronJob({
    cronTime: `0 0 ${config.publishHour} * * ${config.lunchDay}`,
    onTick: () => {
      generateGroupsAndSendMessage();
    },
    start: true,
    utcOffset: config.utcOffset
  });
};

const setReminderCron = () => {
  /*
   * Send reminder on the lunch day at 9.00
   */
  new CronJob({
    cronTime: `0 0 9 * * ${config.lunchDay}`,
    onTick: () => {
      sendReminder();
    },
    start: true,
    utcOffset: config.utcOffset
  });
};

module.exports = {
  setPublishGroupsCron,
  setReminderCron
};
