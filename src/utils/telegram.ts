import TelegramBot from 'node-telegram-bot-api';

export function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[])/g, '\\$1');
}

export function stripMarkdown(text: string): string {
  return text.replace(/[*_`]/g, '');
}

export function sendMarkdownSafe(
  bot: TelegramBot,
  chatId: number,
  text: string,
  options: TelegramBot.SendMessageOptions = {}
): void {
  bot
    .sendMessage(chatId, text, { ...options, parse_mode: 'Markdown' })
    .catch(() => {
      const { parse_mode, ...rest } = options;
      bot.sendMessage(chatId, stripMarkdown(text), rest);
    });
}

export function buildInlineKeyboard(items: Array<{ text: string; data: string }>, columns = 2) {
  const rows: TelegramBot.InlineKeyboardButton[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(
      items.slice(i, i + columns).map((item) => ({
        text: item.text,
        callback_data: item.data,
      }))
    );
  }
  return rows;
}
