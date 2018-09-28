const express = require('express');
const bodyParser = require('body-parser');
const firebase = require('firebase-admin');
const moment = require('moment');
const fetch = require('node-fetch');

const slackToken = process.env.SLACK_TOKEN;

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

app.get('/', (req, res) => {
  console.log('GET');
  res.send('Hello World!');
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
    // res.json({
    //   text: 'Processing your request :fidget-spinner:'
    // });
    res.send();
    const statusBody = await getStatusBody(body.user_id);
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
  const { body } = req;
  // res.json({
  //   text: 'Processing your action request :fidget-spinner:'
  // });
  res.send();

  console.log('BODY', body);
  const payload = body.payload ? JSON.parse(body.payload) : {};
  console.log('PAYLOAD', payload);

  if (payload.type === 'interactive_message' && payload.actions && payload.actions[0]) {
    const action = payload.actions[0];
    if (action.name === 'lunch' && action.value === 'join') {
      console.log('JOINED');
      sendSlackRequest(payload.response_url, {
        text: 'JOINED!'
      });
    } else if (action.name === 'lunch' && action.value === 'cancel') {
      console.log('CANCELED');
      sendSlackRequest(payload.response_url, {
        text: 'CANCELED!'
      });
    } else {
      console.log('INVALID');
    }


    console.log('ACTION', action);
  } else {
    console.log('INVALID');
  }
});

app.listen(8000, () => console.log('Example app listening on port 8000!'));


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


const getStatusBody = async (userId) => {
  const lunchDate = getNextLunchDate();
  const users = await getUsers();

  const userIds = Object.keys(users);
  const numUsers = userIds.length;
  const hasUserJoined = userIds.includes(userId);
  console.log(userIds, userId);
  const body = hasUserJoined ?
    {
      text: getJoinedStatusText(lunchDate, numUsers),
      attachments: [buildJoinedStatusAttachment()]
    } :
    {
      text: getBasicStatusText(lunchDate, numUsers),
      attachments: [buildBasicStatusAttachment()]
    }

  return body;
}

// DB 

const getUsers = () => {
  const usersRef = database.ref().child('users');
  return new Promise((resolve, reject) => {
    usersRef.once("value", function (data) {
      const users = data.toJSON();
      resolve(users);
    });
  })
};

// ---

const buildJoinedStatusAttachment = () => (
  buildAttachmentWithActions([
    {
      "name": "lunch",
      "text": "Cancel",
      "style": "danger",
      "type": "button",
      "value": "cancel",
      "confirm": {
        "title": "Are you sure you want to cancel?",
        "text": "Do it for the kids",
        "ok_text": "Yes",
        "dismiss_text": "No"
      }
    }
  ])
);

const buildBasicStatusAttachment = () => (
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
    "text": "Actions",
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
  `:feelsgoodman: You have joined the next social lunch which will happen on *${lunchDate.format('dddd D.M')}*!
${getNumUsersText(numUsers)}

I'll post a list with the lunch groups when the time comes.
`
);

const getNumUsersText = numUsers => (
  `There are *${numUsers}* people waiting for the next lunch!`
);

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

const generateLunchGroups = () => {

};
