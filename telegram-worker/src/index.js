/**
 * ==============================================================================
 * Cloudflare Worker: Bilingual Telegram Bot for Mini Room Nail & Eyelash
 * ==============================================================================
 * Stateless webhook handler running on Cloudflare Workers Free.
 * Powered by Web Standards (fetch, Request, Response), Supabase PostgreSQL,
 * and direct Telegram Bot API calls.
 * ==============================================================================
 */

import {
  getSupabase,
  getSalonSettings,
  getActiveServiceGroups,
  getServiceGroupById,
  getActiveServices,
  getServiceById,
  createBooking,
  findBookingById,
  updateBookingStatus,
  findBookingsByQuery,
  logNotification
} from './db.js';

import {
  DEFAULT_TIMEZONE,
  getLocalToday,
  getLocalCurrentTime,
  isDateWorkingDay,
  getAvailableSlots,
  checkSlotAvailability,
  calculateEndTime
} from './scheduler.js';

import { messages } from './messages.js';

// Deduplication cache for update_id (keeps up to 2,000 recent update IDs)
const processedUpdates = new Set();
const MAX_PROCESSED_UPDATES = 2000;

// In-memory multi-step session cache per isolate
// Key: chatId (string) -> { step, serviceId, date, time, customerName, phone, lang, timestamp }
const sessions = new Map();
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

function cleanOldSessions() {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.timestamp > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
}

// ==============================================================================
// TELEGRAM BOT API CLIENT (Direct Web Standards fetch)
// ==============================================================================

async function callTelegramApi(token, method, payload) {
  if (!token) {
    console.error(`[Telegram API Error] TELEGRAM_BOT_TOKEN is not configured.`);
    return { ok: false, description: 'Missing TELEGRAM_BOT_TOKEN' };
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!result.ok) {
      // Safe error logging: logs error code and Telegram description without revealing token or secrets
      console.warn(`[Telegram API] ${method} returned error code ${result.error_code}: ${result.description}`);
    }
    return result;
  } catch (err) {
    console.error(`[Telegram API Network Error] ${method}:`, err.message);
    return { ok: false, error: err.message };
  }
}

async function sendMessage(token, chatId, text, options = {}) {
  const payload = {
    chat_id: chatId,
    text: text,
    disable_web_page_preview: options.disable_web_page_preview ?? true
  };
  if (options.parse_mode) {
    payload.parse_mode = options.parse_mode;
  } else if (options.parse_mode === undefined) {
    payload.parse_mode = 'Markdown';
  }
  if (options.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }

  let result = await callTelegramApi(token, 'sendMessage', payload);

  // If group was upgraded to supergroup, automatically retry with migrated chat ID
  if (!result.ok && result.parameters?.migrate_to_chat_id) {
    const newChatId = result.parameters.migrate_to_chat_id;
    console.log(`[Telegram Migration] Retrying sendMessage with upgraded supergroup ID: ${newChatId}`);
    payload.chat_id = newChatId;
    result = await callTelegramApi(token, 'sendMessage', payload);
  }

  // If Markdown parse failed (400 Bad Request: can't parse entities), retry as safe plain text
  if (!result.ok && payload.parse_mode && (result.description || '').toLowerCase().includes('parse')) {
    console.warn(`[Telegram Fallback] Retrying sendMessage as plain text due to parse error: ${result.description}`);
    delete payload.parse_mode;
    result = await callTelegramApi(token, 'sendMessage', payload);
  }

  return result;
}

async function editMessageText(token, chatId, messageId, text, options = {}) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    disable_web_page_preview: options.disable_web_page_preview ?? true
  };
  if (options.parse_mode) {
    payload.parse_mode = options.parse_mode;
  } else if (options.parse_mode === undefined) {
    payload.parse_mode = 'Markdown';
  }
  if (options.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }

  let result = await callTelegramApi(token, 'editMessageText', payload);

  // If Markdown parse failed, retry as safe plain text
  if (!result.ok && payload.parse_mode && (result.description || '').toLowerCase().includes('parse')) {
    delete payload.parse_mode;
    result = await callTelegramApi(token, 'editMessageText', payload);
  }

  return result;
}

async function answerCallbackQuery(token, callbackQueryId, text = '', showAlert = false) {
  return await callTelegramApi(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text,
    show_alert: showAlert
  });
}

// Notify salon administrator of a new booking
async function alertAdminNewBooking(token, adminChatId, booking) {
  if (!token || !adminChatId) {
    console.warn('[Admin Alert Skipped] Missing TELEGRAM_BOT_TOKEN or ADMIN_TELEGRAM_CHAT_ID.');
    return { ok: false, reason: 'unconfigured' };
  }

  const lang = booking.language === 'km' ? 'km' : 'en';
  const t = messages[lang] || messages.en;
  const adminMsg = t.adminNew(booking);

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '✅ Confirm / បញ្ជាក់', callback_data: `admin:confirm:${booking.id || booking._id}` },
        { text: '❌ Reject / បដិសេធ', callback_data: `admin:reject:${booking.id || booking._id}` }
      ]
    ]
  };

  const res = await sendMessage(token, adminChatId, adminMsg, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });

  if (!res.ok) {
    console.error(`[Admin Alert Failed] target_chat=${adminChatId}: ${res.description || res.error || 'Unknown error'}`);
  }
  return res;
}

