/*
 * The bot will post to this channel the list of groups.
 */
const slackChannel = '<#C6N8X0SUV|helsinki_general>';

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
  `Hi there! :wave:

I'll set you up for an exciting lunch together with 2-4 other random coworkers :awesome: 
Next lunch date is *${lunchDate.format('dddd D.M')}*
${getNumUsersText(numUsers)}`
);

const getReminderText = (lunchDate, numUsers) => (
  `Hi all! :wave:

Remember, I'm arranging once every week an exciting lunch event, shuffling people in groups of 3-5 random coworkers who will go together for lunch :awesome:
Next lunch date is *${lunchDate.format('dddd D.M')}*
${getNumUsersText(numUsers)}

Join now by running the command \`/social-lunch\`!
(you can run it in your private Slack channel - no one will see it except you)`
);

const getTodayLunchText = () => (
  `This week's lunch day is today :hamburger:

Check the lunch groups published in ${slackChannel}!`
);

const getTooLateText = () => (
  `This week's lunch day is today :hamburger:
Unfortunately, the lunch groups have already been generated (check ${slackChannel}), so it's too late to join this time, sorry.

Run \`/social-lunch\` again after today to join the lunch next week!`
);

const getJoinedStatusText = (lunchDate, numUsers) => (
  `You have joined the next lunch on *${lunchDate.format('dddd D.M')}*! :feelsgoodman:
${getNumUsersText(numUsers)}
I'll post a list with the lunch groups to ${slackChannel} on *${lunchDate.format('dddd D.M')} at 11.00*.
`
);

const getLeftStatusText = (lunchDate, numUsers) => (
  `You have left the next lunch on *${lunchDate.format('dddd D.M')}* :feelsbadman:
${getNumUsersText(numUsers)}
Please, reconsider your decision.
`
);

const getNumUsersText = numUsers => (
  numUsers > 6 ? 
  `There are *${numUsers}* people waiting for the next lunch!` + '\n' :
  ''
);

const getGroupListMessage = (userGroups, lunchDate) => {
  return `These are the lunch groups for today, *${lunchDate.format('dddd D.M')}*:` + '\n\n' +
    userGroups.map((group, i) => {
      return `*Group ${i + 1}:*` + '\n' + 
        group.map(userId => `<@${userId}>`).join('\n') + 
        '\n';
    })
    .join('\n') +
    '\n' +
    'Have fun! :awesome:'
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
  getGroupListMessage
};
