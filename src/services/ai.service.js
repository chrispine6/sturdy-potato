const { GoogleGenerativeAI } = require('@google/generative-ai');
const dialoguesModel = require('../models/dialogues.model');
const remindersModel = require('../models/reminders.model');
const todosModel = require('../models/todos.model');
const knowledgeBaseModel = require('../models/knowledgeBase.model');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define function declarations for Gemini
const functions = {
  create_todo: {
    name: "create_todo",
    description: "Creates a new todo item for the user. Use this when the user wants to add a task or something they need to do.",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The todo task description"
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Priority level of the task. Default is medium."
        }
      },
      required: ["task"]
    }
  },
  list_todos: {
    name: "list_todos",
    description: "Gets the user's current todo list. Use this when the user asks what they need to do or wants to see their tasks.",
    parameters: {
      type: "object",
      properties: {
        include_completed: {
          type: "boolean",
          description: "Whether to include completed todos. Default is false."
        }
      },
      required: []
    }
  },
  complete_todo: {
    name: "complete_todo",
    description: "Marks a todo as completed. Use this when the user indicates they've finished a task.",
    parameters: {
      type: "object",
      properties: {
        todo_index: {
          type: "number",
          description: "The index/number of the todo to complete (1-based, so first todo is 1)"
        }
      },
      required: ["todo_index"]
    }
  },
  create_reminder: {
    name: "create_reminder",
    description: "Creates a reminder for the user at a specific time in the future. Use this when the user wants to be reminded about something.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "What to remind the user about"
        },
        time_value: {
          type: "number",
          description: "Numeric value for the time (e.g., 5, 30, 2)"
        },
        time_unit: {
          type: "string",
          enum: ["minutes", "hours", "days"],
          description: "Unit of time for the reminder"
        }
      },
      required: ["message", "time_value", "time_unit"]
    }
  },
  list_reminders: {
    name: "list_reminders",
    description: "Gets the user's active reminders. Use this when the user asks about their reminders or what they have scheduled.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  search_knowledge: {
    name: "search_knowledge",
    description: "Searches the knowledge base for information the user has previously told you. Use this when the user asks about something they mentioned before or wants to recall stored information.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for in the knowledge base"
        }
      },
      required: ["query"]
    }
  },
  add_knowledge: {
    name: "add_knowledge",
    description: "Adds information to the knowledge base for future reference. Use this when the user shares information they want you to remember (preferences, facts, important details).",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Category of the knowledge (e.g., 'personal', 'work', 'preferences', 'contacts')"
        },
        topic: {
          type: "string",
          description: "Topic or title of the knowledge entry"
        },
        content: {
          type: "string",
          description: "The actual information to store"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for easier searching (optional)"
        }
      },
      required: ["category", "topic", "content"]
    }
  }
};

// Convert functions object to array for Gemini
const functionDeclarations = Object.values(functions);

