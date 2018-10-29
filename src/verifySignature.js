const crypto = require('crypto');
const qs = require('qs');
const config = require('./config');

/*
 * Verify signature in Slack requests
 * https://api.slack.com/docs/verifying-requests-from-slack
 */
const verifySignature = req => {
  const slackSignature = req.headers['x-slack-signature'];
  const rawBody = qs.stringify(req.body, { format: 'RFC1738' });
  const timestamp = req.headers['x-slack-request-timestamp'];

  var currentTime = Math.floor(new Date().getTime() / 1000);
  if (Math.abs(currentTime - timestamp) > 60 * 5) {
    /*
     * The request timestamp is more than five minutes from local time.
     * It could be a replay attack, so let's ignore it.
     */
    throw new Error('Request timestamp is more than 5min difference from local time');
  }

  if (!config.slackSigningSecret) {
    throw new Error('Empty Slack signing secret');
  }

  const signatureBaseString = `v0:${timestamp}:${rawBody}`;
  const mySignature = 'v0=' +
    crypto.createHmac('sha256', config.slackSigningSecret)
    .update(signatureBaseString, 'utf8')
    .digest('hex');

  if (!crypto.timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(slackSignature, 'utf8'))) {
    throw new Error('Signature verification failed');
  }
};

module.exports = verifySignature;