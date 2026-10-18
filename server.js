require('dotenv').config();
const path = require('path');
const express = require('express');
const basicAuth = require('express-basic-auth');

// Models & Utilities
const Service = require('./models/Service');
const SalonSetting = require('./models/SalonSetting');
const Booking = require('./models/Booking');
const User = require('./models/User');
const Notification = require('./models/Notification');
const { testConnection } = require('./config/supabase');
const {
  DEFAULT_TIMEZONE,
  calculateEndTime,
  getLocalToday,
  getLocalCurrentTime,
  getAvailableSlots,
  checkSlotAvailability
} = require('./utils/scheduler');
const { previewExpiredBookings, executeExpiredBookingsCleanup } = require('./utils/retention');
const { supabase } = require('./config/supabase');
const { messages } = require('./bot/messages');

const app = express();
const PORT = process.env.PORT || 3000;
const SALON_NAME = process.env.SALON_NAME || 'Mini Room Nail & Eyelash';
const SALON_PHONE = process.env.SALON_PHONE || '012345678';

// Express middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Language helper for web requests
function getLang(req) {
  if (req.query.lang === 'km' || req.query.lang === 'en') {
    return req.query.lang;
  }
  if (req.body && (req.body.lang === 'km' || req.body.lang === 'en')) {
    return req.body.lang;
  }
  const acceptLang = req.headers['accept-language'] || '';
  return acceptLang.toLowerCase().includes('km') ? 'km' : 'en';
}

// Basic Authentication for Admin Routes
const adminAuth = basicAuth({
  users: {
    [process.env.ADMIN_USERNAME || 'admin']: process.env.ADMIN_PASSWORD || 'admin123'
  },
  challenge: true,
  unauthorizedResponse: (req) => 'Access denied: Admin credentials required.'
});

// ==========================================
// TELEGRAM NOTIFICATIONS (Direct Telegram HTTP API)
// The Website sends notifications without running a long-polling bot listener.
// Interactive bot interactions are handled independently by Cloudflare Workers.
// ==========================================

async function sendTelegramMessage(chatId, text, options = {}) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token || !chatId) return null;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: options.parse_mode || 'Markdown'
  };
  if (options.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!result.ok) {
      if (result.parameters?.migrate_to_chat_id) {
        const migratedId = result.parameters.migrate_to_chat_id;
        payload.chat_id = migratedId;
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return await retryRes.json();
      }
      if (payload.parse_mode && (result.description || '').toLowerCase().includes('parse')) {
        console.warn(`[Telegram Fallback] Retrying sendTelegramMessage as plain text due to parse error: ${result.description}`);
        delete payload.parse_mode;
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return await retryRes.json();
      }
      console.warn('[Telegram Outgoing Notice]:', result.description);
    }
    return result;
  } catch (err) {
    console.error('[Telegram Outgoing Network Error]:', err.message);
    return null;
  }
}

