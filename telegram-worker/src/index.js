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
    return await res.json();
  } catch (err) {
    console.error(`[Telegram API Network Error] ${method}:`, err.message);
    return { ok: false, error: err.message };
  }
}

async function sendMessage(token, chatId, text, options = {}) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: options.parse_mode || 'Markdown',
    disable_web_page_preview: options.disable_web_page_preview ?? true
  };
  if (options.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }
  return await callTelegramApi(token, 'sendMessage', payload);
}

async function editMessageText(token, chatId, messageId, text, options = {}) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: options.parse_mode || 'Markdown',
    disable_web_page_preview: options.disable_web_page_preview ?? true
  };
  if (options.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }
  return await callTelegramApi(token, 'editMessageText', payload);
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
  if (!token || !adminChatId) return;

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

  await sendMessage(token, adminChatId, adminMsg, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
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
        const services = await getActiveServices(supabase);
        if (services.length === 0) {
          await editMessageText(token, chatId, messageId, '❌ No active services found. Please check back later.');
          return;
        }

        const buttons = services.map(s => ([{
          text: `💅 ${lang === 'km' && s.nameKm ? s.nameKm : s.name} ($${s.price} • ${s.durationMinutes}m)`,
          callback_data: `svc:${s.id}:${lang}`
        }]));
        buttons.push([{ text: lang === 'km' ? '↩️ ថយក្រោយ' : '↩️ Back', callback_data: `lang:${lang}` }]);

        await editMessageText(token, chatId, messageId, t.chooseService, {
          reply_markup: { inline_keyboard: buttons }
        });
        return;
      }

      if (action === 'services') {
        const services = await getActiveServices(supabase);
        let text = t.servicesHeader;
        for (const s of services) {
          const name = lang === 'km' && s.nameKm ? s.nameKm : s.name;
          const desc = lang === 'km' && s.descriptionKm ? s.descriptionKm : s.description;
          text += `✨ **${name}**\n💵 $${s.price}  |  ⏱️ ${s.durationMinutes} mins\n`;
          if (desc) text += `_${desc}_\n`;
          text += '\n';
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
      dateButtons.push([{ text: lang === 'km' ? '↩️ ថយក្រោយ' : '↩️ Back', callback_data: `menu:book:${lang}` }]);

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
      const [, decision, lang] = data.split(':');
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
        await sendMessage(token, updated.telegramId, custMsg);
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
      const updatedAdminText = `${query.message?.text || ''}\n\n━━━━━━━━━━━━━━━━━━━━\n${statusBadge} by Administrator.`;

      await editMessageText(token, chatId, messageId, updatedAdminText, {
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
    const text = (msg.text || '').trim();
    const contact = msg.contact;
    const fromUser = msg.from || {};

    // 2.1 Handle /start Command
    if (text.startsWith('/start')) {
      sessions.delete(chatId);
      await sendMessage(token, chatId, messages.en.languagePrompt, {
        reply_markup: getLanguageSelectionKeyboard()
      });
      return;
    }

    // 2.2 Handle /language Command
    if (text.startsWith('/language')) {
      await sendMessage(token, chatId, messages.en.languagePrompt, {
        reply_markup: getLanguageSelectionKeyboard()
      });
      return;
    }

    // 2.3 Handle /cancel Command
    if (text.startsWith('/cancel')) {
      sessions.delete(chatId);
      await sendMessage(token, chatId, messages.en.cancelled, {
        reply_markup: getMainMenuKeyboard('en')
      });
      return;
    }

    // 2.4 Handle /myid Command
    if (text.startsWith('/myid')) {
      const idInfo = `👤 **Your Telegram Profile:**\n\n• **Chat ID:** \`${chatId}\`\n• **Username:** @${fromUser.username || 'None'}\n• **Name:** ${fromUser.first_name || ''} ${fromUser.last_name || ''}`.trim();
      await sendMessage(token, chatId, idInfo);
      return;
    }

    // 2.5 Handle /help Command
    if (text.startsWith('/help')) {
      await sendMessage(token, chatId, messages.en.help, {
        reply_markup: getMainMenuKeyboard('en')
      });
      return;
    }

    // 2.6 Handle /services Command
    if (text.startsWith('/services')) {
      const services = await getActiveServices(supabase);
      let catalog = messages.en.servicesHeader;
      for (const s of services) {
        catalog += `✨ **${s.name}**\n💵 $${s.price}  |  ⏱️ ${s.durationMinutes} mins\n_${s.description || ''}_\n\n`;
      }
      await sendMessage(token, chatId, catalog, {
        reply_markup: {
          inline_keyboard: [[{ text: '📅 Book Now', callback_data: 'menu:book:en' }]]
        }
      });
      return;
    }

    // 2.7 Handle /status Command
    if (text.startsWith('/status')) {
      const queryParam = text.replace('/status', '').trim();
      const searchTarget = queryParam || chatId;
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
    if (text.startsWith('/book')) {
      const services = await getActiveServices(supabase);
      const buttons = services.map(s => ([{
        text: `💅 ${s.name} ($${s.price} • ${s.durationMinutes}m)`,
        callback_data: `svc:${s.id}:en`
      }]));
      await sendMessage(token, chatId, messages.en.chooseService, {
        reply_markup: { inline_keyboard: buttons }
      });
      return;
    }

    // 2.9 Handle Contact or Phone Input while in active booking session
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

    // 2.10 Default Fallback
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
  }
};
