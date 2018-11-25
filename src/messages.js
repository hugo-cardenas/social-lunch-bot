/*
 * The bot will post to this channel the list of groups.
 */
const config = require('./config');

const buildCancelActionAttachment = () => (
  buildAttachmentWithActions([
    {
      "name": "lunch",
      "text": "Cancel",
      "style": "danger",
      "type": "button",
      "value": "leave",
      "confirm": {
        "title": "Are you sure you want to cancel?",
        "text": "Please, don't do it. Think about the kids.",
        "ok_text": "Yes",
        "dismiss_text": "No"
      }
    }
  ])
);

const buildJoinActionAttachment = () => (
  buildAttachmentWithActions([
    {
      "name": "lunch",
      "text": "Join",
      "style": "primary",
      "type": "button",
      "value": "join"
    },
  ])
);

const buildAttachmentWithActions = actions => ({
  "fallback": "You are unable to perform an action",
  "callback_id": "wopr_game",
  "color": "#3AA3E3",
  "attachment_type": "default",
  "actions": actions
});

const getBasicStatusText = lunchDate => (
  `Hi there! :wave:

I'll set you up for an exciting lunch together with 2-4 other random coworkers :awesome: 
Next lunch date is *${lunchDate.format('dddd D.M')}*`
);

const getReminderText = (lunchDate, isToday = false) => (
  `Howdy! :wave:

Reminder, next social lunch is ${isToday ? '*TODAY,* ' : ''}*${lunchDate.format('dddd D.M')}*
Join to have lunch in a group of 3-5 random coworkers! :awesome:

How? - Run the command \`/social-lunch\`, then press \`Join\`!
(you can run it in your private Slack channel - no one will see it except you)`
);

const getTodayLunchText = () => (
  `The lunch groups for today have already been published in ${config.publishChannelId}! :hamburger:`
);

const getTooLateText = () => (
  `The lunch groups for today have already been published in ${config.publishChannelId}! :hamburger:  
\nRun \`/social-lunch\` again after today and join the lunch next week!`
);

const getInvalidActionText = () => (
  `:x: Invalid action.
The lunch groups for today have already been published.`
);

const getJoinedStatusText = lunchDate => (
  `You have joined the next lunch on *${lunchDate.format('dddd D.M')}*! :feelsgoodman:
\nI'll post a list with the lunch groups to ${config.publishChannelId} on *${lunchDate.format('dddd D.M')} at 11.00*.`
);

const getLeftStatusText = lunchDate => (
  `You have left the next lunch on *${lunchDate.format('dddd D.M')}* :feelsbadman:
Please, reconsider your decision.`
);

const getGroupListMessage = (userGroups, lunchDate) => {
  return `These are the lunch groups for today, *${lunchDate.format('dddd D.M')}*:` + '\n\n' +
    userGroups.map((group, i) => {
      return `*Group ${i + 1}:*` + '\n' +
        group.map(userId => `<@${userId}>`).join('\n') +
        '\n';
    })
    .join('\n') + '\n' +
    'Group members, now you can talk to each other :scream: and agree a place/time for lunch.\n' +
    'Bon appétit! :awesome:'
};

const getNoGroupsMessage = () => {
  return 'Too bad! There weren\'t enough people for a social lunch group today (min. 3) :feelsbadman:\n' + 
    'Let\'s hope more people join next time!';
};

module.exports = {
  buildCancelActionAttachment,
  buildJoinActionAttachment,
  getBasicStatusText,
  getReminderText,
  getJoinedStatusText,
  getLeftStatusText,
  getTodayLunchText,
  getTooLateText,
  getInvalidActionText,
  getGroupListMessage,
  getNoGroupsMessage
};