async function notifyAdminTelegram(booking) {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID ? process.env.ADMIN_TELEGRAM_CHAT_ID.trim() : '';
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token || !adminChatId) {
    if (!adminChatId) {
      console.log(`[Telegram Notice] Booking #${booking.bookingReference} received, but ADMIN_TELEGRAM_CHAT_ID is not configured.`);
    }
    return;
  }

  const lang = booking.language === 'km' ? 'km' : 'en';
  const t = messages[lang];
  const msgText = t.adminNew(booking);
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '✅ Confirm / បញ្ជាក់', callback_data: `admin:confirm:${booking._id || booking.id}` },
        { text: '❌ Reject / បដិសេធ', callback_data: `admin:reject:${booking._id || booking.id}` }
      ]
    ]
  };

  try {
    await sendTelegramMessage(adminChatId, msgText, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
    Notification.log({
      bookingId: booking._id || booking.id,
      recipient: adminChatId,
      channel: 'telegram',
      message: msgText,
      status: 'sent'
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to send admin Telegram alert:', err.message);
  }
}

async function sendCustomerStatusTelegram(booking) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token || !booking.telegramId) return;

  const lang = booking.language === 'km' ? 'km' : 'en';
  const t = messages[lang];

  let messageText = '';
  if (booking.status === 'confirmed') messageText = t.statusConfirmed(booking);
  else if (booking.status === 'rejected') messageText = t.statusRejected(booking);
  else if (booking.status === 'cancelled') messageText = t.statusCancelled(booking);
  else if (booking.status === 'completed') messageText = t.statusCompleted(booking);
  else return;

  try {
    await sendTelegramMessage(booking.telegramId, messageText, { parse_mode: 'Markdown' });
    Notification.log({
      bookingId: booking._id || booking.id,
      recipient: booking.telegramId,
      channel: 'telegram',
      message: messageText,
      status: 'sent'
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to notify customer on Telegram:', err.message);
  }
}

// ==========================================
// PUBLIC WEBSITE ROUTES
// ==========================================

// Health Check Endpoint (Render.com Zero-Downtime Health Probes)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Home Page
app.get('/', async (req, res) => {
  try {
    const lang = getLang(req);
    const settings = await SalonSetting.getSettings();
    const services = await Service.find({ isActive: true, category: 'fingernail' }).sort({ price: 1 }).lean();
    res.render('home', {
      salonName: settings.salonName || SALON_NAME,
      settings,
      services,
      lang
    });
  } catch (err) {
    console.error('Home page error:', err);
    res.status(500).send('Error loading page');
  }
});

// Fingernail Services Catalog
app.get('/services', async (req, res) => {
  try {
    const lang = getLang(req);
    const settings = await SalonSetting.getSettings();
    const services = await Service.find({ isActive: true, category: 'fingernail' }).sort({ price: 1 }).lean();
    res.render('services', {
      salonName: settings.salonName || SALON_NAME,
      settings,
      services,
      lang
    });
  } catch (err) {
    console.error('Services page error:', err);
    res.status(500).send('Error loading services');
  }
});

// Book an Appointment Page
app.get('/book', async (req, res) => {
  try {
    const lang = getLang(req);
    const settings = await SalonSetting.getSettings();
    const services = await Service.find({ isActive: true, category: 'fingernail' }).sort({ price: 1 }).lean();
    const today = getLocalToday();

    res.render('book', {
      salonName: settings.salonName || SALON_NAME,
      settings,
      services,
      selectedServiceId: req.query.serviceId || '',
      today,
      lang
    });
  } catch (err) {
    console.error('Book page error:', err);
    res.status(500).send('Error loading booking page');
  }
});

// API: Available slots for date & fingernail service
app.get('/api/available-slots', async (req, res) => {
  try {
    const { serviceId, date } = req.query;
    if (!serviceId || !date) {
      return res.status(400).json({ success: false, message: 'serviceId and date are required.' });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.isActive || service.category !== 'fingernail') {
      return res.status(400).json({ success: false, message: 'Invalid or inactive fingernail service.' });
    }

    const settings = await SalonSetting.getSettings();
    const slots = await getAvailableSlots(date, service.durationMinutes, settings);

    res.json({
      success: true,
      date,
      service: {
        id: service._id,
        name: service.name,
        nameKm: service.nameKm,
        durationMinutes: service.durationMinutes,
        price: service.price
      },
      slots
    });
  } catch (err) {
    console.error('Slots API error:', err);
    res.status(500).json({ success: false, message: 'Error calculating available slots.' });
  }
});

// POST: Book an Appointment (Website)
app.post('/book', async (req, res) => {
  const lang = getLang(req);
  const settings = await SalonSetting.getSettings();

  try {
    const { serviceId, date, time, customerName, phone, notes } = req.body;

    // 1. Basic validation
    if (!customerName?.trim() || !phone?.trim() || !serviceId || !date || !time) {
      return res.status(400).render('result', {
        salonName: settings.salonName || SALON_NAME,
        success: false,
        booking: null,
        lang,
        message: lang === 'km'
          ? 'សូមបំពេញព័ត៌មានចាំបាច់ទាំងអស់ (ឈ្មោះ លេខទូរស័ព្ទ សេវាកម្ម ថ្ងៃ និងម៉ោង)។'
          : 'Please complete all required fields.'
      });
    }

    // 2. Service validation (Must be active fingernail service)
    const service = await Service.findById(serviceId);
    if (!service || !service.isActive || service.category !== 'fingernail') {
      return res.status(400).render('result', {
        salonName: settings.salonName || SALON_NAME,
        success: false,
        booking: null,
        lang,
        message: lang === 'km'
          ? 'សេវាកម្មដែលបានជ្រើសមិនត្រឹមត្រូវ ឬត្រូវបានបិទដំណើរការ។'
          : 'Selected service is invalid or currently inactive.'
      });
    }

    // 3. Strict scheduling and slot availability validation
    const availability = await checkSlotAvailability(date, time, service.durationMinutes, settings);
    if (!availability.available) {
      let errMsg = lang === 'km'
        ? 'ម៉ោងដែលបានជ្រើសត្រូវបានកក់ពេញ ឬហាងបិទសម្រាក។ សូមជ្រើសរើសម៉ោងផ្សេង។'
        : 'The selected time slot is no longer available. Please choose another time.';
      if (availability.reason === 'past_time') {
        errMsg = lang === 'km' ? 'មិនអាចកក់ម៉ោងកន្លងផុតហើយបានទេ។' : 'Cannot book an appointment in the past.';
      } else if (availability.reason === 'day_off' || availability.reason === 'closed_day') {
        errMsg = lang === 'km' ? 'ហាងបិទសម្រាកនៅថ្ងៃនេះ។' : 'The salon is closed on this date.';
      }

      return res.status(409).render('result', {
        salonName: settings.salonName || SALON_NAME,
        success: false,
        booking: null,
        lang,
        message: errMsg
      });
    }

    // 4. Create Booking
    const booking = await Booking.create({
      customerName: customerName.trim(),
      phone: phone.trim(),
      serviceId: service._id,
      service: service.name,
      serviceKm: service.nameKm,
      price: service.price,
      durationMinutes: service.durationMinutes,
      date,
      time,
      endTime: availability.endTime,
      notes: notes?.trim() || '',
      source: 'website',
      language: lang,
      status: 'pending'
    });

    // 5. Render Confirmation Result
    res.render('result', {
      salonName: settings.salonName || SALON_NAME,
      success: true,
      booking,
      lang,
      message: ''
    });

    // 6. Alert Admin on Telegram (non-blocking)
    notifyAdminTelegram(booking).catch(err => console.error('Admin alert error:', err.message));
  } catch (err) {
    console.error('Booking submission error:', err);
    res.status(500).render('result', {
      salonName: settings.salonName || SALON_NAME,
      success: false,
      booking: null,
      lang,
      message: lang === 'km'
        ? 'មានបញ្ហាបច្ចេកទេសក្នុងការរក្សាទុកការកក់។ សូមព្យាយាមម្ដងទៀត។'
        : 'An error occurred while saving your booking. Please try again.'
    });
  }
});

// Customer Booking Status Lookup Page
app.get('/status', async (req, res) => {
  try {
    const lang = getLang(req);
    const settings = await SalonSetting.getSettings();
    const query = req.query.query ? req.query.query.trim() : '';

    let bookings = [];
    let searched = false;

    if (query) {
      searched = true;
      bookings = await Booking.find({
        $or: [
          { bookingReference: { $regex: new RegExp(`^${query}$`, 'i') } },
          { phone: { $regex: new RegExp(query.replace(/[^\d+]/g, ''), 'i') } }
        ]
      })
        .sort({ date: -1, time: -1 })
        .limit(20)
        .lean();
    }

    res.render('status', {
      salonName: settings.salonName || SALON_NAME,
      query,
      searched,
      bookings,
      lang
    });
  } catch (err) {
    console.error('Status lookup error:', err);
    res.status(500).send('Error looking up booking status');
  }
});

// ==========================================
// ADMIN DASHBOARD ROUTES (Protected)
// ==========================================

app.get('/admin', adminAuth, async (req, res) => {
  try {
    const activeTab = req.query.tab || 'bookings';
    const alertMessage = req.query.msg || '';
    const alertType = req.query.type || 'info';

    const filterDate = req.query.filterDate || '';
    const filterStatus = req.query.filterStatus || '';
    const search = req.query.search ? req.query.search.trim() : '';
    const viewMode = req.query.view || (filterDate || search ? 'custom' : '7days');

    const today = getLocalToday(DEFAULT_TIMEZONE);
    // Calculate 7-day rolling window end boundary (today + 7 days) in Asia/Phnom_Penh
    const [y, m, d] = today.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    dateObj.setUTCDate(dateObj.getUTCDate() + 7);
    const end7Days = dateObj.toISOString().slice(0, 10);

    // Build filter query
    const filter = {};
    let dateRangeLabel = '';

    if (search) {
      filter.$or = [
        { bookingReference: { $regex: new RegExp(search, 'i') } },
        { customerName: { $regex: new RegExp(search, 'i') } },
        { phone: { $regex: new RegExp(search, 'i') } }
      ];
      dateRangeLabel = `Search: "${search}" (All dates)`;
    } else if (filterDate) {
      filter.date = filterDate;
      dateRangeLabel = `Specific Date: ${filterDate}`;
    } else if (viewMode === 'today') {
      filter.date = today;
      dateRangeLabel = `Today: ${today}`;
    } else if (viewMode === 'upcoming') {
      filter.date = { $gte: today };
      dateRangeLabel = `Upcoming Appointments (${today} onwards)`;
    } else if (viewMode === 'all') {
      dateRangeLabel = `All Booking History`;
    } else {
      // Default: Rolling 7-day window (today through today + 7 days)
      filter.date = { $gte: today, $lte: end7Days };
      dateRangeLabel = `Rolling 7-Day Window (${today} to ${end7Days})`;
    }

    if (filterStatus) {
      filter.status = filterStatus;
    }

    let bookings = await Booking.find(filter).sort({ date: 1, time: 1, createdAt: -1 }).lean();

    // In default 7-day view, also include pending bookings scheduled beyond 7 days so new reservations are not missed
    if (viewMode === '7days' && !search && !filterDate) {
      const pendingBeyond = await Booking.find({
        date: { $gt: end7Days },
        status: 'pending'
      }).sort({ date: 1, time: 1 }).lean();

      if (pendingBeyond.length > 0) {
        const existingIds = new Set(bookings.map(b => b.id));
        for (const pb of pendingBeyond) {
          if (!existingIds.has(pb.id)) {
            bookings.push(pb);
          }
        }
        bookings.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      }
    }

    const services = await Service.find({ category: 'fingernail' }).sort({ price: 1 }).lean();
    const settings = await SalonSetting.getSettings();

    // Statistics
    const todayCount = await Booking.countDocuments({ date: today });
    const pendingCount = await Booking.countDocuments({ status: 'pending' });
    const confirmedCount = await Booking.countDocuments({ status: 'confirmed' });
    const totalCount = await Booking.countDocuments();

    res.render('admin', {
      salonName: settings.salonName || SALON_NAME,
      bookings,
      services,
      settings,
      today,
      end7Days,
      activeTab,
      alertMessage,
      alertType,
      viewMode,
      dateRangeLabel,
      timeZone: DEFAULT_TIMEZONE,
      filters: { filterDate, filterStatus, search, view: viewMode },
      stats: { todayCount, pendingCount, confirmedCount, totalCount }
    });
  } catch (err) {
    console.error('Admin page load error:', err);
    res.status(500).send('Error loading admin dashboard');
  }
});

// Update Booking Status
app.post('/admin/bookings/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'];
    if (!allowed.includes(status)) {
      return res.redirect('/admin?tab=bookings&type=danger&msg=Invalid status selected.');
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.redirect('/admin?tab=bookings&type=danger&msg=Booking not found.');
    }

    // If confirming, check for slot conflicts
    if (status === 'confirmed') {
      const settings = await SalonSetting.getSettings();
      const availability = await checkSlotAvailability(
        booking.date,
        booking.time,
        booking.durationMinutes,
        settings,
        booking._id
      );

      if (!availability.available) {
        return res.redirect(
          '/admin?tab=bookings&type=danger&msg=' +
          encodeURIComponent(`Cannot confirm: Slot ${booking.date} ${booking.time} has reached maximum station capacity.`)
        );
      }
    }

    booking.status = status;
    await booking.save();

    // Notify Telegram customer if available
    sendCustomerStatusTelegram(booking).catch(err => console.error('Customer notification failed:', err.message));

    res.redirect('/admin?tab=bookings&type=success&msg=' + encodeURIComponent(`Booking #${booking.bookingReference} updated to ${status.toUpperCase()}.`));
  } catch (err) {
    console.error('Update status error:', err);
    res.redirect('/admin?tab=bookings&type=danger&msg=' + encodeURIComponent('Error updating booking status.'));
  }
});

