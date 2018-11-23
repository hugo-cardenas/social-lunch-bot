module.exports = {
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    databaseURL: `https://${process.env.FIREBASE_DB_NAME}.firebaseio.com`
  },
  publishChannelUrl: process.env.PUBLISH_CHANNEL_URL,
  publishChannelId: '<#CEA312YKW|helsinki_general>',
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
  /*
   * Date / time config
   */
  // 0 is Sunday
  lunchDay: 5,
  publishHour: 11
};