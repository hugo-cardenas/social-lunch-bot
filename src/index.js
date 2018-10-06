const express = require('express');
const bodyParser = require('body-parser');
const firebase = require('firebase-admin');
const moment = require('moment');
const fetch = require('node-fetch');
const shuffle = require('array-shuffle');
const { CronJob } = require('cron');

const slackToken = process.env.SLACK_TOKEN;

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

app.get('/', async (req, res) => {
  console.log('GET');
  res.send('Hello World!');

  // addUser('1024');

  // const groups = await generateLunchGroups(getNextLunchDate());
  // console.log(groups);
});

app.post('/', async (req, res) => {
  const { body } = req;
  console.log(body);
  if (body.type === 'url_verification') {
    // Verify token
    if (body.token !== slackToken) {
      res.status(400).send('Invalid token');
      return;
    }

    res.json({ challenge: body.challenge });
    return;
    /*
     * Main command entry point
     */
  } else if (body.command === '/social-lunch') {
    res.send();
    const statusBody = await getStatus(body.user_id);
    statusBody.replace_original = true;
    console.log(statusBody);
    sendSlackRequest(body.response_url, statusBody);
  } else {
    console.log(body);
    res.send();
  }
});

/*
 * After pressing a button in one of the Bot messages (Join or Cancel)
 */
app.post('/action', async (req, res) => {
  res.send();

  const { body } = req;
  console.log('BODY', body);
  const payload = body.payload ? JSON.parse(body.payload) : {};

  if (payload.type === 'interactive_message' && payload.actions && payload.actions[0]) {
    if (isLunchDayAfterPublish()) {
      const body = {
        text: hasUserJoined ? getTodayLunchText() : getTooLateText()
      };
      sendSlackRequest(payload.response_url, body);
    }

    const action = payload.actions[0];
    if (action.name === 'lunch' && action.value === 'join') {
      console.log('JOINED');

      const body = await join(payload.user.id);
      sendSlackRequest(payload.response_url, body);

    } else if (action.name === 'lunch' && action.value === 'leave') {
      console.log('CANCELED');

      const body = await leave(payload.user.id);
      sendSlackRequest(payload.response_url, body);

    }
  }
});

// app.post('/foo', (req, res, next) => handleError(req, res, next, async (req, res) => {




// });

app.listen(8000, () => console.log('App listening on port 8000!'));

// Controllers

const handleError = async (req, res, next, func) => {
  try {
    await func(req, res);
  } catch (error) {
    next(error);
  }
}

const main = () => {

}



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
    text: getJoinedStatusText(lunchDate, numUsers)
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
