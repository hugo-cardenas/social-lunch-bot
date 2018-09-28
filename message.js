/*
 * The bot will post to this channel the list of groups.
 */
const slackChannel = 'lunch-suggestions';

const buildCancelActionAttachment = () => (
  buildAttachmentWithActions([
    {
      "name": "lunch",
      "text": "Leave",
      "style": "danger",
      "type": "button",
      "value": "leave",
      "confirm": {
        "title": "Are you sure you want to leave?",
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
  `:wave: Hi there! [UNDER CONSTRUCTION]

I'll organize for you a social lunch by putting you together with 2 other random coworkers :awesome: 
Next lunch date is *${lunchDate.format('dddd D.M')}*
${getNumUsersText(numUsers)}
`
);

const getJoinedStatusText = (lunchDate, numUsers) => (
  `You have joined the next social lunch on *${lunchDate.format('dddd D.M')}*! :feelsgoodman:
${getNumUsersText(numUsers)}

I'll post a list with the lunch groups to *#${slackChannel}* when the time comes.
`
);

const getLeftStatusText = (lunchDate, numUsers) => (
  `You have left the next social lunch on *${lunchDate.format('dddd D.M')}* :feelsbadman:
${getNumUsersText(numUsers)}

Please, reconsider your decision.
`
);

const getNumUsersText = numUsers => (
  `There are *${numUsers}* people waiting for the next lunch!`
);

module.exports = {
  buildCancelActionAttachment,
  buildJoinActionAttachment,
  getBasicStatusText,
  getJoinedStatusText,
  getLeftStatusText
};