// Reschedule Booking
app.post('/admin/bookings/:id/reschedule', adminAuth, async (req, res) => {
  try {
    const { date, time, adminNotes } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.redirect('/admin?tab=bookings&type=danger&msg=Booking not found.');
    }

    const settings = await SalonSetting.getSettings();
    const availability = await checkSlotAvailability(date, time, booking.durationMinutes, settings, booking._id);

    if (!availability.available) {
      return res.redirect(
        '/admin?tab=bookings&type=danger&msg=' +
        encodeURIComponent(`Reschedule failed: Time slot ${date} ${time} is unavailable (${availability.reason}).`)
      );
    }

    booking.date = date;
    booking.time = time;
    booking.endTime = availability.endTime;
    if (adminNotes) booking.adminNotes = adminNotes.trim();
    await booking.save();

    // Notify customer
    sendCustomerStatusTelegram(booking).catch(err => console.error('Customer notification failed:', err.message));

    res.redirect('/admin?tab=bookings&type=success&msg=' + encodeURIComponent(`Booking #${booking.bookingReference} rescheduled to ${date} at ${time}.`));
  } catch (err) {
    console.error('Reschedule error:', err);
    res.redirect('/admin?tab=bookings&type=danger&msg=' + encodeURIComponent('Error rescheduling booking.'));
  }
});

