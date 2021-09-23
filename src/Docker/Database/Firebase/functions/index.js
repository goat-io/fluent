// https://github.com/firebase/functions-samples/blob/main/quickstarts/time-server/functions/index.js

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const db = admin.initializeApp().firestore();

// Trigger
// Should be port 5001 but that one is normally busy
// http://127.0.0.1:5002/test/us-central1/calculateCart
exports.calculateCart = functions.https.onRequest((req, res) => {
  if (req.method === 'PUT') {
    return res.status(403).send('Forbidden!');
  }
  const formattedDate = new Date().toISOString()
  functions.logger.log('Sending Formatted date:', formattedDate);
  res.status(200).send({
    status: "ok",
    date: formattedDate
  });
});