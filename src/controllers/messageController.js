const grokService = require('../services/grokService');
const twilioService = require('../services/twilioService');

exports.handleIncomingMessage = async (req, res) => {
  const incomingMsg = req.body.Body;
  const from = req.body.From;

  console.log(`Received message from ${from}: ${incomingMsg}`);

  try {
    // 1. Send to Grok API to understand intent
    const intent = await grokService.understandIntent(incomingMsg);

    // 2. TODO: Route to different modules based on intent (reminders, notes, etc.)
    console.log(`Grok Intent: ${JSON.stringify(intent)}`);

    // 3. For now, just send a simple reply
    const reply = `I received your message: "${incomingMsg}".\nIntent: ${intent.action}`;
    await twilioService.sendMessage(from, reply);

    res.status(200).send('<Response/>');
  } catch (error) {
    console.error('Error handling message:', error);
    res.status(500).send('<Response/>');
  }
};