// Delete Booking (Admin Only, Protected by adminAuth)
app.post('/admin/bookings/:id/delete', adminAuth, async (req, res) => {
  try {
    const bookingId = req.params.id;
    if (!bookingId) {
      return res.redirect('/admin?tab=bookings&type=danger&msg=' + encodeURIComponent('Missing booking ID.'));
    }

    const cleanId = String(bookingId).trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanId)) {
      return res.redirect('/admin?tab=bookings&type=danger&msg=' + encodeURIComponent('Invalid booking ID format.'));
    }

    const deleted = await Booking.findByIdAndDelete(cleanId);
    if (!deleted) {
      return res.redirect('/admin?tab=bookings&type=warning&msg=' + encodeURIComponent('Booking record not found or already deleted.'));
    }

    console.log(`[Admin Audit] Booking #${deleted.bookingReference} (ID: ${deleted.id}) deleted by administrator.`);

    res.redirect(
      '/admin?tab=bookings&type=success&msg=' +
      encodeURIComponent(`Booking #${deleted.bookingReference} for ${deleted.customerName} has been deleted successfully.`)
    );
  } catch (err) {
    console.error('Delete booking error:', err);
    res.redirect('/admin?tab=bookings&type=danger&msg=' + encodeURIComponent('Failed to delete booking. Please try again.'));
  }
});

