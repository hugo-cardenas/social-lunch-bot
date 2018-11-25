const request = require('supertest');
const nock = require('nock');
const moment = require('moment');
const app = require('../src/app');
const config = require('../src/config');
const { app: dbApp } = require('../src/db');
const dateUtils = require('../src/date/utils');
const { generateGroupsAndSendMessage } = require('../src/group');
const verifySignature = require('../src/verifySignature');

jest.mock('../src/date/utils');
jest.mock('../src/log');

jest.mock('../src/verifySignature', () => {
  return jest.fn(() => true);
});

// Fixed for the test
config.lunchDay = 5;
config.publishHour = 11;
config.publishChannelId = '<publish-channel-id>';
config.publishChannelUrl = 'https://foo.slack/publish-channel';

// Wipe the whole DB
const cleanDB = () => (
  dbApp.database().ref('lunchEvents').remove()
);

beforeEach(async () => {
  await cleanDB();
});

afterAll(async () => {
  await cleanDB();
  // Close the connection
  dbApp.delete();
});

const mockNow = ({ date = 4, hour = 10, minute = 0, second = 0 } = {}) => {
  const now = moment();
  // Default: 4.1.2018 10.00.00 - Thursday (day 4)
  now.second(second);
  now.minute(minute);
  now.hour(hour);
  now.date(date);
  now.month(0);
  now.year(2018);
  dateUtils.now.mockImplementation(() => now);
};

test('invalid command', async () => {
  const response = await postCommand({
    command: 'foo-lunch'
  });
  expect(response.status).toBe(500);
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

    // Expect signature verification is called
    expect(verifySignature).toHaveBeenCalled();
    
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
    expectStringContains(body.text, 'lunch groups for today have already been generated');
    expectStringContains(body.text, 'too late to join this time');
    expectStringContains(body.text, 'Run `/social-lunch` again');
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

test('get status after lunch publish, joined', async done => {
  const responseUrlJoin = 'https://foo.slack/bar1';
  const responseUrlStatus = 'https://foo.slack/bar2';
  const userId = '42';
  mockNow({ date: 5, hour: 10, minute: 0 });

  // Expect request made in response to join
  const joinedPromise = new Promise(resolve => {
    expectRequest(responseUrlJoin, () => {
      resolve();
      return true;
    });
  });

  // Expect the actual request made in response to status
  expectRequest(responseUrlStatus, body => {
    expectStringContains(body.text, `lunch groups for today are already published in ${config.publishChannelId}`);
    expect(body.attachments).toBeUndefined();
    done();
    return true;
  });

  // Send join request
  await postJoinAction(responseUrlJoin, userId);

  // Send status request
  await joinedPromise;
  mockNow({ date: 5, hour: 11, minute: 0 });
  await postCommand({
    command: '/social-lunch',
    response_url: responseUrlStatus,
    user_id: userId
  });
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
    
    // Expect signature verification is called
    expect(verifySignature).toHaveBeenCalled();

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

    // Expect signature verification is called
    expect(verifySignature).toHaveBeenCalled();

    done();
    return true;
  });

  await postJoinAction(responseUrl1, userId);
  const response2 = await postCancelAction(responseUrl2, userId);

  // Initial empty 200 response to Slack
  expect(response2.status).toBe(200);
  expect(response2.body).toEqual({});
});

test('join, publish groups', async done => {
  const responseUrl1 = 'https://foo.slack/response/1';
  const responseUrl2 = 'https://foo.slack/response/2';
  const responseUrl3 = 'https://foo.slack/response/3';
  const responseUrl4 = 'https://foo.slack/response/4';
  const responseUrl5 = 'https://foo.slack/response/5';
  const responseUrl6 = 'https://foo.slack/response/6';
  const responseUrl7 = 'https://foo.slack/response/7';

  const userId1 = '101';
  const userId2 = '102';
  const userId3 = '103';
  const userId4 = '104';
  const userId5 = '105';
  const userId6 = '106';
  const userId7 = '107';

  const userIds = [
    userId1,
    userId2,
    userId3,
    userId4,
    userId5,
    userId6,
    userId7
  ];

  mockNow();

  // Nock all join requests
  expectRequest(responseUrl1);
  expectRequest(responseUrl2);
  expectRequest(responseUrl3);
  expectRequest(responseUrl4);
  expectRequest(responseUrl5);
  expectRequest(responseUrl6);
  expectRequest(responseUrl7);

  // Publish groups
  expectRequest(config.publishChannelUrl, body => {
    expectStringContains(body.text, 'These are the lunch groups');
    expectStringContains(body.text, 'Friday 5.1');
    expectStringContains(body.text, 'Group 1');
    expectStringContains(body.text, 'Group 2');
    expectStringNotContains(body.text, 'Group 3');

    userIds.forEach(id => {
      expectStringContains(body.text, `<@${id}>`);
    });

    done();
    return true;
  });

  await postJoinAction(responseUrl1, userId1);
  await postJoinAction(responseUrl2, userId2);
  await postJoinAction(responseUrl3, userId3);
  await postJoinAction(responseUrl4, userId4);
  await postJoinAction(responseUrl5, userId5);
  await postJoinAction(responseUrl6, userId6);
  await postJoinAction(responseUrl7, userId7);

  generateGroupsAndSendMessage();
});

test('join, publish groups, not enough people', async done => {
  const responseUrl1 = 'https://foo.slack/response/1';
  const responseUrl2 = 'https://foo.slack/response/2';

  const userId1 = '101';
  const userId2 = '102';

  mockNow();

  // Nock all join requests
  expectRequest(responseUrl1);
  expectRequest(responseUrl2);

  // Publish groups
  expectRequest(config.publishChannelUrl, body => {
    expectStringContains(body.text, 'There weren\'t enough people');
    expectStringNotContains(body.text, 'Group 1');
    done();
    return true;
  });

  await postJoinAction(responseUrl1, userId1);
  await postJoinAction(responseUrl2, userId2);

  generateGroupsAndSendMessage();
});

test('join after groups are published, invalid action', async done => {
  const responseUrl = 'https://foo.slack/bar';
  const userId = '42';
  mockNow({ date: 5, hour: 11, minute: 10 });

  // Expect request in response to join - invalid action
  expectRequest(responseUrl, body => {
    expectStringContains(body.text, 'Invalid action');
    expectStringContains(body.text, 'The lunch groups for today have already been published');
    done();
    return true;
  });

  await postJoinAction(responseUrl, userId);
});

test('join, cancel after groups are published, invalid action', async done => {
  const responseUrlJoin = 'https://foo.slack/join';
  const responseUrlCancel = 'https://foo.slack/cancel';
  const userId = '42';
  mockNow();
  
  // Expect request in response to join
  const joinedPromise = new Promise(resolve => {
    expectRequest(responseUrlJoin, () => {
      resolve();
      return true;
    });
  });
  
  // Expect request in response to cancel - invalid action
  expectRequest(responseUrlCancel, body => {
    expectStringContains(body.text, 'Invalid action');
    expectStringContains(body.text, 'The lunch groups for today have already been published');
    done();
    return true;
  });

  await postJoinAction(responseUrlJoin, userId);
  await joinedPromise;
  
  mockNow({ date: 5, hour: 11, minute: 10 });
  await postCancelAction(responseUrlCancel, userId);
});

const postCommand = body => {
  return post('/', body);
};

const postAction = body => {
  return post('/action', body);
};

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
};

const expectStringNotContains = (string, expected) => {
  expect(string).toEqual(expect.not.stringContaining(expected));
};
