// Calls the Telegram Bot API directly over HTTP using the bot token.
// The web app and the bot process don't need to share a runtime — the
// Bot API is just a REST API, so either process can call it independently.

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

async function telegramFetch(method: string, body: unknown) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (${method}): ${data.description}`);
  }
  return data.result;
}

// Creates a one-time-use invite link to a course's private channel.
// member_limit: 1 means the link stops working after one person joins,
// so it can't be shared/leaked to non-payers.
export async function createOneTimeInviteLink(
  channelId: number,
): Promise<string> {
  const result = await telegramFetch("createChatInviteLink", {
    chat_id: channelId,
    member_limit: 1,
    creates_join_request: false,
  });
  return result.invite_link;
}

// useMarkdown defaults to true, but should be false for any text
// containing a raw URL — invite links frequently contain underscores,
// which Telegram's legacy Markdown parser reads as italic markers and
// then fails with "can't parse entities" if they're unmatched.
export async function sendTelegramMessage(
  telegramUserId: number,
  text: string,
  useMarkdown: boolean = true,
): Promise<void> {
  await telegramFetch("sendMessage", {
    chat_id: telegramUserId,
    text,
    ...(useMarkdown ? { parse_mode: "Markdown" } : {}),
  });
}

// Same as above, but with a button that re-triggers the bot's existing
// buy_course_<id> callback — handled by the bot process via long polling
// regardless of which process (web or bot) sent the message, since
// Telegram delivers the tap to whichever process is polling for updates.
export async function sendTelegramMessageWithCourseButton(
  telegramUserId: number,
  text: string,
  courseId: number,
  buttonLabel: string,
): Promise<void> {
  await telegramFetch("sendMessage", {
    chat_id: telegramUserId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: buttonLabel, callback_data: `buy_course_${courseId}` }]],
    },
  });
}

// Used by the expiry cron job (next up) to remove lapsed subscribers.
// Ban then immediately unban so they're removed but not permanently
// blocked — they can rejoin on a fresh invite link if they resubscribe.
export async function removeUserFromChannel(
  channelId: number,
  telegramUserId: number,
): Promise<void> {
  await telegramFetch("banChatMember", {
    chat_id: channelId,
    user_id: telegramUserId,
  });
  await telegramFetch("unbanChatMember", {
    chat_id: channelId,
    user_id: telegramUserId,
    only_if_banned: true,
  });
}