// Dry-run preview of 3-month retention cleanup (Admin Only)
app.get('/admin/retention/dry-run', adminAuth, async (req, res) => {
  try {
    const days = Number(req.query.days || 90);
    const preview = await previewExpiredBookings(supabase, { retentionDays: days, timeZone: DEFAULT_TIMEZONE });
    res.json(preview);
  } catch (err) {
    console.error('Retention dry-run preview error:', err);
    res.status(500).json({ error: 'Failed to run retention preview', message: err.message });
  }
});

// Add Fingernail Service
app.post('/admin/services', adminAuth, async (req, res) => {
  try {
    const { name, nameKm, price, durationMinutes, description, descriptionKm, imageUrl } = req.body;
    if (!name?.trim() || !nameKm?.trim() || isNaN(price) || isNaN(durationMinutes)) {
      return res.redirect('/admin?tab=services&type=danger&msg=Please fill in all service details.');
    }

    await Service.create({
      name: name.trim(),
      nameKm: nameKm.trim(),
      price: Number(price),
      durationMinutes: Number(durationMinutes),
      description: description?.trim() || '',
      descriptionKm: descriptionKm?.trim() || '',
      imageUrl: imageUrl?.trim() || '',
      category: 'fingernail',
      isActive: true
    });

    res.redirect('/admin?tab=services&type=success&msg=' + encodeURIComponent('New fingernail service added successfully.'));
  } catch (err) {
    console.error('Add service error:', err);
    res.redirect('/admin?tab=services&type=danger&msg=' + encodeURIComponent('Failed to add service.'));
  }
});

