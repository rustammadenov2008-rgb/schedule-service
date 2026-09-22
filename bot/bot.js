// ============================================================
// Telegram-бот "Расписание пар"
// Использует ту же базу данных Supabase, что и веб-сайт.
// ============================================================

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Заполните BOT_TOKEN, SUPABASE_URL и SUPABASE_ANON_KEY в файле .env");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DAY_NAMES = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

// Храним выбранную группу для каждого чата в памяти процесса
const userGroup = new Map();

function jsDayToDbDay(jsDay) {
  return jsDay === 0 ? null : jsDay; // 1=Пн ... 6=Сб, воскресенье не хранится
}

function formatTime(t) {
  return t ? t.slice(0, 5) : t;
}

// -------------------- /start: выбор группы --------------------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const { data: groups, error } = await supabase
    .from("groups")
    .select("id, name")
    .order("name");

  if (error || !groups || groups.length === 0) {
    return bot.sendMessage(chatId, "Группы пока не добавлены в базу.");
  }

  const keyboard = groups.map(g => [{ text: g.name, callback_data: `group:${g.id}` }]);

  bot.sendMessage(chatId, "Выберите свою группу:", {
    reply_markup: { inline_keyboard: keyboard },
  });
});

// Обработка нажатия на кнопку выбора группы
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith("group:")) {
    const groupId = data.split(":")[1];
    userGroup.set(chatId, groupId);

    const { data: group } = await supabase
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();

    bot.answerCallbackQuery(query.id);
    bot.sendMessage(
      chatId,
      `Группа «${group?.name ?? groupId}» выбрана.\nТеперь доступны команды:\n/today — расписание на сегодня\n/now — какая пара идёт сейчас`
    );
  }
});

// -------------------- /today --------------------
bot.onText(/\/today/, async (msg) => {
  const chatId = msg.chat.id;
  const groupId = userGroup.get(chatId);

  if (!groupId) {
    return bot.sendMessage(chatId, "Сначала выберите группу командой /start.");
  }

  const jsDay = new Date().getDay();
  const dbDay = jsDayToDbDay(jsDay);

  if (dbDay === null) {
    return bot.sendMessage(chatId, `Сегодня ${DAY_NAMES[jsDay]} — пар нет.`);
  }

  const { data, error } = await supabase
    .from("schedule")
    .select("lesson_number, subject_name, time_start, time_end")
    .eq("group_id", groupId)
    .eq("day_of_week", dbDay)
    .order("lesson_number");

  if (error) {
    return bot.sendMessage(chatId, "Не удалось загрузить расписание. Попробуйте позже.");
  }

  if (!data || data.length === 0) {
    return bot.sendMessage(chatId, `На ${DAY_NAMES[jsDay].toLowerCase()} пар не найдено.`);
  }

  const text = data
    .map(l => `${l.lesson_number}. ${l.subject_name} (${formatTime(l.time_start)}–${formatTime(l.time_end)})`)
    .join("\n");

  bot.sendMessage(chatId, `Расписание на ${DAY_NAMES[jsDay].toLowerCase()}:\n\n${text}`);
});

// -------------------- /now --------------------
bot.onText(/\/now/, async (msg) => {
  const chatId = msg.chat.id;
  const groupId = userGroup.get(chatId);

  if (!groupId) {
    return bot.sendMessage(chatId, "Сначала выберите группу командой /start.");
  }

  const jsDay = new Date().getDay();
  const dbDay = jsDayToDbDay(jsDay);

  if (dbDay === null) {
    return bot.sendMessage(chatId, "Сегодня выходной — пар нет.");
  }

  const { data, error } = await supabase
    .from("schedule")
    .select("lesson_number, subject_name, time_start, time_end")
    .eq("group_id", groupId)
    .eq("day_of_week", dbDay)
    .order("lesson_number");

  if (error) {
    return bot.sendMessage(chatId, "Не удалось загрузить расписание. Попробуйте позже.");
  }

  if (!data || data.length === 0) {
    return bot.sendMessage(chatId, "На сегодня пар не найдено.");
  }

  const now = new Date();
  const nowStr = now.toTimeString().slice(0, 8); // "HH:MM:SS"

  const current = data.find(l => nowStr >= l.time_start && nowStr <= l.time_end);
  if (current) {
    return bot.sendMessage(
      chatId,
      `Сейчас идёт ${current.lesson_number} пара: ${current.subject_name} (${formatTime(current.time_start)}–${formatTime(current.time_end)})`
    );
  }

  const next = data.find(l => nowStr < l.time_start);
  if (next) {
    return bot.sendMessage(chatId, `Сейчас перемена. Следующая пара в ${formatTime(next.time_start)}.`);
  }

  bot.sendMessage(chatId, "На сегодня все пары закончились.");
});

console.log("Бот запущен и слушает обновления...");
