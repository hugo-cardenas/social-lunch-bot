const request = require('supertest');
const fetch = require('node-fetch');
const nock = require('nock');
const app = require('../src/app');
const config = require('../src/config');
const { close } = require('../src/db');

jest.mock('../src/verifySignature', () => {
  return () => true;
});

jest.mock('../src/log');

// Fixed for the test
config.lunchDay = 5;
config.publishHour = 11;

// beforeEach(() => {
//   jest.resetModules();
// })

afterAll(() => {
  close();
});

test('basic command, verify signature', () => {

});

test('invalid command', async () => {
  const response = await postCommand({
    command: 'foo-lunch'
  });
  expect(response.body.error).toBe('Command failed');
});

// test('command info', async done => {
//   const responseUrl = 'https://foo.slack/bar';

//   jest.mock('../src/date/now', () => {
//     const moment = require('moment');
//     const date = moment();
//     date.second(0)
//     date.minute(0)
//     date.hour(9)
//     date.day(4);
//     return () => date;
//   });

//   // Expect the actual request made in response to the command
//   nock(responseUrl)
//     .post('', body => {
//       expect(
//         body.text.includes(
//           'I\'ll set you up for an exciting lunch together with 2-4 other random coworkers'
//         )
//       ).toBe(true);
//       expect(body.text.includes('Next lunch date is')).toBe(true);
//       expect(body.text.includes('Friday')).toBe(true);
//       expect(body.attachments.length).toBe(1);

//       const actions = body.attachments[0].actions;
//       expect(actions.length).toBe(1);
//       expect(actions[0].value).toBe('join');
//       expect(actions[0].text).toBe('Join');
//       done();
//       return true;
//     })
//     .reply(200);


//   const response = await postCommand({
//     command: '/social-lunch',
//     response_url: responseUrl
//   });

//   // Initial empty 200 response to Slack
//   expect(response.status).toBe(200);
//   expect(response.body).toEqual({});
// });

test('command info after lunch publish, not joined', async done => {
  const responseUrl = 'https://foo.slack/bar';

  jest.mock('../src/date/now', () => {
    const moment = require('moment');
    const date = moment();
    date.second(0)
    date.minute(10)
    date.hour(11)
    // 4.1.2018 - Thursday (day 4)
    date.date(4);
    date.month(1);
    date.year(2018);
    // date.day(5);

    console.log(date);
    
    return () => date;
  });

  // Expect the actual request made in response to the command
  nock(responseUrl)
    .post('', body => {
      expect(
        body.text.includes(
          'I\'ll set you up for an exciting lunch together with 2-4 other random coworkers'
        )
      ).toBe(true);
      expect(body.text.includes('Next lunch date is')).toBe(true);
      expect(body.text.includes('Friday')).toBe(true);
      expect(body.attachments.length).toBe(1);

      const actions = body.attachments[0].actions;
      expect(actions.length).toBe(1);
      expect(actions[0].value).toBe('join');
      expect(actions[0].text).toBe('Join');
      done();
      return true;
    })
    .reply(200);


  const response = await postCommand({
    command: '/social-lunch',
    response_url: responseUrl
  });

  // Initial empty 200 response to Slack
  expect(response.status).toBe(200);
  expect(response.body).toEqual({});
});

const postCommand = body => {
  return post('/', body);
};

const postAction = body => {
  return post('/action', body);
}

const post = (url, body) => {
  return request(app)
    .post(url)
    .set('Content-Type', 'application/json')
    .send(body);
}

const setTime = time => {
  jest.spyOn(Date, 'now').mockImplementation(() => 1487076708000);
};
