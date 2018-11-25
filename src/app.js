const express = require('express');
const bodyParser = require('body-parser');
const {
  buildCancelActionAttachment,
  buildJoinActionAttachment,
  getBasicStatusText,
  getJoinedStatusText,
  getLeftStatusText,
  getTodayLunchText,
  getTooLateText,
  getInvalidActionText
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
    const { body } = req;

    const payload = body.payload ? JSON.parse(body.payload) : {};
    if (payload.type === 'interactive_message' && payload.actions && payload.actions[0]) {
      const action = payload.actions[0];
      if (action.name === 'lunch' && action.value === 'join') {
        res.send();
        log('JOINED');
        const body = await join(payload.user.id);
        sendSlackRequest(payload.response_url, body);
        return;

      } else if (action.name === 'lunch' && action.value === 'leave') {
        res.send();
        log('CANCELED');
        const body = await leave(payload.user.id);
        sendSlackRequest(payload.response_url, body);
        return;
      } else {
        throw new Error(`Invalid action ${JSON.stringify(action)}`);
      }
    } else {
      throw new Error('Invalid payload');
    }
  } catch (e) {
    const error = new WError(e, 'Action failed');
    log(error);
    next(error);
  }
});

app.use((err, req, res) => {
  res.status(500).json({
    error: err.message
  });
});

// ---------------

const getStatus = async userId => {
  const lunchDate = getNextLunchDate();
  const users = await getUsers(lunchDate);

  const userIds = Object.keys(users);
  const hasUserJoined = userIds.includes(userId);

  if (isLunchDayAfterPublish()) {
    return {
      text: hasUserJoined ? getTodayLunchText() : getTooLateText()
    };
  } else {
    return hasUserJoined ? {
      text: getJoinedStatusText(lunchDate),
      attachments: [buildCancelActionAttachment()]
    } : {
      text: getBasicStatusText(lunchDate),
      attachments: [buildJoinActionAttachment()]
    };
  }
};

const join = async userId => {
  if (isLunchDayAfterPublish()) {
    return {
      text: getInvalidActionText()
    };
  }

  const lunchDate = getNextLunchDate();
  await addUser(lunchDate, userId);
  return {
    text: getJoinedStatusText(lunchDate),
    attachments: [buildCancelActionAttachment()]
  };
};

const leave = async userId => {
  if (isLunchDayAfterPublish()) {
    return {
      text: getInvalidActionText()
    };
  }
  
  const lunchDate = getNextLunchDate();
  await removeUser(lunchDate, userId);
  return {
    text: getLeftStatusText(lunchDate),
    attachments: [buildJoinActionAttachment()]
  };
};

module.exports = app;

setPublishGroupsCron();
setReminderCron();
