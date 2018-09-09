const express = require('express');
const bodyParser = require('body-parser');
const firebase = require('firebase-admin');
const moment = require('moment');

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

const ref = firebase.app().database().ref();

app.get('/', (req, res) => {
  console.log('GET');
  res.send('Hello World!');
});

app.post('/', (req, res) => {
  const { body } = req;
  if (body.type === 'url_verification') {
    // Verify token
    if (body.token !== slackToken) {
      res.status(400).send('Invalid token');
      return;
    }

    res.json({ challenge: body.challenge });
    return;
  } else if (body.command === '/social-lunch') {
    const usersRef = ref.child('users');
    const lunchDate = getNextLunchDate();

    if (body.text === 'join') {
      usersRef.child(body.user_id).set('');
      const resBody = {
        text: getJoinResponseText(lunchDate)
      }
      res.send(resBody);

    } else if (body.text === 'cancel') {
      usersRef.child(body.user_id).set(null);
      const resBody = {
        text: getCancelResponseText(lunchDate)
      }
      res.send(resBody);

    } else {
      usersRef.once("value", function (data) {
        const users = data.toJSON();
        const userIds = Object.keys(users);
        const numUsers = userIds.length;
        const hasUserJoined = userIds.includes(body.user_id);
        console.log(userIds, body.user_id);
        const resBody = {
          text: hasUserJoined ? getJoinedStatusText(lunchDate, numUsers) : getBasicStatusText(lunchDate, numUsers)
        }
        res.send(resBody);
      });
    }
  } else {
    console.log(body);
    res.send();
  }

});

const getBasicStatusText = (lunchDate, numUsers) => (
  `:wave: Hi there! [UNDER CONSTRUCTION]

I'll organize for you a social lunch by putting you together with 2 other random coworkers :awesome: 
Next lunch date is *${lunchDate.format('dddd D.M')}*
${getNumUsersText(numUsers)}

${getUsageText()}
`  
);

const getJoinedStatusText = (lunchDate, numUsers) => (
  `:feelsgoodman: You have already joined the next social lunch which will happen on *${lunchDate.format('dddd D.M')}*!
${getNumUsersText(numUsers)}

${getUsageText()}
`  
);

const getJoinResponseText = lunchDate => (
  `:feelsgoodman: Yay, you have joined the next social lunch which will happen on *${lunchDate.format('dddd D.M')}*!`
);

const getCancelResponseText = (lunchDate) => (
  `:feelsbadman: You have decided to cancel the next social lunch which will happen on *${lunchDate.format('dddd D.M')}*.
Please, reconsider your decision, do it for the kids.`  
);

const getNumUsersText = numUsers => (
  `There are *${numUsers}* people waiting for the next lunch!`
);

const getUsageText = () => (
  `Usage:
    */social-lunch*          Show status and display the next lunch date
    */social-lunch join*     Join the next lunch event. I'll inform you who are your lunch mates
    */social-lunch cancel*   Cancel the event you joined
  `
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

app.listen(8000, () => console.log('Example app listening on port 8000!'));
