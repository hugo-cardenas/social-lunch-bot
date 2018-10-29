const shuffle = require('array-shuffle');

const minGroupLength = 3;

const createGroups = userIds => {
  if (!Array.isArray(userIds) || userIds.length < minGroupLength) {
    throw new Error(`Invalid userIds ${userIds}`);
  }
  const numGroups = Math.floor(userIds.length / minGroupLength);
  const shuffledIds = shuffle(userIds);
  const groups = [];
  for (let i = 0; i < numGroups; i++) {
    groups.push(shuffledIds.splice(0, 3))
  }
  shuffledIds.forEach((id, i) => groups[i % groups.length].push(id));
  return groups;  
};

module.exports = createGroups;