// Small hand-rolled i18n layer — just two languages and a flat string
// table, so a real library would be overkill. Every user-facing string in
// the bot should go through t(lang, key, vars) rather than being written
// inline, so adding a third language later is just adding one more object
// here.

export type Lang = "en" | "ha";

export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: "English",
  ha: "Hausa",
};

// The four buttons on the persistent main menu (a ReplyKeyboardMarkup, so
// they're always visible at the bottom of the chat — no commands to
// remember, no scrolling up to find a button again). Because a reply
// keyboard sends back plain text when tapped, bot.ts matches on these
// exact labels in either language.
export const MENU_LABELS = {
  courses: { en: "📚 Courses", ha: "📚 Darussa" },
  myAccess: { en: "🧾 My access", ha: "🧾 Abin da na saya" },
  language: { en: "🌐 Language", ha: "🌐 Harshe" },
  help: { en: "❓ Help", ha: "❓ Taimako" },
} as const;

type TemplateVars = Record<string, string | number>;

const STRINGS = {
  welcome: {
    en: "Welcome{name}! 👋",
    ha: "Barka da zuwa{name}! 👋",
  },
  welcome_intro: {
    en: "Use the buttons below any time — no need to type anything. Tap *📚 Courses* to see what's on offer.",
    ha: "Yi amfani da maɓallan da ke ƙasa a kowane lokaci — ba sai ka rubuta kome ba. Danna *📚 Darussa* don ganin abin da ake bayarwa.",
  },
  landing_page_hint: {
    en: "You can also see everything on offer at {url}.",
    ha: "Hakanan za ka iya ganin duk abin da ake bayarwa a {url}.",
  },
  main_menu_prompt: {
    en: "What would you like to do?",
    ha: "Me kake son yi?",
  },
  help_text: {
    en:
      "*How this bot works — 4 simple steps:*\n\n" +
      "1️⃣ Tap *📚 Courses* and pick one.\n" +
      "2️⃣ Tap *💳 Proceed to payment* — the bot gives you a bank account number.\n" +
      "3️⃣ Pay that exact amount from your bank app, within the time shown.\n" +
      "4️⃣ As soon as payment lands, the bot sends you a link to join — tap it to get in.\n\n" +
      "Already paid before? Tap *🧾 My access* any time to see your courses or get your link again.\n\n" +
      "Stuck? Just type your question here — a real person checks this.",
    ha:
      "*Yadda wannan bot ɗin yake aiki — matakai 4 masu sauƙi:*\n\n" +
      "1️⃣ Danna *📚 Darussa* sannan ka zaɓi ɗaya.\n" +
      "2️⃣ Danna *💳 Ci gaba da biyan kuɗi* — bot ɗin zai baka lambar asusun banki.\n" +
      "3️⃣ Biya ainihin adadin daga app ɗin bankinka, cikin lokacin da aka nuna.\n" +
      "4️⃣ Da zarar kuɗin ya shiga, bot ɗin zai turo maka hanyar shiga — danna ta don shiga.\n\n" +
      "Ka taɓa biya a da? Danna *🧾 Abin da na saya* a kowane lokaci don ganin darussanka ko sake samun hanyar shiga.\n\n" +
      "Kana da matsala? Rubuta tambayarka a nan — mutum na gaske yana duba wannan.",
  },
  language_prompt: {
    en: "Choose your language:",
    ha: "Zaɓi harshenka:",
  },
  language_set: {
    en: "Language set to English. ✅",
    ha: "An saita harshe zuwa Hausa. ✅",
  },
  no_courses: {
    en: "No courses available right now — check back soon.",
    ha: "Babu darussa a yanzu — dawo daga baya.",
  },
  course_list_header: {
    en: "Here's what's available (✅ = you already have active access):",
    ha: "Ga abin da ake da shi (✅ = kana da shigar da ta riga ta kunna):",
  },
  course_unavailable: {
    en: "That course isn't available anymore.",
    ha: "Wannan darasi ba ya samuwa yanzu.",
  },
  my_access_header: {
    en: "Your courses:",
    ha: "Darussanka:",
  },
  my_access_empty: {
    en: "You don't have any active courses yet. Tap *📚 Courses* to get started.",
    ha: "Ba ka da wani darasi mai aiki tukuna. Danna *📚 Darussa* don fara.",
  },
  access_valid_until: {
    en: "valid until {date}",
    ha: "yana aiki har zuwa {date}",
  },
  access_lifetime: {
    en: "lifetime — never expires",
    ha: "na rayuwa — ba ya ƙarewa",
  },
  already_have_access: {
    en:
      "*{title}*\nYou already have access to this course ({expiry}).\n\n" +
      "Lost the invite or left the channel by accident? Tap below for a fresh link.",
    ha:
      "*{title}*\nKana da shiga wannan darasi tuni ({expiry}).\n\n" +
      "Ka ɓatar da hanyar shiga ko ka bar channel ɗin kuskure? Danna ƙasa don sabuwar hanya.",
  },
  resend_invite_button: {
    en: "🔗 Resend my invite link",
    ha: "🔗 Sake turo mini hanyar shiga",
  },
  resend_invite_sent: {
    en: "Here's a fresh invite link for {title} ({expiry}):\n{link}",
    ha: "Ga sabuwar hanyar shiga {title} ({expiry}):\n{link}",
  },
  resend_invite_none: {
    en: "No active access found.",
    ha: "Ba a sami shiga mai aiki ba.",
  },
  pay_button: {
    en: "💳 Proceed to payment",
    ha: "💳 Ci gaba da biyan kuɗi",
  },
  course_detail: {
    en: "*{title}*\nPrice: ₦{price}\n{accessNote}",
    ha: "*{title}*\nKuɗi: ₦{price}\n{accessNote}",
  },
  access_note_one_on_one: {
    en: "You'll be able to book a session after payment.",
    ha: "Za ka iya yin booking bayan ka biya.",
  },
  access_note_lifetime: {
    en: "You'll get lifetime access to the course channel — no expiry, ever.",
    ha: "Za ka samu shiga channel ɗin darasi na rayuwa — babu ƙarewa, har abada.",
  },
  access_note_renew: {
    en: "Your previous access expired — this renews it for another {days} days.",
    ha: "Shigarka ta baya ta ƙare — wannan zai sabunta ta na ƙarin kwanaki {days}.",
  },
  access_note_duration: {
    en: "You'll get {days}-day access to the course channel.",
    ha: "Za ka samu shiga channel ɗin darasi na kwanaki {days}.",
  },
  order_in_progress: {
    en:
      "You already have a payment in progress for *{title}*:\n\n" +
      "🏦 *{bank}*\n💳 `{account}`\n\n" +
      "Pay ₦{amount} to that account — no need to start a new one.",
    ha:
      "Kana da biyan kuɗi da ke gudana don *{title}*:\n\n" +
      "🏦 *{bank}*\n💳 `{account}`\n\n" +
      "Biya ₦{amount} zuwa wannan asusu — babu bukatar fara sabo.",
  },
  already_active_no_pay: {
    en:
      'You already have active access to *{title}* — no need to pay again. Use "🧾 My access" to get your invite link resent if needed.',
    ha:
      "Kana da shiga mai aiki zuwa *{title}* tuni — babu bukatar sake biya. Yi amfani da \"🧾 Abin da na saya\" don sake samun hanyar shiga idan kana bukata.",
  },
  payment_instructions: {
    en:
      "To complete your order for *{title}*, pay ₦{price} to:\n\n" +
      "🏦 *{bank}*\n💳 `{account}`\n\n" +
      "{validity} You'll get an invite link automatically once payment is confirmed — no need to send a receipt.",
    ha:
      "Don kammala odar ka ta *{title}*, biya ₦{price} zuwa:\n\n" +
      "🏦 *{bank}*\n💳 `{account}`\n\n" +
      "{validity} Za ka samu hanyar shiga kai tsaye da zarar an tabbatar da biyan kuɗi — babu bukatar aika rasit.",
  },
  validity_hours: {
    en: "This account is valid for about {hours} hour(s).",
    ha: "Wannan asusu yana aiki na kusan sa'o'i {hours}.",
  },
  validity_minutes: {
    en: "This account is valid for about {minutes} minutes.",
    ha: "Wannan asusu yana aiki na kusan mintuna {minutes}.",
  },
  generic_error: {
    en: "Something went wrong, try again.",
    ha: "Wani abu ya faru, sake gwadawa.",
  },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof STRINGS;

export function t(lang: Lang, key: StringKey, vars?: TemplateVars): string {
  let text = STRINGS[key][lang] ?? STRINGS[key].en;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function menuLabel(key: keyof typeof MENU_LABELS, lang: Lang): string {
  return MENU_LABELS[key][lang];
}

// A reply-keyboard button sends back plain text, in whichever language it
// was shown in — so matching has to check both languages' labels, not
// just the viewer's current one.
export function isMenuLabel(key: keyof typeof MENU_LABELS, text: string): boolean {
  return text === MENU_LABELS[key].en || text === MENU_LABELS[key].ha;
}