// ==============================================================================
// KEYBOARDS & UI BUILDERS
// ==============================================================================

function getLanguageSelectionKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🇰🇭 ភាសាខ្មែរ (Khmer)', callback_data: 'lang:km' },
        { text: '🇬🇧 English', callback_data: 'lang:en' }
      ]
    ]
  };
}

function getMainMenuKeyboard(lang = 'en') {
  const t = messages[lang] || messages.en;
  return {
    inline_keyboard: [
      [{ text: t.book, callback_data: `menu:book:${lang}` }],
      [
        { text: t.services, callback_data: `menu:services:${lang}` },
        { text: t.myBookings, callback_data: `menu:status:${lang}` }
      ],
      [
        { text: t.locationBtn || (lang === 'km' ? '📍 ទីតាំងហាង' : '📍 Our Location / ទីតាំងហាង'), callback_data: `menu:location:${lang}` }
      ],
      [
        { text: t.changeLang, callback_data: 'menu:lang' },
        { text: t.helpBtn, callback_data: `menu:help:${lang}` }
      ]
    ]
  };
}

function getNextSevenDays(settings, timeZone) {
  const dates = [];
  const todayStr = getLocalToday(timeZone);
  const [y, m, d] = todayStr.split('-').map(Number);
  const baseDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(baseDate.getTime() + i * 86400000);
    const dateStr = nextDate.toISOString().slice(0, 10);
    const check = isDateWorkingDay(dateStr, settings, timeZone);
    if (check.ok) {
      dates.push(dateStr);
    }
  }
  return dates;
}

// ==============================================================================
// MAIN UPDATE DISPATCHER
// ==============================================================================

