const { supabase } = require('../config/supabase');

const Notification = {
  async log({ bookingId, recipient, channel = 'telegram', message, status = 'sent' }) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([
          {
            booking_id: bookingId ? String(bookingId) : null,
            recipient: String(recipient || 'admin'),
            channel,
            message,
            status,
            sent_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        console.warn('[Supabase Warning] Failed to log notification:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('[Notification] Error logging notification:', err.message);
      return null;
    }
  },

  async findByBookingId(bookingId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('booking_id', String(bookingId))
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  }
};

module.exports = Notification;
