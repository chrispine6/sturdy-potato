require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { initializeDatabase } = require('./db/init');
const dialoguesModel = require('./models/dialogues.model');
const remindersModel = require('./models/reminders.model');
const knowledgeBaseModel = require('./models/knowledgeBase.model');
const todosModel = require('./models/todos.model');
const { processMessage } = require('./services/ai.service');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});

// Initialize database
initializeDatabase().catch(console.error);

// Check for pending reminders every minute
setInterval(async () => {
  try {
    const pendingReminders = await remindersModel.getPendingReminders();
    
    for (const reminder of pendingReminders) {
      bot.sendMessage(reminder.userId, `⏰ Reminder: ${reminder.reminderText}`);
      await remindersModel.markAsCompleted(reminder._key);
    }
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
}, 60000); // Check every minute

bot.on('message', async (msg) => {
  // Skip if it's a command
  if (msg.text && msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const userName = msg.from.first_name;
  const userId = msg.from.id;
  
  console.log(`received message from ${userName}: ${msg.text}`);
  
  try {
    // Show typing indicator
    bot.sendChatAction(chatId, 'typing');
    
    // Process message with AI
    const response = await processMessage(userId, userName, msg.text);
    
    bot.sendMessage(chatId, response);
  } catch (error) {
    console.error('Error handling message:', error);
    
    let errorMessage = 'Sorry, I encountered an error processing your message. Please try again.';
    
    if (error.message && error.message.toLowerCase().includes('api key')) {
      errorMessage = '⚠️ API configuration error. Please contact the bot administrator.';
    }
    
    bot.sendMessage(chatId, errorMessage);
  }
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name;
  bot.sendMessage(chatId, 
    `Welcome ${userName}! 👋\n\n` +
    `I'm Watson-Stark, your personal AI assistant powered by Google Gemini. I can help you with:\n\n` +
    `✅ Managing todos and tasks\n` +
    `⏰ Setting reminders\n` +
    `📚 Storing and retrieving information\n` +
    `💬 Natural conversations with context\n\n` +
    `Just talk to me naturally! For example:\n` +
    `• "Add buy groceries to my todos"\n` +
    `• "Remind me to call mom in 2 hours"\n` +
    `• "What do I need to do today?"\n` +
    `• "Remember that I like coffee in the morning"\n` +
    `• "What did I tell you about my preferences?"\n\n` +
    `Type /help for more information.`
  );
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    '🤖 *Watson-Stark Help*\n\n' +
    'I understand natural language! Just talk to me like you would to a human assistant.\n\n' +
    '*Example requests:*\n' +
    '• "Add finish report to my todo list"\n' +
    '• "What are my tasks for today?"\n' +
    '• "I finished the first task"\n' +
    '• "Remind me to exercise in 30 minutes"\n' +
    '• "Show me my reminders"\n' +
    '• "Remember that I prefer tea over coffee"\n' +
    '• "What did I tell you about my morning routine?"\n\n' +
    '*Quick Commands:*\n' +
    '/stats - View your statistics\n' +
    '/help - Show this help message\n\n' +
    '_Powered by Google Gemini_ ✨',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  try {
    const dialogueCount = await dialoguesModel.getDialogueCount(userId);
    const reminders = await remindersModel.getUserReminders(userId);
    const activeTodos = await todosModel.getTodoCount(userId, false);
    const completedTodos = await todosModel.getTodoCount(userId, true);
    
    bot.sendMessage(chatId, 
      `📊 *Your Stats:*\n\n` +
      `💬 Conversations: ${dialogueCount}\n` +
      `⏰ Active reminders: ${reminders.length}\n` +
      `✅ Active todos: ${activeTodos}\n` +
      `✔️ Completed todos: ${completedTodos}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error getting stats:', error);
    bot.sendMessage(chatId, 'Sorry, could not retrieve stats.');
  }
});

console.log('bot is running with OpenAI...');