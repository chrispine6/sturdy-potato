const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Route to handle incoming WhatsApp messages from Twilio
router.post('/webhook', messageController.handleIncomingMessage);

module.exports = router;
