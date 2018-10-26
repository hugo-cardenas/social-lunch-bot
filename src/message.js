/*
 * The bot will post to this channel the list of groups.
 */
const slackChannel = '#lunch-suggestions';

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

const buildAttachmentWithActions = actions => (
  {
    "fallback": "You are unable to perform an action",
    "callback_id": "wopr_game",
    "color": "#3AA3E3",
    "attachment_type": "default",
    "actions": actions
  }
);

const getBasicStatusText = (lunchDate, numUsers) => (
  `Hi there! :wave: [UNDER CONSTRUCTION]

I'll set you up for a social lunch by shuffling you with 2-4 other random coworkers :awesome: 
Next lunch date is *${lunchDate.format('dddd D.M')}*
${getNumUsersText(numUsers)}`
);

const getTodayLunchText = () => (
  `This week's lunch day is today :hamburger:

Check the lunch groups published in *${slackChannel}*!`
);

const getTooLateText = () => (
  `This week's lunch day is today :hamburger:
Unfortunately, the groups have already been published in *${slackChannel}*, so it's too late to join this time, sorry.

Run */social-lunch* again after today to join the lunch next week!`
);

const getJoinedStatusText = (lunchDate, numUsers) => (
  `You have joined the next social lunch on *${lunchDate.format('dddd D.M')}*! :feelsgoodman:
${getNumUsersText(numUsers)}
I'll post a list with the lunch groups to *${slackChannel}* on *${lunchDate.format('dddd D.M')} at 11.00*.
`
);

const getLeftStatusText = (lunchDate, numUsers) => (
  `You have left the next social lunch on *${lunchDate.format('dddd D.M')}* :feelsbadman:
${getNumUsersText(numUsers)}
Please, reconsider your decision.
`
);

const getNumUsersText = numUsers => (
  numUsers > 0 ? 
  `There are *${numUsers}* people waiting for the next lunch!` + '\n' :
  ''
);

module.exports = {
  buildCancelActionAttachment,
  buildJoinActionAttachment,
  getBasicStatusText,
  getJoinedStatusText,
  getLeftStatusText,
  getTodayLunchText,
  getTooLateText
};
