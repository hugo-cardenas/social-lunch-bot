const express = require('express');
const bodyParser = require('body-parser');
const firebase = require('firebase-admin');
const moment = require('moment');
const fetch = require('node-fetch');
const shuffle = require('array-shuffle');

const slackToken = process.env.SLACK_TOKEN;

const {
  buildCancelActionAttachment,
  buildJoinActionAttachment,
  getBasicStatusText,
  getJoinedStatusText,
  getLeftStatusText
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

  generateLunchGroups();
});

app.post('/', async (req, res) => {
  const { body } = req;
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

  const { body } = req;
  console.log('BODY', body);
  const payload = body.payload ? JSON.parse(body.payload) : {};
  
  if (payload.type === 'interactive_message' && payload.actions && payload.actions[0]) {
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
  const users = await getJoinedUsers();

  const userIds = Object.keys(users);
  const numUsers = userIds.length;
  const hasUserJoined = userIds.includes(userId);
  console.log(userIds, userId);
  const body = hasUserJoined ?
    {
      text: getJoinedStatusText(lunchDate, numUsers),
      attachments: [buildCancelActionAttachment()]
    } :
    {
      text: getBasicStatusText(lunchDate, numUsers),
      attachments: [buildJoinActionAttachment()]
    }

  return body;
}

const join = async userId => {
  await addUser(userId);

  const lunchDate = getNextLunchDate();
  const users = await getJoinedUsers();

  const userIds = Object.keys(users);
  const numUsers = userIds.length;

  return {
    text: getJoinedStatusText(lunchDate, numUsers)
  };
};

const leave = async userId => {
  await removeUser(userId);
  
  const lunchDate = getNextLunchDate();
  const users = await getJoinedUsers();

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

const getUsersRef = () => database.ref('users');

const getJoinedUsers = () => {
  const usersRef = getUsersRef();
  return new Promise((resolve, reject) => {
    usersRef.once("value", function (data) {
      const users = data.toJSON();
      resolve(users);
    });
  })
};

const addUser = userId => (
  getUsersRef().child(userId).set(true)
);

const removeUser = userId => (
  getUsersRef().child(userId).remove()
);

// --

const getNextLunchDate = () => {
  let lunchDate = moment();
  /*
   * Lunch date should be the upcoming Friday until 11.00
   * E.g. 
   *   If now it's Friday 10.00 -> lunch date is today
   *   If now it's Friday 12.00 -> lunch date is Friday of the next week
   */
  while (!(lunchDate.day() === 5 && lunchDate.hour() < 11)) {
    lunchDate.add(1, 'days');
    lunchDate.hour(0);
  }
  return lunchDate;
}

const generateLunchGroups = async () => {
  const users = await getJoinedUsers();
  const userIds = Object.keys(users);

  console.log('IDS', userIds);
  const shuffledIds = shuffle(userIds);
  console.log('SHUFFLED IDS', shuffledIds);

  const groups = [];
  while (shuffledIds.length >= 6) {
    groups.push(shuffledIds.splice(0, 3));
  }
  groups.push(shuffledIds);

  console.log('GROUPS', groups);
  return groups;
};
