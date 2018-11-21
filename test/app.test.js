const request = require('supertest');
const fetch = require('node-fetch');
const nock = require('nock');
const moment = require('moment');
const app = require('../src/app');
const config = require('../src/config');
const { app: dbApp } = require('../src/db');
const dateUtils = require('../src/date/utils');

jest.mock('../src/date/utils');
jest.mock('../src/log');

jest.mock('../src/verifySignature', () => {
  return () => true;
});

// Fixed for the test
config.lunchDay = 5;
config.publishHour = 11;
config.publishChannelId = '<publish-channel-id>';
config.publishChannelUrl = 'channel.slack.foo';

// Wipe the whole DB
const cleanDB = () => (
  dbApp.database().ref('lunchEvents').remove()
);

beforeEach(async () => {
  await cleanDB();
})

afterAll(async () => {
  await cleanDB();
  // Close the connection
  dbApp.delete();
});

const mockNow = ({ date = 4, hour = 10, minute = 0, second = 0 } = {}) => {
  const now = moment();
  // Default: 4.1.2018 10.00.00 - Thursday (day 4)
  now.second(second)
  now.minute(minute)
  now.hour(hour)
  now.date(date);
  now.month(0);
  now.year(2018);
  dateUtils.now.mockImplementation(() => now);
};

test('invalid command', async () => {
  const response = await postCommand({
    command: 'foo-lunch'
  });
  expect(response.body.error).toBe('Command failed');
});

test('get status', async done => {
  const responseUrl = 'https://foo.slack/bar';
  mockNow();

  // Expect the actual request made in response to the command
  expectRequest(responseUrl, body => {
    expectStringContains(body.text, 
      'I\'ll set you up for an exciting lunch together with 2-4 other random coworkers');
    expectStringContains(body.text, 'Next lunch date');
    expectStringContains(body.text, 'Friday');
    
    expect(body.attachments.length).toBe(1);

    const actions = body.attachments[0].actions;
    expect(actions.length).toBe(1);
    expect(actions[0].value).toBe('join');
    expect(actions[0].text).toBe('Join');
    done();
    return true;
  });

  const response = await postCommand({
    command: '/social-lunch',
    response_url: responseUrl
  });

  // Initial empty 200 response to Slack
  expect(response.status).toBe(200);
  expect(response.body).toEqual({});
});

test('get status after lunch publish, not joined', async done => {
  const responseUrl = 'https://foo.slack/bar';
  mockNow({ date: 5, hour: 11, minute: 10 });

  // Expect the actual request made in response to the command
  expectRequest(responseUrl, body => {
    expectStringContains(body.text, 'This week\'s lunch day is today');
    expectStringContains(body.text, 'too late to join this time');
    expect(body.attachments).toBeUndefined();
    done();
    return true;
  });

  const response = await postCommand({
    command: '/social-lunch',
    response_url: responseUrl
  });

  // Initial empty 200 response to Slack
  expect(response.status).toBe(200);
  expect(response.body).toEqual({});
});

test('join', async done => {
  const responseUrl = 'https://foo.slack/bar1';
  const userId = '42';
  mockNow();

  // Expect the actual request made in response to the command
  expectRequest(responseUrl, body => {
    expectStringContains(body.text, 'You have joined');
    expectStringContains(body.text, 'Friday 5.1');
    expectStringContains(body.text, config.publishChannelId);

    expect(body.attachments.length).toBe(1);

    const actions = body.attachments[0].actions;
    expect(actions.length).toBe(1);
    expect(actions[0].value).toBe('leave');
    expect(actions[0].text).toBe('Cancel');
    done();
    return true;
  });

  const response = await postJoinAction(responseUrl, userId);

  // Initial empty 200 response to Slack
  expect(response.status).toBe(200);
  expect(response.body).toEqual({});
});

test('join, cancel', async done => {
  const responseUrl1 = 'https://foo.slack/bar1';
  const responseUrl2 = 'https://foo.slack/bar2';
  const userId = '42';
  mockNow();

  // Join request
  expectRequest(responseUrl1);

  // Cancel request
  expectRequest(responseUrl2, body => {
    expectStringContains(body.text, 'You have left');
    expectStringContains(body.text, 'Friday 5.1');

    expect(body.attachments.length).toBe(1);

    const actions = body.attachments[0].actions;
    expect(actions.length).toBe(1);
    expect(actions[0].value).toBe('join');
    expect(actions[0].text).toBe('Join');
    done();
    return true;
  });

  await postJoinAction(responseUrl1, userId);
  const response2 = await postCancelAction(responseUrl2, userId);

  // Initial empty 200 response to Slack
  expect(response2.status).toBe(200);
  expect(response2.body).toEqual({});
});

// TODO Fix - sort out how to mock Cron time
test.skip('join, publish groups', async done => {
  const responseUrl1 = 'https://foo.slack/bar1';
  const responseUrl2 = 'https://foo.slack/bar2';
  const responseUrl3 = 'https://foo.slack/bar3';
  
  const userId1 = '42';
  const userId2 = '44';
  const userId3 = '46';

  mockNow({ date: 5, hour: 10, minute: 59, second: 57 });

  // Join request
  expectRequest(responseUrl1);
  expectRequest(responseUrl2);
  expectRequest(responseUrl3);

  // Publish groups
  expectRequest(config.publishChannelUrl, body => {
    console.log(body);
    done();
    return true;
  });

  await postJoinAction(responseUrl1, userId1);
  await postJoinAction(responseUrl2, userId2);
  await postJoinAction(responseUrl3, userId3);
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
};

const postJoinAction = (responseUrl, userId) => {
  return postAction({
    payload: JSON.stringify({
      response_url: responseUrl,
      type: 'interactive_message',
      actions: [
        {
          name: 'lunch',
          value: 'join'
        }
      ],
      user: {
        id: userId
      }
    })
  });
};

const postCancelAction = (responseUrl, userId) => {
  return postAction({
    payload: JSON.stringify({
      response_url: responseUrl,
      type: 'interactive_message',
      actions: [
        {
          name: 'lunch',
          value: 'leave'
        }
      ],
      user: {
        id: userId
      }
    })
  });
};

const expectRequest = (url, callback) => {
  return nock(url)
    .post('', callback)
    .reply(200);
};

const expectStringContains = (string, expected) => {
  expect(string).toEqual(expect.stringContaining(expected));
}