// Execute function calls
async function executeTool(functionName, functionArgs, userId, userName) {
  try {
    switch (functionName) {
      case "create_todo":
        const priority = functionArgs.priority || "medium";
        await todosModel.createTodo(userId, userName, functionArgs.task, priority);
        return { 
          success: true, 
          message: `Todo created: ${functionArgs.task}`,
          priority: priority
        };
      
      case "list_todos":
        const todos = await todosModel.getUserTodos(userId, functionArgs.include_completed || false);
        const formattedTodos = todos.map((todo, index) => ({
          number: index + 1,
          task: todo.todoText,
          priority: todo.priority,
          completed: todo.completed
        }));
        return { 
          success: true,
          count: todos.length,
          todos: formattedTodos 
        };
      
      case "complete_todo":
        const allTodos = await todosModel.getUserTodos(userId, false);
        if (functionArgs.todo_index < 1 || functionArgs.todo_index > allTodos.length) {
          return { 
            success: false, 
            message: `Invalid todo number. You have ${allTodos.length} active todos.` 
          };
        }
        const todo = allTodos[functionArgs.todo_index - 1];
        await todosModel.markAsCompleted(todo._key);
        return { 
          success: true, 
          message: `Completed: ${todo.todoText}`,
          task: todo.todoText
        };
      
      case "create_reminder":
        let milliseconds;
        const { time_value, time_unit, message } = functionArgs;
        
        switch (time_unit) {
          case "minutes":
            milliseconds = time_value * 60 * 1000;
            break;
          case "hours":
            milliseconds = time_value * 60 * 60 * 1000;
            break;
          case "days":
            milliseconds = time_value * 24 * 60 * 60 * 1000;
            break;
        }
        
        const reminderTime = new Date(Date.now() + milliseconds);
        await remindersModel.createReminder(userId, userName, message, reminderTime);
        return { 
          success: true, 
          message: message,
          reminderTime: reminderTime.toLocaleString(),
          timeValue: time_value,
          timeUnit: time_unit
        };
      
      case "list_reminders":
        const reminders = await remindersModel.getUserReminders(userId);
        const formattedReminders = reminders.map((reminder, index) => ({
          number: index + 1,
          message: reminder.reminderText,
          time: new Date(reminder.reminderTime).toLocaleString()
        }));
        return { 
          success: true,
          count: reminders.length,
          reminders: formattedReminders 
        };
      
      case "search_knowledge":
        const results = await knowledgeBaseModel.searchByTopic(functionArgs.query);
        const formattedResults = results.map(r => ({
          topic: r.topic,
          content: r.content,
          category: r.category,
          tags: r.tags
        }));
        return { 
          success: true,
          count: results.length,
          results: formattedResults 
        };
      
      case "add_knowledge":
        await knowledgeBaseModel.addEntry(
          functionArgs.category,
          functionArgs.topic,
          functionArgs.content,
          functionArgs.tags || []
        );
        return { 
          success: true, 
          message: "Knowledge stored successfully",
          topic: functionArgs.topic,
          category: functionArgs.category
        };
      
      default:
        return { success: false, error: "Unknown function" };
    }
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Get conversation history for context
async function getConversationContext(userId, limit = 5) {
  const recentDialogues = await dialoguesModel.getUserDialogues(userId, limit);
  
  const history = [];
  for (const dialogue of recentDialogues.reverse()) {
    history.push({
      role: "user",
      parts: [{ text: dialogue.userMessage }]
    });
    history.push({
      role: "model",
      parts: [{ text: dialogue.botResponse }]
    });
  }
  
  return history;
}

// Main AI processing function
async function processMessage(userId, userName, userMessage) {
  try {
    // Initialize the model with function calling
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ functionDeclarations }],
      systemInstruction: `You are Watson-Stark, a helpful and friendly personal assistant bot. You help users manage their daily life with todos, reminders, and a personal knowledge base.

Your capabilities:
- Create and manage todos with priorities (low, medium, high)
- Set reminders for future tasks
- Store and retrieve information in a personal knowledge base
- Have natural, engaging conversations with context awareness

Personality:
- Be warm, friendly, and conversational
- Show enthusiasm when helping
- Be proactive and suggest helpful actions
- Keep responses concise but informative
- Use emojis sparingly and appropriately

When handling requests:
- For todos: Understand phrases like "add task", "what do I need to do", "mark as done", "I finished X"
- For reminders: Parse time naturally from "in 30 minutes", "in 2 hours", "tomorrow" (treat as 1 day)
- For knowledge: Recognize when users share information to remember vs asking questions
- Always confirm actions with clear feedback

If you're unsure about the user's intent, ask a clarifying question rather than guessing.

The user's name is ${userName}.`
    });

    // Get conversation history
    const history = await getConversationContext(userId, 5);
    
    // Start a chat session with history
    const chat = model.startChat({
      history: history
    });

    // Send the user message
    let result = await chat.sendMessage(userMessage);
    let response = result && result.response;

    // Helper to safely extract function calls (some SDKs provide functionCalls as a function)
    function getFunctionCalls(resp) {
      if (!resp) return [];
      try {
        if (typeof resp.functionCalls === 'function') {
          const fc = resp.functionCalls();
          return Array.isArray(fc) ? fc : [];
        }
        if (Array.isArray(resp.functionCalls)) return resp.functionCalls;
      } catch (e) {
        // ignore and treat as no function calls
      }
      return [];
    }
    
    // Handle function calls in a loop (robustly)
    let functionCalls = getFunctionCalls(response);
    while (functionCalls.length > 0) {
      const functionResponses = [];

      for (const call of functionCalls) {
        // Safely parse args (some SDKs return args as JSON string)
        let parsedArgs = call && call.args ? call.args : {};
        if (typeof parsedArgs === 'string') {
          try {
            parsedArgs = JSON.parse(parsedArgs);
          } catch (e) {
            parsedArgs = {};
          }
        }

        console.log(`Executing function: ${call.name}`, parsedArgs);
        const functionResult = await executeTool(call.name, parsedArgs, userId, userName);

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: functionResult
          }
        });
      }

      // Send function responses back to the model
      result = await chat.sendMessage(functionResponses);
      response = result && result.response;
      functionCalls = getFunctionCalls(response);
    }

    // Get the final text response (safe fallback if response or text() is missing)
    let finalResponse = '';
    if (response) {
      if (typeof response.text === 'function') {
        finalResponse = response.text();
      } else if (typeof response.text === 'string') {
        finalResponse = response.text;
      }
    }
    if (!finalResponse && result && result.response) {
      const resp = result.response;
      if (resp && typeof resp.text === 'function') finalResponse = resp.text();
      else if (resp && typeof resp.text === 'string') finalResponse = resp.text;
    }
    
    // Save the dialogue
    await dialoguesModel.saveDialogue(userId, userName, userMessage, finalResponse);
    
    return finalResponse;
    
  } catch (error) {
    console.error('Error processing message with Gemini:', error);
    
    if (error.message && error.message.includes('API key')) {
      throw new Error('Invalid Gemini API key. Please check your GEMINI_API_KEY in .env file.');
    }
    
    throw error;
  }
}

module.exports = {
  processMessage
};