async function handleUpdate(update, env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const timeZone = env.SALON_TIMEZONE || DEFAULT_TIMEZONE;
  const salonName = env.SALON_NAME || 'Mini Room Nail & Eyelash';
  const supabase = getSupabase(env);
  const settings = await getSalonSettings(supabase, salonName);

  cleanOldSessions();

  // ----------------------------------------------------------------------------
  // 1. Handle Inline Callback Queries (Button Clicks)
  // ----------------------------------------------------------------------------
  if (update.callback_query) {
    const query = update.callback_query;
    const queryId = query.id;
    const chatId = String(query.message?.chat?.id || query.from?.id);
    const messageId = query.message?.message_id;
    const data = query.data || '';
    const fromUser = query.from || {};

    // 1.1 Language Selection
    if (data.startsWith('lang:')) {
      const selectedLang = data.split(':')[1] === 'km' ? 'km' : 'en';
      await answerCallbackQuery(token, queryId);
      const t = messages[selectedLang];
      const welcomeText = t.welcome(salonName);
      await editMessageText(token, chatId, messageId, welcomeText, {
        reply_markup: getMainMenuKeyboard(selectedLang)
      });
      return;
    }

    // 1.2 Main Menu Navigation
    if (data.startsWith('menu:')) {
      const parts = data.split(':');
      const action = parts[1];
      const lang = parts[2] === 'km' ? 'km' : 'en';
      const t = messages[lang];
      await answerCallbackQuery(token, queryId);

      if (action === 'lang') {
        await editMessageText(token, chatId, messageId, messages.en.languagePrompt, {
          reply_markup: getLanguageSelectionKeyboard()
        });
        return;
      }

      if (action === 'book') {
        const groups = await getActiveServiceGroups(supabase);
        const allServices = await getActiveServices(supabase);
        const validGroups = groups.filter(g => allServices.some(s => String(s.groupId) === String(g.id)));

        if (validGroups.length === 0 && allServices.length === 0) {
          await editMessageText(token, chatId, messageId, '❌ No active services found. Please check back later.');
          return;
        }

        const buttons = validGroups.map(g => {
          const count = allServices.filter(s => String(s.groupId) === String(g.id)).length;
          const label = lang === 'km' && g.nameKm ? g.nameKm : g.name;
          return [{
            text: `📁 ${label} (${count})`,
            callback_data: `grp:${g.id}:${lang}:0`
          }];
        });
        buttons.push([{ text: lang === 'km' ? '↩️ ម៉ឺនុយមេ' : '↩️ Main Menu', callback_data: `lang:${lang}` }]);

        await editMessageText(token, chatId, messageId, t.chooseGroup, {
          reply_markup: { inline_keyboard: buttons }
        });
        return;
      }

      if (action === 'services') {
        const groups = await getActiveServiceGroups(supabase);
        const allServices = await getActiveServices(supabase);
        let text = t.servicesHeader;
        for (const g of groups) {
          const grpServices = allServices.filter(s => String(s.groupId) === String(g.id));
          if (grpServices.length > 0) {
            const gName = lang === 'km' && g.nameKm ? g.nameKm : g.name;
            const gAlt = lang === 'km' ? g.name : g.nameKm;
            text += `📁 **${gName}** _(${gAlt})_\n`;
            for (const s of grpServices) {
              const name = lang === 'km' && s.nameKm ? s.nameKm : s.name;
              text += `• **${name}** — $${s.price} (${s.durationMinutes}m)\n`;
            }
            text += '\n';
          }
        }
        const backKeyboard = {
          inline_keyboard: [
            [{ text: t.book, callback_data: `menu:book:${lang}` }],
            [{ text: lang === 'km' ? '↩️ ម៉ឺនុយមេ' : '↩️ Main Menu', callback_data: `lang:${lang}` }]
          ]
        };
        await editMessageText(token, chatId, messageId, text, { reply_markup: backKeyboard });
        return;
      }

      if (action === 'status') {
        const bookings = await findBookingsByQuery(supabase, chatId);
        if (bookings.length === 0) {
          const noMsg = lang === 'km'
            ? 'ℹ️ មិនទាន់មានប្រវត្តិការកក់សម្រាប់គណនី Telegram នេះទេ។\nសូមវាយ `/status <លេខកូដ>` ដើម្បីពិនិត្យ ឬចុចខាងក្រោមដើម្បីកក់៖'
            : 'ℹ️ No appointments found for this Telegram account.\nType `/status <REFERENCE>` to look up by code, or book below:';
          await editMessageText(token, chatId, messageId, noMsg, {
            reply_markup: {
              inline_keyboard: [
                [{ text: t.book, callback_data: `menu:book:${lang}` }],
                [{ text: lang === 'km' ? '↩️ ម៉ឺនុយមេ' : '↩️ Main Menu', callback_data: `lang:${lang}` }]
              ]
            }
          });
          return;
        }

        let msg = lang === 'km' ? '🔍 **ប្រវត្តិការកក់របស់អ្នក៖**\n\n' : '🔍 **Your Recent Appointments:**\n\n';
        for (const b of bookings) {
          const serviceName = lang === 'km' && b.serviceKm ? b.serviceKm : b.service;
          msg += `🔖 \`${b.bookingReference}\` — ${serviceName}\n📅 ${b.date} @ ${b.time} (${b.status.toUpperCase()})\n\n`;
        }
        await editMessageText(token, chatId, messageId, msg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: t.book, callback_data: `menu:book:${lang}` }],
              [{ text: lang === 'km' ? '↩️ ម៉ឺនុយមេ' : '↩️ Main Menu', callback_data: `lang:${lang}` }]
            ]
          }
        });
        return;
      }

      if (action === 'location') {
        const locText = t.locationInfo(salonName);
        const locKeyboard = {
          inline_keyboard: [
            [{ text: t.getDirectionsBtn || (lang === 'km' ? '🗺️ មើលផ្លូវទៅហាង' : '🗺️ Get Directions'), url: 'https://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it' }],
            [{ text: lang === 'km' ? '↩️ ម៉ឺនុយមេ' : '↩️ Main Menu', callback_data: `lang:${lang}` }]
          ]
        };
        await editMessageText(token, chatId, messageId, locText, { reply_markup: locKeyboard });
        return;
      }

      if (action === 'help') {
        await editMessageText(token, chatId, messageId, t.help, {
          reply_markup: {
            inline_keyboard: [
              [{ text: t.book, callback_data: `menu:book:${lang}` }],
              [{ text: lang === 'km' ? '↩️ ម៉ឺនុយមេ' : '↩️ Main Menu', callback_data: `lang:${lang}` }]
            ]
          }
        });
        return;
      }
    }

    if (data === 'noop') {
      await answerCallbackQuery(token, queryId);
      return;
    }

    // 1.2.5 Group Selection -> Services in Group
    if (data.startsWith('grp:')) {
      const parts = data.split(':');
      const groupId = parts[1];
      const lang = parts[2] === 'km' ? 'km' : 'en';
      const page = parseInt(parts[3] || '0', 10);
      const t = messages[lang] || messages.en;
      await answerCallbackQuery(token, queryId);

      const group = await getServiceGroupById(supabase, groupId);
      const groupName = group ? (lang === 'km' && group.nameKm ? group.nameKm : group.name) : 'Group';
      const services = await getActiveServices(supabase, groupId);

      if (services.length === 0) {
        await editMessageText(token, chatId, messageId, t.emptyGroup, {
          reply_markup: {
            inline_keyboard: [
              [{ text: t.backToGroups, callback_data: `menu:book:${lang}` }]
            ]
          }
        });
        return;
      }

      const PAGE_SIZE = 6;
      const totalPages = Math.ceil(services.length / PAGE_SIZE);
      const currentPage = Math.max(0, Math.min(page, totalPages - 1));
      const startIdx = currentPage * PAGE_SIZE;
      const pageServices = services.slice(startIdx, startIdx + PAGE_SIZE);

      const buttons = pageServices.map(s => ([{
        text: `💅 ${lang === 'km' && s.nameKm ? s.nameKm : s.name} ($${s.price} • ${s.durationMinutes}m)`,
        callback_data: `svc:${s.id}:${lang}`
      }]));

      if (totalPages > 1) {
        const navRow = [];
        if (currentPage > 0) {
          navRow.push({ text: '⬅️ Prev', callback_data: `grp:${groupId}:${lang}:${currentPage - 1}` });
        }
        navRow.push({ text: `📄 ${currentPage + 1}/${totalPages}`, callback_data: `noop` });
        if (currentPage < totalPages - 1) {
          navRow.push({ text: 'Next ➡️', callback_data: `grp:${groupId}:${lang}:${currentPage + 1}` });
        }
        buttons.push(navRow);
      }

      buttons.push([{ text: t.backToGroups, callback_data: `menu:book:${lang}` }]);

      await editMessageText(token, chatId, messageId, t.servicesInGroup(groupName), {
        reply_markup: { inline_keyboard: buttons }
      });
      return;
    }

    // 1.3 Service Selection -> Date Picker
    if (data.startsWith('svc:')) {
      const [, serviceId, lang] = data.split(':');
      const t = messages[lang] || messages.en;
      const service = await getServiceById(supabase, serviceId);
      if (!service) {
        await answerCallbackQuery(token, queryId, 'Service not found', true);
        return;
      }

      await answerCallbackQuery(token, queryId);
      const availableDates = getNextSevenDays(settings, timeZone);
      if (availableDates.length === 0) {
        await editMessageText(token, chatId, messageId, t.dateClosed, {
          reply_markup: {
            inline_keyboard: [[{ text: '↩️ Back to Services', callback_data: `menu:book:${lang}` }]]
          }
        });
        return;
      }

      const dateButtons = availableDates.map(dateStr => ([{
        text: `📅 ${dateStr}`,
        callback_data: `dt:${serviceId}:${dateStr}:${lang}`
      }]));

      const backCallback = service.groupId ? `grp:${service.groupId}:${lang}:0` : `menu:book:${lang}`;
      dateButtons.push([{ text: lang === 'km' ? '↩️ ថយក្រោយ' : '↩️ Back', callback_data: backCallback }]);

      const promptText = `${t.selectedService(service)}\n\n${t.askDate}`;
      await editMessageText(token, chatId, messageId, promptText, {
        reply_markup: { inline_keyboard: dateButtons }
      });
      return;
    }

    // 1.4 Date Selection -> Time Slot Grid
    if (data.startsWith('dt:')) {
      const [, serviceId, dateStr, lang] = data.split(':');
      const t = messages[lang] || messages.en;
      const service = await getServiceById(supabase, serviceId);
      if (!service) {
        await answerCallbackQuery(token, queryId, 'Service not found', true);
        return;
      }

      await answerCallbackQuery(token, queryId);
      const availableSlots = await getAvailableSlots(supabase, dateStr, service.durationMinutes, settings, timeZone);

      if (availableSlots.length === 0) {
        await editMessageText(token, chatId, messageId, t.noSlotsOnDate, {
          reply_markup: {
            inline_keyboard: [[{ text: '📅 Choose Another Date', callback_data: `svc:${serviceId}:${lang}` }]]
          }
        });
        return;
      }

      // Group time slots in rows of 3 buttons
      const slotKeyboard = [];
      let currentRow = [];
      for (const slot of availableSlots) {
        currentRow.push({
          text: `⏰ ${slot.time}`,
          callback_data: `sl:${serviceId}:${dateStr}:${slot.time}:${lang}`
        });
        if (currentRow.length === 3) {
          slotKeyboard.push(currentRow);
          currentRow = [];
        }
      }
      if (currentRow.length > 0) {
        slotKeyboard.push(currentRow);
      }
      slotKeyboard.push([{ text: lang === 'km' ? '↩️ ជ្រើសរើសថ្ងៃឡើងវិញ' : '↩️ Back to Dates', callback_data: `svc:${serviceId}:${lang}` }]);

      const headerText = `💅 **${lang === 'km' && service.nameKm ? service.nameKm : service.name}**\n📅 **${dateStr}**\n\n${t.askTime}`;
      await editMessageText(token, chatId, messageId, headerText, {
        reply_markup: { inline_keyboard: slotKeyboard }
      });
      return;
    }

    // 1.5 Time Slot Selection -> Confirmation / Phone Input
    if (data.startsWith('sl:')) {
      const [, serviceId, dateStr, timeStr, lang] = data.split(':');
      const t = messages[lang] || messages.en;
      const service = await getServiceById(supabase, serviceId);
      if (!service) {
        await answerCallbackQuery(token, queryId, 'Service not found', true);
        return;
      }

      const endTime = calculateEndTime(timeStr, service.durationMinutes);
      const customerName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ') || fromUser.username || 'Valued Customer';

      // Check if user has a phone on file from a previous booking
      const { data: previousBookings } = await supabase
        .from('bookings')
        .select('phone, customer_name')
        .eq('telegram_id', chatId)
        .order('created_at', { ascending: false })
        .limit(1);

      const previousPhone = previousBookings && previousBookings.length > 0 ? previousBookings[0].phone : null;

      sessions.set(chatId, {
        step: 'confirming',
        serviceId: service.id,
        service: service.name,
        serviceKm: service.nameKm,
        price: service.price,
        durationMinutes: service.durationMinutes,
        date: dateStr,
        time: timeStr,
        endTime: endTime,
        customerName: previousBookings && previousBookings[0]?.customer_name ? previousBookings[0].customer_name : customerName,
        phone: previousPhone || '',
        lang: lang,
        timestamp: Date.now()
      });

      await answerCallbackQuery(token, queryId);

      if (previousPhone) {
        // Customer has phone on file -> Provide 1-Click Confirmation
        const draft = sessions.get(chatId);
        const reviewText = t.review(draft);
        const reviewButtons = [
          [{ text: t.confirmBtn, callback_data: `cf:ok:${lang}` }],
          [{ text: lang === 'km' ? '✏️ ផ្លាស់ប្តូរលេខទូរស័ព្ទ' : '✏️ Change Phone Number', callback_data: `chg_phone:${lang}` }],
          [{ text: t.cancelBtn, callback_data: `cf:cancel:${lang}` }]
        ];
        await editMessageText(token, chatId, messageId, reviewText, {
          reply_markup: { inline_keyboard: reviewButtons }
        });
        return;
      }

      // Customer needs to enter phone number
      sessions.get(chatId).step = 'awaiting_phone';
      const promptPhone = `${t.askPhone}\n\n_${lang === 'km' ? 'សូមវាយបញ្ចូលលេខទូរស័ព្ទរបស់អ្នកតាមរយៈសារឆ្លើយតប (ឧទាហរណ៍ 012345678)' : 'Please type your contact phone number in a message reply (e.g. 012345678)'}_`;
      await editMessageText(token, chatId, messageId, promptPhone, {
        reply_markup: {
          inline_keyboard: [[{ text: t.cancelBtn, callback_data: `cf:cancel:${lang}` }]]
        }
      });
      return;
    }

    // 1.6 Change Phone Flow
    if (data.startsWith('chg_phone:')) {
      const [, lang] = data.split(':');
      const t = messages[lang] || messages.en;
      if (sessions.has(chatId)) {
        sessions.get(chatId).step = 'awaiting_phone';
      }
      await answerCallbackQuery(token, queryId);
      await editMessageText(token, chatId, messageId, t.askPhone, {
        reply_markup: {
          inline_keyboard: [[{ text: t.cancelBtn, callback_data: `cf:cancel:${lang}` }]]
        }
      });
      return;
    }

    // 1.7 Final Booking Confirmation
    if (data.startsWith('cf:')) {
      const [, decision, rawLang] = data.split(':');
      const lang = (rawLang === 'km') ? 'km' : 'en';
      const t = messages[lang] || messages.en;

      if (decision === 'cancel') {
        sessions.delete(chatId);
        await answerCallbackQuery(token, queryId, 'Cancelled');
        await editMessageText(token, chatId, messageId, t.cancelled, {
          reply_markup: getMainMenuKeyboard(lang)
        });
        return;
      }

      if (decision === 'ok') {
        const draft = sessions.get(chatId);
        if (!draft || !draft.phone) {
          await answerCallbackQuery(token, queryId, 'Session expired', true);
          await editMessageText(token, chatId, messageId, t.notSaved, {
            reply_markup: getMainMenuKeyboard(lang)
          });
          return;
        }

        // Slot re-validation to prevent race conditions & double-booking
        const availability = await checkSlotAvailability(
          supabase,
          draft.date,
          draft.time,
          draft.durationMinutes,
          settings,
          null,
          timeZone
        );

        if (!availability.available) {
          await answerCallbackQuery(token, queryId, 'Slot is no longer available', true);
          await editMessageText(token, chatId, messageId, t.slotUnavailable, {
            reply_markup: {
              inline_keyboard: [[{ text: '📅 Choose Another Slot', callback_data: `svc:${draft.serviceId}:${lang}` }]]
            }
          });
          return;
        }

        // Duplicate-booking check (same customer, date, time within last 5 minutes)
        const { data: existingDuplicate } = await supabase
          .from('bookings')
          .select('*')
          .eq('telegram_id', chatId)
          .eq('date', draft.date)
          .eq('time', draft.time)
          .maybeSingle();

        let created;
        if (existingDuplicate) {
          created = existingDuplicate;
        } else {
          created = await createBooking(supabase, {
            customerName: draft.customerName,
            phone: draft.phone,
            serviceId: draft.serviceId,
            service: draft.service,
            serviceKm: draft.serviceKm,
            price: draft.price,
            durationMinutes: draft.durationMinutes,
            date: draft.date,
            time: draft.time,
            endTime: draft.endTime,
            telegramId: chatId,
            source: 'telegram',
            language: lang,
            status: 'pending'
          });

          // Send instant alert to admin
          await alertAdminNewBooking(token, env.ADMIN_TELEGRAM_CHAT_ID, created);
        }

        sessions.delete(chatId);
        await answerCallbackQuery(token, queryId, 'Success! 🎉');
        await editMessageText(token, chatId, messageId, t.saved(created), {
          reply_markup: getMainMenuKeyboard(lang)
        });
        return;
      }
    }

    // 1.8 Administrator 1-Click Action Buttons
    if (data.startsWith('admin:')) {
      const [, action, bookingId] = data.split(':');
      const targetStatus = action === 'confirm' ? 'confirmed' : 'rejected';

      const booking = await findBookingById(supabase, bookingId);
      if (!booking) {
        await answerCallbackQuery(token, queryId, 'Booking not found', true);
        return;
      }

      // Prevent duplicate notification if already processed
      if (booking.status === targetStatus) {
        await answerCallbackQuery(token, queryId, `Already marked as ${targetStatus}.`, true);
        return;
      }

      const updated = await updateBookingStatus(supabase, bookingId, targetStatus);
      const custLang = updated.language === 'km' ? 'km' : 'en';
      const custMsg = targetStatus === 'confirmed'
        ? messages[custLang].statusConfirmed(updated)
        : messages[custLang].statusRejected(updated);

      // Notify customer if they booked via Telegram
      if (updated.telegramId) {
        const replyMarkup = targetStatus === 'confirmed' ? {
          inline_keyboard: [
            [{ text: '🗺️ Get Directions / មើលផ្លូវទៅហាង', url: 'https://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it' }]
          ]
        } : undefined;
        await sendMessage(token, updated.telegramId, custMsg, { reply_markup: replyMarkup });
        await logNotification(supabase, {
          bookingId: updated.id,
          recipient: updated.telegramId,
          channel: 'telegram',
          message: custMsg,
          status: 'sent'
        });
      }

      await answerCallbackQuery(token, queryId, `Booking #${updated.bookingReference} ${targetStatus}!`);

      const statusBadge = targetStatus === 'confirmed' ? '✅ CONFIRMED' : '❌ REJECTED';
      const originalText = query.message?.text || '';
      const updatedAdminText = `${originalText}\n\n━━━━━━━━━━━━━━━━━━━━\n${statusBadge} by Administrator.`;

      // Use safe parse_mode: null to prevent markdown errors on plain message text
      await editMessageText(token, chatId, messageId, updatedAdminText, {
        parse_mode: null,
        reply_markup: { inline_keyboard: [] } // Remove action buttons to prevent double-click
      });
      return;
    }
  }

  // ----------------------------------------------------------------------------
  // 2. Handle Text Messages & Contact Cards
  // ----------------------------------------------------------------------------
  if (update.message) {
    const msg = update.message;
    const chatId = String(msg.chat.id);
    const chatType = msg.chat?.type || 'private'; // 'private', 'group', 'supergroup', 'channel'
    const isGroup = (chatType === 'group' || chatType === 'supergroup');
    const text = (msg.text || '').trim();
    const contact = msg.contact;
    const fromUser = msg.from || {};

    // Handle group migration to supergroup event
    if (msg.migrate_to_chat_id) {
      console.log(`[Telegram Migration] Group ${chatId} was migrated to supergroup ${msg.migrate_to_chat_id}`);
      return;
    }

    // Normalize command and argument (supports /cmd and /cmd@botname)
    let command = null;
    let commandArg = '';
    if (text.startsWith('/')) {
      const match = text.match(/^\/([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9_]+))?(?:\s+(.*))?$/s);
      if (match) {
        command = match[1].toLowerCase();
        commandArg = (match[3] || '').trim();
      }
    }

    // 2.1 Handle /start Command
    if (command === 'start') {
      if (isGroup) {
        const botUsername = (env.TELEGRAM_BOT_USERNAME || 'miniroomnail_bot').replace(/^@/, '');
        await sendMessage(token, chatId, `💅 **${salonName} Bot** is active in this group.\n\nNew booking notifications will appear here with confirmation buttons.\nTo make an appointment privately, please click below:`, {
          reply_markup: {
            inline_keyboard: [[{ text: '💬 Open Bot Private Chat', url: `https://t.me/${botUsername}` }]]
          }
        });
        return;
      }
      sessions.delete(chatId);
      await sendMessage(token, chatId, messages.en.languagePrompt, {
        reply_markup: getLanguageSelectionKeyboard()
      });
      return;
    }

    // 2.2 Handle /language Command
    if (command === 'language') {
      if (isGroup) {
        await sendMessage(token, chatId, 'ℹ️ The language menu is designed for customer appointment booking in direct chat.');
        return;
      }
      await sendMessage(token, chatId, messages.en.languagePrompt, {
        reply_markup: getLanguageSelectionKeyboard()
      });
      return;
    }

    // 2.3 Handle /cancel Command
    if (command === 'cancel') {
      if (isGroup) return;
      sessions.delete(chatId);
      await sendMessage(token, chatId, messages.en.cancelled, {
        reply_markup: getMainMenuKeyboard('en')
      });
      return;
    }

    // 2.4 Handle /myid, /chatid, /groupid Command
    if (command === 'myid' || command === 'chatid' || command === 'groupid') {
      let idInfo;
      if (isGroup) {
        idInfo = `👥 **Telegram Group Details:**\n\n` +
          `• **Group Title:** ${msg.chat.title || 'Admin Group'}\n` +
          `• **Chat ID:** \`${chatId}\`\n` +
          `• **Chat Type:** \`${chatType}\`\n` +
          `• **Sender:** ${fromUser.first_name || ''} (@${fromUser.username || 'None'})\n\n` +
          `💡 *Copy this Chat ID to configure ADMIN_TELEGRAM_CHAT_ID in Cloudflare Workers or .env.*`;
      } else {
        idInfo = `👤 **Your Telegram Profile:**\n\n• **Chat ID:** \`${chatId}\`\n• **Username:** @${fromUser.username || 'None'}\n• **Name:** ${fromUser.first_name || ''} ${fromUser.last_name || ''}`.trim();
      }
      await sendMessage(token, chatId, idInfo);
      return;
    }

    // 2.5 Handle /help Command
    if (command === 'help') {
      if (isGroup) {
        const groupHelp = `👥 **Admin Group Commands:**\n\n` +
          `• \`/myid\` or \`/chatid\` - View this group's Chat ID for configuration\n` +
          `• \`/status <REF>\` - Look up an appointment by reference (e.g. \`/status NL-123456\`)\n` +
          `• \`/services\` - View active fingernail services and pricing\n` +
          `• \`/location\` - View Google Maps location link\n\n` +
          `ℹ️ *New appointment alerts with Confirm / Reject buttons appear automatically in this group.*`;
        await sendMessage(token, chatId, groupHelp);
        return;
      }
      await sendMessage(token, chatId, messages.en.help, {
        reply_markup: getMainMenuKeyboard('en')
      });
      return;
    }

    // 2.6 Handle /services Command
    if (command === 'services') {
      const services = await getActiveServices(supabase);
      let catalog = messages.en.servicesHeader;
      for (const s of services) {
        catalog += `✨ **${s.name}**\n💵 $${s.price}  |  ⏱️ ${s.durationMinutes} mins\n_${s.description || ''}_\n\n`;
      }
      const replyMarkup = isGroup
        ? undefined
        : { inline_keyboard: [[{ text: '📅 Book Now', callback_data: 'menu:book:en' }]] };
      await sendMessage(token, chatId, catalog, { reply_markup: replyMarkup });
      return;
    }

    // 2.7 Handle /location, /map, /directions Command
    if (command === 'location' || command === 'map' || command === 'directions') {
      const bilingualText = `📍 **${salonName}**\n\n` +
        `🇰🇭 **ទីតាំងហាង៖**\nសូមស្វាគមន៍មកកាន់ហាងយើងខ្ញុំ! បងអាចចុចតំណភ្ជាប់ខាងក្រោមដើម្បីមើលទីតាំង ឬផ្លូវធ្វើដំណើរនៅលើ Google Maps:\n` +
        `🗺️ [មើលផ្លូវទៅហាងនៅលើ Google Maps](https://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it)\n\n` +
        `🇬🇧 **Location & Directions:**\nWelcome to our salon! Tap the link below to get directions or view our location on Google Maps:\n` +
        `🗺️ [Get Directions on Google Maps](https://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it)\n\n` +
        `📍 \`https://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it\``;

      const replyMarkup = {
        inline_keyboard: [
          [{ text: '🗺️ Get Directions / មើលផ្លូវទៅហាង', url: 'https://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it' }],
          ...(isGroup ? [] : [[{ text: '🏠 Main Menu / ម៉ឺនុយមេ', callback_data: 'lang:km' }]])
        ]
      };
      await sendMessage(token, chatId, bilingualText, { reply_markup: replyMarkup });
      return;
    }

    // 2.8 Handle /status Command
    if (command === 'status') {
      const searchTarget = commandArg || (isGroup ? '' : chatId);
      if (!searchTarget) {
        await sendMessage(token, chatId, 'ℹ️ Please specify a booking reference to check, e.g.:\n`/status NL-123456`');
        return;
      }
      const results = await findBookingsByQuery(supabase, searchTarget);

      if (results.length === 0) {
        await sendMessage(token, chatId, `ℹ️ No bookings found matching "${searchTarget}".`);
        return;
      }

      let resp = '🔍 **Appointment Status:**\n\n';
      for (const b of results) {
        resp += `🔖 Ref: \`${b.bookingReference}\`\n💅 Service: ${b.service}\n📅 Date: ${b.date} @ ${b.time}\n⏳ Status: **${b.status.toUpperCase()}**\n\n`;
      }
      await sendMessage(token, chatId, resp);
      return;
    }

    // 2.8 Handle /book Command
    if (command === 'book') {
      if (isGroup) {
        await sendMessage(token, chatId, `ℹ️ Customer appointment booking is conducted privately to protect contact details. Please message the bot directly.`);
        return;
      }
      const groups = await getActiveServiceGroups(supabase);
      const allServices = await getActiveServices(supabase);
      const validGroups = groups.filter(g => allServices.some(s => String(s.groupId) === String(g.id)));

      const buttons = validGroups.map(g => {
        const count = allServices.filter(s => String(s.groupId) === String(g.id)).length;
        return [{
          text: `📁 ${g.name} (${count})`,
          callback_data: `grp:${g.id}:en:0`
        }];
      });
      buttons.push([{ text: '↩️ Main Menu', callback_data: 'lang:en' }]);

      await sendMessage(token, chatId, messages.en.chooseGroup, {
        reply_markup: { inline_keyboard: buttons }
      });
      return;
    }

    // In group chats, ignore non-command regular messages to avoid spamming the group
    if (isGroup) {
      return;
    }

    // 2.9 Handle Contact or Phone Input while in active booking session (Private chat only)
    const currentSession = sessions.get(chatId);
    let candidatePhone = contact?.phone_number || '';
    if (!candidatePhone && /^[0-9+ -]{8,20}$/.test(text)) {
      candidatePhone = text.replace(/[^0-9+]/g, '');
    }

    if (currentSession && currentSession.step === 'awaiting_phone' && candidatePhone) {
      currentSession.phone = candidatePhone;
      currentSession.step = 'confirming';
      const lang = currentSession.lang || 'en';
      const t = messages[lang] || messages.en;

      const reviewText = t.review(currentSession);
      const reviewButtons = [
        [{ text: t.confirmBtn, callback_data: `cf:ok:${lang}` }],
        [{ text: lang === 'km' ? '✏️ ផ្លាស់ប្តូរលេខទូរស័ព្ទ' : '✏️ Change Phone', callback_data: `chg_phone:${lang}` }],
        [{ text: t.cancelBtn, callback_data: `cf:cancel:${lang}` }]
      ];

      await sendMessage(token, chatId, reviewText, {
        reply_markup: { inline_keyboard: reviewButtons }
      });
      return;
    }

    // 2.10 Default Fallback (Private chat only)
    await sendMessage(token, chatId, `💅 **${salonName}**\nPlease choose an option from the menu:`, {
      reply_markup: getMainMenuKeyboard('en')
    });
  }
}

