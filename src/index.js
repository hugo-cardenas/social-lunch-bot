const crypto = require('crypto');
const qs = require('qs');
const express = require('express');
const bodyParser = require('body-parser');
const firebase = require('firebase-admin');
const moment = require('moment');
const fetch = require('node-fetch');
const shuffle = require('array-shuffle');
const { CronJob } = require('cron');

const slackToken = process.env.SLACK_TOKEN;
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

const PUBLISH_HOUR = 11;
const LUNCH_DAY = 6;

const {
  buildCancelActionAttachment,
  buildJoinActionAttachment,
  getBasicStatusText,
  getJoinedStatusText,
  getLeftStatusText,
  getTodayLunchText,
  getTooLateText
} = require('./message');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Init Firebase
firebase.initializeApp({
  credential: firebase.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }),
  databaseURL: `https://${process.env.FIREBASE_DB_NAME}.firebaseio.com`
});

const database = firebase.app().database();

app.post('/', async (req, res, next) => {
  try {
    verifySignature(req);
    const { body } = req;
    console.log('BODY', body);
    console.log('HEADERS', req.headers);
    if (body.command === '/social-lunch') {
      res.send();
      const statusBody = await getStatus(body.user_id);
      statusBody.replace_original = true;
      sendSlackRequest(body.response_url, statusBody);
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
app.post('/action', async (req, res) => {
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

const verifySignature = req => {
  const slackSignature = req.headers['x-slack-signature'];
  const rawBody = qs.stringify(req.body, { format: 'RFC1738' });
  const timestamp = req.headers['x-slack-request-timestamp'];

  var currentTime = Math.floor(new Date().getTime() / 1000);
  if (Math.abs(currentTime - timestamp) > 60 * 5) {
    /*
     * The request timestamp is more than five minutes from local time.
     * It could be a replay attack, so let's ignore it.
     */
    throw new Error('Request timestamp is more than 5min difference from local time');
  }

  if (!slackSigningSecret) {
    throw new Error('Empty Slack signing secret');
  }

  const signatureBaseString = `v0:${timestamp}:${rawBody}`;
  const mySignature = 'v0=' +
    crypto.createHmac('sha256', slackSigningSecret)
      .update(signatureBaseString, 'utf8')
      .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(slackSignature, 'utf8'))
  ) {
    throw new Error('Signature verification failed');
  }
};

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
  const users = await getNextOpenLunchUsers();

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
  const users = await getNextOpenLunchUsers();

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
  const users = await getNextOpenLunchUsers();

  const userIds = Object.keys(users);
  const numUsers = userIds.length;

  return {
    text: getLeftStatusText(lunchDate, numUsers),
    attachments: [buildJoinActionAttachment()]
  };
};

const getSlackUsers = () => {
  fetch()
}

// DB 

const getUsersRef = date => (
  console.log(date) ||
  database.ref(`lunchEvents/${date.format('YYYYMMDD')}/users`)
);

const getNextOpenLunchUsersRef = () => (
  getUsersRef(getNextLunchDate())
);

const getNextOpenLunchUsers = () => {
  return getUsers(getNextLunchDate());
}

const getUsers = date => {
  const usersRef = getUsersRef(date);
  return new Promise(resolve => {
    usersRef.once("value", function (data) {
      const users = data.toJSON();
      resolve(users ? users : []);
    });
  })
};

const addUser = userId => (
  getNextOpenLunchUsersRef().child(userId).set(true)
);

const removeUser = userId => (
  getNextOpenLunchUsersRef().child(userId).remove()
);

// --

const getNextLunchDate = () => {
  let lunchDate = moment();
  while (lunchDate.day() !== LUNCH_DAY) {
    lunchDate.add(1, 'days');
    lunchDate.hour(0);
  }
  return lunchDate;
};

const isLunchDayAfterPublish = () => {
  const now = moment();
  return now.day() === LUNCH_DAY && now.hour() >= PUBLISH_HOUR;
};

const generateLunchGroups = async date => {
  const users = await getUsers(date);
  const userIds = Object.keys(users);

  const shuffledIds = shuffle(userIds);
  const groups = [];
  while (shuffledIds.length >= 6) {
    groups.push(shuffledIds.splice(0, 3));
  }
  groups.push(shuffledIds);

  return groups;
};

// CRON

new CronJob('* * * * * *', async () => {
  // const groups = await generateLunchGroups(getNextLunchDate());
  // console.log(groups);

}, null, true, 'Europe/Helsinki');
