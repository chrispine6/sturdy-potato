import logging
import os
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from xai_sdk import Client
from xai_sdk.chat import user, system
from xai_sdk.tools import web_search, x_search

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

logger = logging.getLogger(__name__)

# xai client
XAI_API_KEY = os.getenv("XAI_API_KEY")
xai_client = Client(
    api_key=XAI_API_KEY,
    timeout=3600
)

# command handlers
async def start (update:Update, context:ContextTypes.DEFAULT_TYPE) -> None:
    # for the /start command
    if not update.message or not update.effective_user:
        return
    user_info = update.effective_user
    await update.message.reply_text(
        f"whats up {user_info.first_name}, what can i help you with today?"
    )

async def help_command(update:Update, context: ContextTypes.DEFAULT_TYPE):
    # for the /help command
    if not update.message:
        return
    help_text = """
Awailable commands:
/start - start the bot
/help - show this help message"""
    await update.message.reply_text(help_text)

async def live_search_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not context.args:
        if update.message:
            await update.message.reply_text(
                "pls provide a search query"
            )
        return
    query = ' '.join(context.args)
    status_message = await update.message.reply_text("performing live search...")
    try:
        chat = xai_client.chat.create(
            model="grok-4-fast-non-reasoning",
            tools=[web_search(), x_search()]
        )
        chat.append(user(query))
        is_thinking = False
        tool_calls_info = []
        response_text = ""
        last_update_length = 0

        for response, chunk in chat.stream():
            # Capture tool calls
            for tool_call in chunk.tool_calls:
                tool_info = f"🔧 {tool_call.function.name}: {tool_call.function.arguments[:100]}..."
                tool_calls_info.append(tool_info)
                logger.info(f"Tool call: {tool_call.function.name}")
            
            # Update thinking status
            if response.usage.reasoning_tokens and is_thinking:
                thinking_text = f"🤔 Thinking... ({response.usage.reasoning_tokens} tokens)"
                if len(thinking_text) != last_update_length:
                    await status_message.edit_text(thinking_text)
                    last_update_length = len(thinking_text)
            
            # Switch to response mode
            if chunk.content and is_thinking:
                is_thinking = False
                await status_message.edit_text("📝 Generating response...")
            
            # Accumulate content
            if chunk.content and not is_thinking:
                response_text += chunk.content
        
        # Build final message
        final_message = ""
        
        if tool_calls_info:
            final_message += "**Tools Used:**\n" + "\n".join(tool_calls_info[:3]) + "\n\n"
        
        final_message += response_text
        
        # Add citations if available
        if response.citations:
            final_message += f"\n\n📚 **Citations:** {len(response.citations)} sources"
        
        # Send final response (split if too long)
        if len(final_message) > 4096:
            # Split into chunks
            chunks = [final_message[i:i+4096] for i in range(0, len(final_message), 4096)]
            await status_message.edit_text(chunks[0])
            for chunk_text in chunks[1:]:
                await update.message.reply_text(chunk_text)
        else:
            await status_message.edit_text(final_message)
        
        # Log usage stats
        logger.info(f"Usage - Reasoning: {response.usage.reasoning_tokens}, "
                   f"Total: {response.usage.total_tokens}")
        
    except Exception as e:
        logger.error(f"Error in live search: {e}")
        await status_message.edit_text(
            f"❌ Sorry, I encountered an error: {str(e)[:100]}"
        )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text:
        return
    user_message = update.message.text
    await update.message.chat.send_action(action="typing")
    try:
        chat = xai_client.chat.create(model="grok-4")
        chat.append(system("you are a personal assistant called 'watson', help the user out with his queries"))
        chat.append(user(user_message))
        response = chat.sample()
        await update.message.reply_text(response.content)

    except Exception as e:
        logger.error(f"error calling grok, {e}")
        await update.message.reply_text("sorry, an error has occured")

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.error(f'update {update} caused error {context.error}')

def main() -> None:
    TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "fallback")
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    # register command handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("live_search", live_search_command))
    # register message handler for non-command messages
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    # register error handler
    application.add_error_handler(error_handler)
    
    print("bot running")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()