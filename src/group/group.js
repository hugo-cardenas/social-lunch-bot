const {
  getUsers,
  saveGroups
} = require('../db');
const createGroups = require('./createGroups');
const { getNextLunchDate } = require('../date');
const log = require('../log');
const { getGroupListMessage, getNoGroupsMessage } = require('../messages');
const config = require('../config');
const { sendSlackRequest } = require('../request');

const generateLunchGroups = async date => {
  const users = await getUsers(date);
  const userIds = Object.keys(users);
  return createGroups(userIds);
};

const generateGroupsAndSendMessage = async () => {
  // TODO Add retries if failure for these actions
  try {
    const date = getNextLunchDate();
    const groups = await generateLunchGroups(date);
    await saveGroups(date, groups);
    sendGroupsMessage(groups, date);    
  } catch (error) {
    log('Generating groups failed', error);
  }
};

const sendGroupsMessage = (groups, date) => {
  let message;
  if (groups.length > 0) {
    message = getGroupListMessage(groups, date);
  } else {
    message = getNoGroupsMessage();
  }
  return sendSlackRequest(config.publishChannelUrl, {
    text: message
  });
};

module.exports = {
  generateGroupsAndSendMessage
};