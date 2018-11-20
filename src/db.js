const firebase = require('firebase-admin');
const config = require('./config');

// Init Firebase
const app = firebase.initializeApp({
  credential: firebase.credential.cert({
    projectId: config.firebase.projectId,
    clientEmail: config.firebase.clientEmail,
    privateKey: config.firebase.privateKey,
  }),
  databaseURL: config.firebase.databaseURL
});

const database = app.database();

const close = () => {
  return app.delete();
};

const getUsersRef = date => (
  database.ref(`lunchEvents/${date.format('YYYYMMDD')}/users`)
);

const getGroupsRef = date => (
  database.ref(`lunchEvents/${date.format('YYYYMMDD')}/groups`)
);

const getUsers = date => {
  const usersRef = getUsersRef(date);
  return new Promise(resolve => {
    usersRef.once('value', function (data) {
      const users = data.toJSON();
      resolve(users ? users : []);
    });
  });
};

const addUser = (date, userId) => (
  getUsersRef(date).child(userId).set(true)
);

const removeUser = (date, userId) => (
  getUsersRef(date).child(userId).remove()
);

const saveGroups = (date, groups) => {
  const groupsRef = getGroupsRef(date);
  return groupsRef.set(groups);
};

const getGroups = date => {
  const groupsRef = getGroupsRef(date);
  return new Promise(resolve => {
    groupsRef.once('value', function (data) {
      const groups = data.val();
      resolve(groups ? groups : []);
    });
  });
};

module.exports = {
  close,
  getUsers,
  addUser,
  removeUser,
  saveGroups,
  getGroups
};
