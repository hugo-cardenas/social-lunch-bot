const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment');
const fetch = require('node-fetch');
const { CronJob } = require('cron');
const {
  buildCancelActionAttachment,
  buildJoinActionAttachment,
  getBasicStatusText,
  getReminderText,
  getJoinedStatusText,
  getLeftStatusText,
  getTodayLunchText,
  getTooLateText,
  getGroupListMessage
} = require('./messages');
const {
  getUsers,
  addUser,
  removeUser,
  saveGroups,
  getGroups
} = require('./db');
const {
  getNextLunchDate,
  isLunchDayAfterPublish
} = require('./date');
const createGroups = require('./createGroups');
const verifySignature = require('./verifySignature');
const config = require('./config');

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
    console.log('BODY', body);
    console.log('HEADERS', req.headers);
    if (body.command === '/social-lunch') {
      res.send();

      if (body.text === 'groups') {
        // List lunch groups if already generated for today
        if (isLunchDayAfterPublish()) {
          readGroupsAndSendMessage(getNextLunchDate());
        }
      } else {
        // Default functionality
        const statusBody = await getStatus(body.user_id);
        statusBody.replace_original = true;
        sendSlackRequest(body.response_url, statusBody);
      }

    } else {
      throw new Error('Invalid command');
    }
  } catch (error) {
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
    console.log('BODY', body);
    console.log('HEADERS', req.headers);

    const payload = body.payload ? JSON.parse(body.payload) : {};
    if (payload.type === 'interactive_message' && payload.actions && payload.actions[0]) {
      if (isLunchDayAfterPublish()) {
        console.log('LUNCH DAY AFTER PUBLISH');
        const body = {
          text: hasUserJoined ? getTodayLunchText() : getTooLateText()
        };
        sendSlackRequest(payload.response_url, body);
        return;
      }

      const action = payload.actions[0];
      if (action.name === 'lunch' && action.value === 'join') {
        console.log('JOINED');
        const body = await join(payload.user.id);
        sendSlackRequest(payload.response_url, body);
        return;

      } else if (action.name === 'lunch' && action.value === 'leave') {
        console.log('CANCELED');
        const body = await leave(payload.user.id);
        sendSlackRequest(payload.response_url, body);
        return;
      }
    }
  } catch (error) {
    next(error);
  }
});

app.listen(8000, () => console.log('App listening on port 8000!'));

// ---------------

const sendSlackRequest = (responseUrl, bodyObj) => {
  fetch(responseUrl, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify(bodyObj)
  });
};

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
    }
  }
}

const join = async userId => {
  await addUser(userId);

  const lunchDate = getNextLunchDate();
  const users = await getUsers(lunchDate);

  const userIds = Object.keys(users);
  const numUsers = userIds.length;

  return {
    text: getJoinedStatusText(lunchDate, numUsers),
    attachments: [buildCancelActionAttachment()]
  };
};

const leave = async userId => {
  await removeUser(userId);

  const lunchDate = getNextLunchDate();
  const users = await getUsers(lunchDate);

  const userIds = Object.keys(users);
  const numUsers = userIds.length;

  return {
    text: getLeftStatusText(lunchDate, numUsers),
    attachments: [buildJoinActionAttachment()]
  };
};

// ----------------

const generateLunchGroups = async date => {
  const users = await getUsers(date);
  const userIds = Object.keys(users);
  return createGroups(userIds);
};

// -------- CRON ------------

const generateGroupsAndSendMessage = async () => {
  // TODO Add retries if failure for these actions
  try {
    const date = getNextLunchDate();
    const groups = await generateLunchGroups(date);
    await saveGroups(date, groups);
    sendGroupsMessage(groups, date);
  } catch (error) {
    console.log('Generating groups failed', error);
  }
}

const readGroupsAndSendMessage = async date => {
  const groups = await getGroups(date);
  sendGroupsMessage(groups, date);
}

const sendGroupsMessage = (groups, date) => {
  const message = getGroupListMessage(groups, date);
  return sendSlackRequest(config.publishChannelUrl, {
    text: message
  });
}

const sendReminder = async () => {
  const date = getNextLunchDate();
  const users = await getUsers(date);
  const userIds = Object.keys(users);
  const numUsers = userIds.length;
  const isLunchDay = moment().day() === config.lunchDay;
  
  return sendSlackRequest(config.publishChannelUrl, {
    text: getReminderText(date, numUsers, isLunchDay)
  });
}

/*
 * Generate and publish lunch groups on the lunch day at publish hour
 */
new CronJob(`0 0 ${config.publishHour} * * ${config.lunchDay}`, async () => {
  generateGroupsAndSendMessage();
}, null, true, 'Europe/Helsinki');

/*
 * Send reminder on the lunch day at 9.00
 */
new CronJob(`0 0 9 * * ${config.lunchDay}`, async () => {
  sendReminder();
}, null, true, 'Europe/Helsinki');