// Update Fingernail Service
app.post('/admin/services/:id/update', adminAuth, async (req, res) => {
  try {
    const { name, nameKm, price, durationMinutes, description, descriptionKm, imageUrl } = req.body;
    await Service.findByIdAndUpdate(req.params.id, {
      name: name.trim(),
      nameKm: nameKm.trim(),
      price: Number(price),
      durationMinutes: Number(durationMinutes),
      description: description?.trim() || '',
      descriptionKm: descriptionKm?.trim() || '',
      imageUrl: imageUrl?.trim() || ''
    });

    res.redirect('/admin?tab=services&type=success&msg=' + encodeURIComponent('Service updated successfully.'));
  } catch (err) {
    console.error('Update service error:', err);
    res.redirect('/admin?tab=services&type=danger&msg=' + encodeURIComponent('Failed to update service.'));
  }
});

// Toggle Fingernail Service Active Status
app.post('/admin/services/:id/toggle', adminAuth, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (service) {
      service.isActive = !service.isActive;
      await service.save();
    }
    res.redirect('/admin?tab=services&type=success&msg=' + encodeURIComponent(`Service ${service.name} status updated.`));
  } catch (err) {
    console.error('Toggle service error:', err);
    res.redirect('/admin?tab=services&type=danger&msg=' + encodeURIComponent('Failed to toggle service status.'));
  }
});

// Delete Fingernail Service
app.post('/admin/services/:id/delete', adminAuth, async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.redirect('/admin?tab=services&type=success&msg=' + encodeURIComponent('Fingernail service deleted.'));
  } catch (err) {
    console.error('Delete service error:', err);
    res.redirect('/admin?tab=services&type=danger&msg=' + encodeURIComponent('Failed to delete service.'));
  }
});

// Update Salon Settings & Hours
app.post('/admin/settings', adminAuth, async (req, res) => {
  try {
    const {
      salonName,
      salonPhone,
      openingTime,
      closingTime,
      slotIntervalMinutes,
      breakStart,
      breakEnd,
      maxConcurrentStaff,
      workingDays
    } = req.body;

    const parsedDays = Array.isArray(workingDays)
      ? workingDays.map(Number)
      : workingDays !== undefined
        ? [Number(workingDays)]
        : [0, 1, 2, 3, 4, 5, 6];

    const settings = await SalonSetting.getSettings();
    settings.salonName = salonName?.trim() || settings.salonName;
    settings.salonPhone = salonPhone?.trim() || settings.salonPhone;
    settings.openingTime = openingTime || '09:00';
    settings.closingTime = closingTime || '19:00';
    settings.slotIntervalMinutes = Number(slotIntervalMinutes) || 30;
    settings.breakStart = breakStart || '';
    settings.breakEnd = breakEnd || '';
    settings.maxConcurrentStaff = Number(maxConcurrentStaff) || 2;
    settings.workingDays = parsedDays;

    await settings.save();
    res.redirect('/admin?tab=schedule&type=success&msg=' + encodeURIComponent('Salon schedule and settings saved successfully.'));
  } catch (err) {
    console.error('Save settings error:', err);
    res.redirect('/admin?tab=schedule&type=danger&msg=' + encodeURIComponent('Failed to save settings.'));
  }
});

// Add Day Off / Holiday
app.post('/admin/daysoff/add', adminAuth, async (req, res) => {
  try {
    const { dayOffDate } = req.body;
    if (dayOffDate && /^\d{4}-\d{2}-\d{2}$/.test(dayOffDate)) {
      const settings = await SalonSetting.getSettings();
      if (!settings.daysOff.includes(dayOffDate)) {
        settings.daysOff.push(dayOffDate);
        await settings.save();
      }
    }
    res.redirect('/admin?tab=schedule&type=success&msg=' + encodeURIComponent(`Day off added for ${dayOffDate}.`));
  } catch (err) {
    console.error('Add day off error:', err);
    res.redirect('/admin?tab=schedule&type=danger&msg=' + encodeURIComponent('Failed to add day off.'));
  }
});

