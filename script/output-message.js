const {
  buildCancelActionAttachment,
  buildJoinActionAttachment,
  getBasicStatusText,
  getJoinedStatusText,
  getLeftStatusText,
  getTodayLunchText,
  getTooLateText,
  getReminderText,
  getGroupListMessage
} = require('../src/messages');
const moment = require('moment');

console.log(JSON.stringify({
  text: getBasicStatusText(moment(), true),
  attachments: [buildJoinActionAttachment()]
}));