// ==============================================================================
// CLOUDFLARE WORKER EXPORT (Fetch Handler)
// ==============================================================================

export default {
  /**
   * Cloudflare Worker HTTP request entry point
   * @param {Request} request
   * @param {object} env - Cloudflare Worker environment variables & secrets
   * @param {object} ctx - Execution context (e.g. waitUntil)
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --------------------------------------------------------------------------
    // Route 1: Health Check (GET / or GET /health)
    // --------------------------------------------------------------------------
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'mini-room-telegram-bot',
        platform: 'Cloudflare Workers',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --------------------------------------------------------------------------
    // Route 2: Telegram Webhook (POST / or POST /webhook)
    // --------------------------------------------------------------------------
    if (request.method === 'POST') {
      // 1. Secret Token Verification (Defense against spoofed webhook calls)
      const expectedSecret = (env.TELEGRAM_WEBHOOK_SECRET || '').trim();
      if (expectedSecret) {
        const receivedSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
        if (receivedSecret !== expectedSecret) {
          console.warn('[Security Warning] Webhook call rejected: invalid secret token.');
          return new Response('Unauthorized', { status: 403 });
        }
      }

      // 2. Parse Telegram Update Payload
      let update;
      try {
        update = await request.json();
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!update || typeof update !== 'object') {
        return new Response(JSON.stringify({ error: 'Missing update object' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 3. Duplicate-Update Protection
      if (update.update_id) {
        if (processedUpdates.has(update.update_id)) {
          // Acknowledge duplicate without re-executing
          return new Response(JSON.stringify({ ok: true, skipped: 'duplicate_update' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        processedUpdates.add(update.update_id);
        if (processedUpdates.size > MAX_PROCESSED_UPDATES) {
          const oldest = processedUpdates.values().next().value;
          processedUpdates.delete(oldest);
        }
      }

      // 4. Process update
      try {
        await handleUpdate(update, env);
      } catch (err) {
        console.error('[Worker Update Handler Error]:', err);
      }

      // Always acknowledge 200 OK to Telegram to avoid delivery loops
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method Not Allowed', { status: 405 });
  },

  /**
   * Cloudflare Worker Scheduled Cron Handler
   * Runs automated 3-month retention cleanup if ENABLE_AUTO_CLEANUP === 'true'
   * @param {object} event - Cron trigger event
   * @param {object} env - Worker environment bindings
   * @param {object} ctx - Execution context
   */
  async scheduled(event, env, ctx) {
    if (env.ENABLE_AUTO_CLEANUP !== 'true') {
      console.log('[Retention Cron] ENABLE_AUTO_CLEANUP is not "true". Automatic cleanup is skipped.');
      return;
    }

    try {
      const supabase = getSupabase(env);
      const retentionDays = Number(env.RETENTION_DAYS || 90);
      const timeZone = env.SALON_TIMEZONE || DEFAULT_TIMEZONE;

      const todayStr = getLocalToday(timeZone);
      const [y, m, d] = todayStr.split('-').map(Number);
      const base = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      base.setUTCDate(base.getUTCDate() - retentionDays);
      const cutoffDate = base.toISOString().slice(0, 10);
      const cutoffTimestamp = base.toISOString();

      // Query eligible records: appointment date < cutoffDate AND created_at < cutoffTimestamp AND date < todayStr
      const { data: eligible, error: selectErr } = await supabase
        .from('bookings')
        .select('id')
        .lt('date', cutoffDate)
        .lt('created_at', cutoffTimestamp)
        .lt('date', todayStr);

      if (selectErr) {
        console.error('[Retention Cron Error] Selection query failed:', selectErr.message);
        return;
      }

      if (!eligible || eligible.length === 0) {
        console.log(`[Retention Cron] 0 expired bookings older than ${cutoffDate}. Cleanup completed with no records deleted.`);
        return;
      }

      const ids = eligible.map(r => r.id);
      const { error: delErr } = await supabase
        .from('bookings')
        .delete()
        .in('id', ids);

      if (delErr) {
        console.error('[Retention Cron Error] Deletion failed:', delErr.message);
      } else {
        console.log(`[Retention Cron] Successfully cleaned up ${ids.length} expired booking records older than ${cutoffDate}.`);
      }
    } catch (err) {
      console.error('[Retention Cron Exception]:', err.message);
    }
  }
};
