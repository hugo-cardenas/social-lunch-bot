const createGroups = require('../src/group/createGroups');

const data = [
  {
    userIds: [10, 20, 30],
    expectedGroupLengths: [3]
  },
  {
    userIds: [10, 20, 30, 40],
    expectedGroupLengths: [4]
  },
  {
    userIds: [10, 20, 30, 40, 50],
    expectedGroupLengths: [5]
  },
  {
    userIds: [10, 20, 30, 40, 50, 60],
    expectedGroupLengths: [3, 3]
  },
  {
    userIds: [10, 20, 30, 40, 50, 60, 70],
    expectedGroupLengths: [4, 3]
  },
  {
    userIds: [10, 20, 30, 40, 50, 60, 70, 80],
    expectedGroupLengths: [4, 4]
  },
  {
    userIds: [10, 20, 30, 40, 50, 60, 70, 80, 90],
    expectedGroupLengths: [3, 3, 3]
  },
  {
    userIds: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    expectedGroupLengths: [4, 3, 3]
  }
];

data.forEach(({ userIds, expectedGroupLengths }, index) => {
  test(`create groups #${index}`, () => {
    const groups = createGroups(userIds);
    expect(groups.length).toBe(expectedGroupLengths.length);
    expectedGroupLengths.forEach((length, i) => expect(groups[i].length).toBe(length));
    
    const flattenedGroups = [].concat(...groups);
    flattenedGroups.sort((a, b) => a - b);
    expect(flattenedGroups).toEqual(userIds);
  });
});

test('create groups, less than 3 not valid', () => {
  expect(createGroups([10, 20])).toEqual([]);
});