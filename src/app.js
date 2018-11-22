const express = require('express');
const bodyParser = require('body-parser');
const {
  buildCancelActionAttachment,
  buildJoinActionAttachment,
  getBasicStatusText,
  getJoinedStatusText,
  getLeftStatusText,
  getTodayLunchText,
  getTooLateText
} = require('./messages');
const {
  getUsers,
  addUser,
  removeUser
} = require('./db');
const {
  getNextLunchDate,
  isLunchDayAfterPublish
} = require('./date');
const { sendSlackRequest } = require('./request');
const verifySignature = require('./verifySignature');
const { WError } = require('verror');
const log = require('./log');
const {
  setPublishGroupsCron,
  setReminderCron
} = require('./cron');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
  res.send();
});

app.post('/', async (req, res, next) => {
  try {
    verifySignature(req);
    const { body } = req;
    const command = body.command;
    if (command === '/social-lunch') {
      res.send();
      const statusBody = await getStatus(body.user_id);
      statusBody.replace_original = true;
      sendSlackRequest(body.response_url, statusBody);
    } else {
      throw new Error(`Invalid command: ${command}`);
    }
  } catch (e) {
    const error = new WError(e, 'Command failed');
    log(error);
    next(error);
  }
});

/*
 * After pressing a button in one of the Bot messages (Join or Cancel)
 */
app.post('/action', async (req, res, next) => {
  try {
    verifySignature(req);

    res.send();
    const { body } = req;

    const payload = body.payload ? JSON.parse(body.payload) : {};
    if (payload.type === 'interactive_message' && payload.actions && payload.actions[0]) {
      if (isLunchDayAfterPublish()) {
        const body = {
          text: hasUserJoined ? getTodayLunchText() : getTooLateText()
        };
        sendSlackRequest(payload.response_url, body);
        return;
      }

      const action = payload.actions[0];
      if (action.name === 'lunch' && action.value === 'join') {
        log('JOINED');
        const body = await join(payload.user.id);
        sendSlackRequest(payload.response_url, body);
        return;

      } else if (action.name === 'lunch' && action.value === 'leave') {
        log('CANCELED');
        const body = await leave(payload.user.id);
        sendSlackRequest(payload.response_url, body);
        return;
      }
    }
  } catch (e) {
    const error = new WError(e, 'Action failed');
    log(error);
    next(error);
  }
});

app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message
  });
});

// ---------------

const getStatus = async userId => {
  const lunchDate = getNextLunchDate();
  const users = await getUsers(lunchDate);

  const userIds = Object.keys(users);
  const numUsers = userIds.length;

  const hasUserJoined = userIds.includes(userId);

  if (isLunchDayAfterPublish()) {
    return {
      text: hasUserJoined ? getTodayLunchText() : getTooLateText()
    };
  } else {
    return hasUserJoined ? {
      text: getJoinedStatusText(lunchDate, numUsers),
      attachments: [buildCancelActionAttachment()]
    } : {
      text: getBasicStatusText(lunchDate, numUsers),
      attachments: [buildJoinActionAttachment()]
    };
  }
};

const join = async userId => {
  const lunchDate = getNextLunchDate();
  await addUser(lunchDate, userId);
  const users = await getUsers(lunchDate);

  const userIds = Object.keys(users);
  const numUsers = userIds.length;

  return {
    text: getJoinedStatusText(lunchDate, numUsers),
    attachments: [buildCancelActionAttachment()]
  };
};

const leave = async userId => {
  const lunchDate = getNextLunchDate();
  await removeUser(lunchDate, userId);
  const users = await getUsers(lunchDate);

  const userIds = Object.keys(users);
  const numUsers = userIds.length;

  return {
    text: getLeftStatusText(lunchDate, numUsers),
    attachments: [buildJoinActionAttachment()]
  };
};

module.exports = app;

setPublishGroupsCron();
setReminderCron();