// Remove Day Off / Holiday
app.post('/admin/daysoff/remove', adminAuth, async (req, res) => {
  try {
    const { dayOffDate } = req.body;
    const settings = await SalonSetting.getSettings();
    settings.daysOff = settings.daysOff.filter(d => d !== dayOffDate);
    await settings.save();
    res.redirect('/admin?tab=schedule&type=success&msg=' + encodeURIComponent(`Removed day off for ${dayOffDate}.`));
  } catch (err) {
    console.error('Remove day off error:', err);
    res.redirect('/admin?tab=schedule&type=danger&msg=' + encodeURIComponent('Failed to remove day off.'));
  }
});

// ==========================================
// TELEGRAM BOT NOTICE
// ==========================================
// The interactive Telegram Bot is hosted separately via Cloudflare Workers Webhook.
// See telegram-worker/ directory for worker source and scripts/setup-webhook.js.

// ==========================================
// ENVIRONMENT CONFIGURATION VALIDATION
// ==========================================

function validateEnvironment() {
  const isProd = process.env.NODE_ENV === 'production';
  const missing = [];

  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project-ref') || process.env.SUPABASE_URL.includes('placeholder')) {
    missing.push('SUPABASE_URL');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY && !process.env.SUPABASE_SECRET_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  if (missing.length > 0) {
    console.warn(`[Configuration Warning] Missing or placeholder database environment variable(s): ${missing.join(', ')}`);
    console.warn('-> Please ensure your Supabase credentials are configured in your environment or Render Dashboard.');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || botToken.includes('your_') || botToken.includes('put_your_')) {
    console.log('[Configuration Notice] TELEGRAM_BOT_TOKEN is not configured. Telegram bot features will be disabled while the web application runs normally.');
  }

  if (isProd && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin123')) {
    console.warn('[Security Warning] ADMIN_PASSWORD is set to default in production! Please set a strong ADMIN_PASSWORD in your Render environment variables.');
  }
}

// ==========================================
// SUPABASE DATABASE CONNECTION & SERVER START
// ==========================================

async function startServer() {
  try {
    validateEnvironment();

    console.log('[Database] Connecting to Supabase PostgreSQL...');
    const conn = await testConnection();
    if (!conn.ok) {
      console.warn(`[Supabase Status] ${conn.message}`);
      if (conn.code === 'TABLES_NOT_FOUND') {
        console.warn('-> Please execute supabase/schema.sql in your Supabase SQL Editor to create the required tables.');
      }
    } else {
      console.log('[Database] Supabase PostgreSQL connected successfully.');
      // Ensure default fingernail services and salon settings exist in Supabase
      try {
        await Service.seedDefaults();
        await SalonSetting.getSettings();
      } catch (seedErr) {
        console.warn('[Supabase Warning] Could not check or seed defaults:', seedErr.message);
      }

      // Ensure admin user exists in Supabase users table
      try {
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminEmail = `${adminUsername}@miniroonail.local`;
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const existingAdmin = await User.findByEmail(adminEmail);
        if (!existingAdmin) {
          await User.createUser({
            email: adminEmail,
            password: adminPassword,
            role: 'admin'
          });
          console.log(`[Supabase] Seeded admin user (${adminEmail}) in users table.`);
        }
      } catch (userErr) {
        // Non-blocking if table is not yet created
      }
    }

    // Express Web Server
    console.log('[Telegram Integration] Outgoing notifications enabled via direct Telegram Bot API.');
    console.log('[Telegram Integration] Interactive customer bot hosted separately on Cloudflare Workers.');

    // Start Express Web Server
    // Bind to 0.0.0.0 so Render.com and cloud platforms can route external traffic
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Nail Salon Web Application running on port ${PORT}`);
      console.log(`Admin Dashboard: http://localhost:${PORT}/admin`);
      if (process.env.NODE_ENV === 'production') {
        console.log('Running in production mode (Render.com)');
      }
    });

    // Unified graceful shutdown
    const shutdown = (signal) => {
      console.log(`[Server] ${signal} signal received. Shutting down gracefully...`);
      server.close(() => {
        console.log('[Server] HTTP server closed. Process exiting.');
        process.exit(0);
      });

      // Force process exit after 10s timeout
      setTimeout(() => {
        console.warn('[Server] Forcing shutdown after timeout.');
        process.exit(0);
      }, 10000).unref();
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Server startup error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
