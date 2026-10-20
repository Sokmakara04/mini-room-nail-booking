const Booking = require('../models/Booking');

const DEFAULT_TIMEZONE = process.env.SALON_TIMEZONE || 'Asia/Phnom_Penh';

function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calculateEndTime(startTimeStr, durationMinutes) {
  const startMins = timeToMinutes(startTimeStr);
  const endMins = startMins + Number(durationMinutes || 45);
  return minutesToTime(endMins);
}

function intervalsOverlap(startA, endA, startB, endB) {
  const a1 = timeToMinutes(startA);
  const a2 = timeToMinutes(endA);
  const b1 = timeToMinutes(startB);
  const b2 = timeToMinutes(endB);
  return a1 < b2 && b1 < a2;
}

function getLocalToday(timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function getLocalCurrentTime(timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('hour')}:${get('minute')}`;
}

function getPhnomPenhDateString(dateInput, timeZone = DEFAULT_TIMEZONE) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function getPhnomPenhDateRangeForUTC(startDateStr, endDateStr) {
  const startUtc = new Date(`${startDateStr}T00:00:00+07:00`).toISOString();
  const endUtc = new Date(`${endDateStr}T23:59:59.999+07:00`).toISOString();
  return { startUtc, endUtc };
}

function getDayOfWeek(dateStr) {
  // YYYY-MM-DD to day of week: 0 = Sun, 1 = Mon ... 6 = Sat
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.getUTCDay();
}

function isDateWorkingDay(dateStr, settings, timeZone = DEFAULT_TIMEZONE) {
  const today = getLocalToday(timeZone);
  if (dateStr < today) return { ok: false, reason: 'past_date' };

  if (Array.isArray(settings.daysOff) && settings.daysOff.includes(dateStr)) {
    return { ok: false, reason: 'day_off' };
  }

  const dow = getDayOfWeek(dateStr);
  if (Array.isArray(settings.workingDays) && !settings.workingDays.includes(dow)) {
    return { ok: false, reason: 'closed_day' };
  }

  return { ok: true };
}

async function getAvailableSlots(dateStr, durationMinutes, settings, timeZone = DEFAULT_TIMEZONE) {
  const check = isDateWorkingDay(dateStr, settings, timeZone);
  if (!check.ok) return [];

  const duration = Number(durationMinutes) || 45;
  const interval = Number(settings.slotIntervalMinutes) || 30;
  const openMins = timeToMinutes(settings.openingTime || '09:00');
  const closeMins = timeToMinutes(settings.closingTime || '19:00');
  const maxCapacity = Number(settings.maxConcurrentStaff) || 2;

  const today = getLocalToday(timeZone);
  const currentTime = getLocalCurrentTime(timeZone);
  const isToday = dateStr === today;

  // Retrieve existing pending & confirmed bookings for this date
  const activeBookings = await Booking.find({
    date: dateStr,
    status: { $in: ['pending', 'confirmed'] }
  }).lean();

  const slots = [];

  for (let m = openMins; m + duration <= closeMins; m += interval) {
    const slotStart = minutesToTime(m);
    const slotEnd = calculateEndTime(slotStart, duration);

    // If today, filter out times that have already passed
    if (isToday && slotStart <= currentTime) {
      continue;
    }

    // Filter out slots overlapping with lunch / salon break
    if (
      settings.breakStart &&
      settings.breakEnd &&
      intervalsOverlap(slotStart, slotEnd, settings.breakStart, settings.breakEnd)
    ) {
      continue;
    }

    // Count concurrent overlapping bookings
    let concurrent = 0;
    for (const b of activeBookings) {
      const bEnd = b.endTime || calculateEndTime(b.time, b.durationMinutes || 45);
      if (intervalsOverlap(slotStart, slotEnd, b.time, bEnd)) {
        concurrent++;
      }
    }

    if (concurrent < maxCapacity) {
      slots.push({
        time: slotStart,
        endTime: slotEnd,
        availableCapacity: maxCapacity - concurrent
      });
    }
  }

  return slots;
}

async function checkSlotAvailability(dateStr, startTimeStr, durationMinutes, settings, excludeBookingId = null, timeZone = DEFAULT_TIMEZONE) {
  const check = isDateWorkingDay(dateStr, settings, timeZone);
  if (!check.ok) {
    return { available: false, reason: check.reason };
  }

  const duration = Number(durationMinutes) || 45;
  const slotStart = startTimeStr;
  const slotEnd = calculateEndTime(slotStart, duration);
  const openMins = timeToMinutes(settings.openingTime || '09:00');
  const closeMins = timeToMinutes(settings.closingTime || '19:00');
  const startMins = timeToMinutes(slotStart);
  const endMins = timeToMinutes(slotEnd);

  if (startMins < openMins || endMins > closeMins) {
    return { available: false, reason: 'outside_hours' };
  }

  const today = getLocalToday(timeZone);
  const currentTime = getLocalCurrentTime(timeZone);
  if (dateStr === today && slotStart <= currentTime) {
    return { available: false, reason: 'past_time' };
  }

  if (
    settings.breakStart &&
    settings.breakEnd &&
    intervalsOverlap(slotStart, slotEnd, settings.breakStart, settings.breakEnd)
  ) {
    return { available: false, reason: 'break_time' };
  }

  const filter = {
    date: dateStr,
    status: { $in: ['pending', 'confirmed'] }
  };
  if (excludeBookingId) {
    filter._id = { $ne: excludeBookingId };
  }

  const activeBookings = await Booking.find(filter).lean();
  let concurrent = 0;
  for (const b of activeBookings) {
    const bEnd = b.endTime || calculateEndTime(b.time, b.durationMinutes || 45);
    if (intervalsOverlap(slotStart, slotEnd, b.time, bEnd)) {
      concurrent++;
    }
  }

  const maxCapacity = Number(settings.maxConcurrentStaff) || 2;
  if (concurrent >= maxCapacity) {
    return { available: false, reason: 'fully_booked', concurrent, maxCapacity };
  }

  return { available: true, endTime: slotEnd };
}

module.exports = {
  DEFAULT_TIMEZONE,
  timeToMinutes,
  minutesToTime,
  calculateEndTime,
  intervalsOverlap,
  getLocalToday,
  getLocalCurrentTime,
  isDateWorkingDay,
  getAvailableSlots,
  checkSlotAvailability,
  getPhnomPenhDateString,
  getPhnomPenhDateRangeForUTC
};
