const messages = {
  km: {
    languagePrompt: 'សូមជ្រើសរើសភាសា / Please choose your language:',
    welcome: name => `💅 សូមស្វាគមន៍មកកាន់ ${name}!\n\nយើងខ្ញុំផ្ដល់ជូននូវសេវាកម្មថែរក្សា និងរចនាម៉ូដក្រចកដៃ (Fingernails) កម្រិតស្តង់ដារខ្ពស់។ សូមជ្រើសរើសមុខងារខាងក្រោម៖`,
    menu: 'តើបងចង់ធ្វើអ្វី?',
    book: '📅 កក់សេវាកម្មក្រចកដៃ',
    services: '💅 សេវាកម្មក្រចកដៃ និងតម្លៃ',
    myBookings: '🔍 ពិនិត្យស្ថានភាពការកក់',
    changeLang: '🌐 ភាសា / Language',
    helpBtn: 'ℹ️ ជំនួយ',
    chooseService: '💅 សូមជ្រើសរើសសេវាកម្មក្រចកដៃដែលបងពេញចិត្ត៖',
    selectedService: s => `✨ បងបានជ្រើសរើស៖\n💅 **${s.nameKm}**\n💵 តម្លៃ៖ $${s.price}\n⏱️ រយៈពេល៖ ${s.durationMinutes} នាទី\n📝 ${s.descriptionKm || ''}`,
    askDate: '📅 សូមជ្រើសរើសថ្ងៃណាត់ជួបខាងក្រោម ឬវាយបញ្ចូលតាមទម្រង់ YYYY-MM-DD (ឧទាហរណ៍៖ 2026-10-20)៖',
    badDate: '⚠️ ថ្ងៃដែលបានបញ្ចូលមិនត្រឹមត្រូវ ឬជាថ្ងៃកន្លងផុតហើយ។ សូមជ្រើសរើសថ្ងៃនេះ ឬថ្ងៃខាងមុខ។',
    dateClosed: '❌ សុំទោស ហាងបិទសម្រាកនៅថ្ងៃនេះ។ សូមជ្រើសរើសថ្ងៃផ្សេង។',
    askTime: '⏰ សូមជ្រើសរើសម៉ោងដែលទំនេរខាងក្រោម ឬវាយបញ្ចូលម៉ោង (ទម្រង់ HH:mm ឧទាហរណ៍ 14:00)៖',
    noSlotsOnDate: '❌ សុំទោស ថ្ងៃនេះពេញម៉ោងអស់ហើយ ឬជាម៉ោងសម្រាក។ សូមជ្រើសរើសថ្ងៃផ្សេងទៀត។',
    badTime: '⚠️ ម៉ោងមិនត្រឹមត្រូវទេ។ សូមប្រើទម្រង់ HH:mm ឧទាហរណ៍ 10:30 ឬ 14:00។',
    slotUnavailable: '❌ សុំទោស ម៉ោងនេះមានអ្នកកក់ពេញហើយ ឬត្រូវនឹងម៉ោងសម្រាករបស់ហាង។ សូមជ្រើសរើសម៉ោងផ្សេង។',
    askName: '👤 សូមបញ្ចូលឈ្មោះពេញរបស់បង៖',
    badName: '⚠️ សូមបញ្ចូលឈ្មោះចន្លោះពី 2 ដល់ 100 តួអក្សរ។',
    askPhone: '📞 សូមបញ្ចូលលេខទូរស័ព្ទសម្រាប់ទាក់ទង (ឬចុចប៊ូតុងចែករំលែកលេខទូរស័ព្ទ)៖',
    badPhone: '⚠️ សូមពិនិត្យលេខទូរស័ព្ទម្ដងទៀត (យ៉ាងតិច 8 ខ្ទង់)។',
    review: b => `📋 **សូមពិនិត្យព័ត៌មានការកក់ក្រចកដៃ**\n\n` +
      `💅 សេវាកម្ម៖ ${b.serviceKm || b.service}\n` +
      `💵 តម្លៃ៖ $${b.price}\n` +
      `⏱️ រយៈពេល៖ ${b.durationMinutes} នាទី\n` +
      `📅 ថ្ងៃណាត់៖ ${b.date}\n` +
      `⏰ ម៉ោង៖ ${b.time} ដល់ ${b.endTime}\n` +
      `👤 ឈ្មោះ៖ ${b.customerName}\n` +
      `📞 ទូរស័ព្ទ៖ ${b.phone}\n\n` +
      `តើបងចង់បញ្ជាក់សំណើកក់នេះទេ?`,
    confirmBtn: '✅ បញ្ជាក់ការកក់',
    cancelBtn: '❌ បោះបង់',
    saved: b => `🎉 **បានទទួលសំណើកក់ក្រចកដៃដោយជោគជ័យ!**\n\n` +
      `🔖 **លេខកូដសម្គាល់ (Reference):** \`${b.bookingReference}\`\n` +
      `💅 សេវាកម្ម៖ ${b.serviceKm || b.service}\n` +
      `📅 ថ្ងៃ៖ ${b.date}\n` +
      `⏰ ម៉ោង៖ ${b.time} - ${b.endTime}\n` +
      `⏳ ស្ថានភាព៖ កំពុងរង់ចាំការបញ្ជាក់ពីហាង (Pending)\n\n` +
      `ហាងនឹងពិនិត្យ និងជូនដំណឹងទៅបងតាម Telegram នេះភ្លាមៗនៅពេលបានបញ្ជាក់។ អរគុណច្រើន! ✨`,
    notSaved: '❌ សុំទោស មិនអាចរក្សាទុកការកក់បានទេ។ ម៉ោងដែលបានជ្រើសអាចមានអ្នកកក់មុនបន្តិច។ សូមព្យាយាមម្ដងទៀត។',
    cancelled: '↩️ បានបោះបង់ដំណើរការកក់ហើយ។ សូមវាយ /book ឬចុចម៉ឺនុយដើម្បីចាប់ផ្ដើមម្ដងទៀត។',
    noBookingInProgress: 'ℹ️ មិនមានការកក់កំពុងដំណើរការទេ។ សូមចុច /book ដើម្បីធ្វើការកក់ថ្មី។',
    adminNew: b => `🆕 **ការកក់ក្រចកដៃថ្មី!**\n\n` +
      `🔖 លេខកូដ៖ \`${b.bookingReference}\`\n` +
      `💅 សេវាកម្ម៖ ${b.serviceKm || b.service} ($${b.price})\n` +
      `⏱️ រយៈពេល៖ ${b.durationMinutes} នាទី\n` +
      `📅 ថ្ងៃ/ម៉ោង៖ ${b.date} (${b.time} - ${b.endTime})\n` +
      `👤 អតិថិជន៖ ${b.customerName}\n` +
      `📞 ទូរស័ព្ទ៖ ${b.phone}\n` +
      `🌐 ប្រភព៖ ${b.source.toUpperCase()}\n` +
      (b.telegramId ? `💬 Telegram ID: ${b.telegramId}\n` : ''),
    statusConfirmed: b => `✅ **ការកក់ក្រចកដៃរបស់បងត្រូវបានបញ្ជាក់ហើយ!**\n\n` +
      `🔖 លេខកូដ៖ \`${b.bookingReference}\`\n` +
      `💅 សេវាកម្ម៖ ${b.serviceKm || b.service}\n` +
      `📅 ថ្ងៃ៖ ${b.date}\n` +
      `⏰ ម៉ោង៖ ${b.time} ដល់ ${b.endTime}\n\n` +
      `សូមអញ្ជើញមកដល់មុនម៉ោង 5-10 នាទី។ ហាងយើងខ្ញុំរីករាយស្វាគមន៍បង! 💅✨`,
    statusRejected: b => `❌ **សុំទោស ការកក់ត្រូវបានបដិសេធ**\n\n` +
      `🔖 លេខកូដ៖ \`${b.bookingReference}\`\n` +
      `💅 សេវាកម្ម៖ ${b.serviceKm || b.service}\n` +
      `📅 ថ្ងៃ៖ ${b.date} (${b.time})\n\n` +
      `ហាងមិនអាចទទួលការណាត់នៅម៉ោងនេះបានទេ។ សូមអភ័យទោស និងសូមកក់ម៉ោងផ្សេង ឬទាក់ទងមកកាន់ហាងផ្ទាល់។`,
    statusCancelled: b => `ℹ️ ការកក់លេខកូដ \`${b.bookingReference}\` ត្រូវបានលុបចោល។`,
    statusCompleted: b => `🌸 **អរគុណច្រើនដែលបានប្រើប្រាស់សេវាកម្មក្រចកដៃរបស់យើងខ្ញុំ!**\nសង្ឃឹមថាបងពេញចិត្តនឹងម៉ូដក្រចកថ្មីនេះ។ ជួបគ្នានៅលើកក្រោយ! 💅💖`,
    servicesHeader: '💅 **តារាងសេវាកម្ម និងតម្លៃក្រចកដៃ (Fingernail Services)៖**\n\n',
    help: '💅 **ការណែនាំអំពី Telegram Bot ក្រចកដៃ៖**\n\n' +
      '• /start - បើកផ្ទាំងម៉ឺនុយមេ\n' +
      '• /book - ចាប់ផ្ដើមកក់សេវាកម្មក្រចកដៃ\n' +
      '• /services - មើលតារាងសេវាកម្ម និងតម្លៃ\n' +
      '• /status - ពិនិត្យស្ថានភាពការកក់តាមលេខកូដ\n' +
      '• /language - ផ្លាស់ប្ដូរភាសា (ខ្មែរ / English)\n' +
      '• /cancel - បោះបង់ការកក់កំពុងធ្វើ\n' +
      '• /myid - មើលលេខសម្គាល់ Telegram ID របស់អ្នក\n' +
      '• /help - មើលជំនួយនេះ'
  },
  en: {
    languagePrompt: 'Please choose your language / សូមជ្រើសរើសភាសា:',
    welcome: name => `💅 Welcome to ${name}!\n\nWe specialize exclusively in premium fingernail care, manicures, and artistic nail designs. Please choose an option below:`,
    menu: 'What would you like to do?',
    book: '📅 Book Nail Appointment',
    services: '💅 Nail Services & Prices',
    myBookings: '🔍 Check Booking Status',
    changeLang: '🌐 Language / ភាសា',
    helpBtn: 'ℹ️ Help',
    chooseService: '💅 Please choose your desired fingernail service:',
    selectedService: s => `✨ You selected:\n💅 **${s.name}**\n💵 Price: $${s.price}\n⏱️ Estimated Duration: ${s.durationMinutes} mins\n📝 ${s.description || ''}`,
    askDate: '📅 Please select your appointment date below or type YYYY-MM-DD (e.g., 2026-10-20):',
    badDate: '⚠️ Invalid date or date in the past. Please choose today or a future date.',
    dateClosed: '❌ Sorry, the salon is closed or having a day off on this date. Please choose another date.',
    askTime: '⏰ Please select an available time slot below or enter HH:mm (e.g., 14:00):',
    noSlotsOnDate: '❌ Sorry, all slots are fully booked or closed on this date. Please choose another date.',
    badTime: '⚠️ Invalid time. Please use 24-hour format HH:mm, for example 10:30 or 14:00.',
    slotUnavailable: '❌ Sorry, this time slot is fully booked or falls during salon break time. Please pick another slot.',
    askName: '👤 Please enter your full name:',
    badName: '⚠️ Please enter a name between 2 and 100 characters.',
    askPhone: '📞 Please enter your contact phone number (or tap Share Contact):',
    badPhone: '⚠️ Please check the phone number (at least 8 digits).',
    review: b => `📋 **Please review your fingernail booking request:**\n\n` +
      `💅 Service: ${b.service}\n` +
      `💵 Price: $${b.price}\n` +
      `⏱️ Duration: ${b.durationMinutes} mins\n` +
      `📅 Date: ${b.date}\n` +
      `⏰ Time: ${b.time} to ${b.endTime}\n` +
      `👤 Name: ${b.customerName}\n` +
      `📞 Phone: ${b.phone}\n\n` +
      `Would you like to confirm this appointment request?`,
    confirmBtn: '✅ Confirm Booking',
    cancelBtn: '❌ Cancel',
    saved: b => `🎉 **Your nail appointment request has been received!**\n\n` +
      `🔖 **Booking Reference:** \`${b.bookingReference}\`\n` +
      `💅 Service: ${b.service}\n` +
      `📅 Date: ${b.date}\n` +
      `⏰ Time: ${b.time} - ${b.endTime}\n` +
      `⏳ Status: Pending salon confirmation\n\n` +
      `The salon will review your request and send an instant Telegram notification once confirmed. Thank you! ✨`,
    notSaved: '❌ Sorry, your booking could not be saved. That slot may have just been taken. Please try again.',
    cancelled: '↩️ Booking process cancelled. Send /book or use the menu to start over.',
    noBookingInProgress: 'ℹ️ There is no active booking in progress. Send /book to schedule an appointment.',
    adminNew: b => `🆕 **New Nail Appointment Request!**\n\n` +
      `🔖 Reference: \`${b.bookingReference}\`\n` +
      `💅 Service: ${b.service} ($${b.price})\n` +
      `⏱️ Duration: ${b.durationMinutes} mins\n` +
      `📅 Date/Time: ${b.date} (${b.time} - ${b.endTime})\n` +
      `👤 Customer: ${b.customerName}\n` +
      `📞 Phone: ${b.phone}\n` +
      `🌐 Source: ${b.source.toUpperCase()}\n` +
      (b.telegramId ? `💬 Telegram ID: ${b.telegramId}\n` : ''),
    statusConfirmed: b => `✅ **Your nail appointment has been CONFIRMED!**\n\n` +
      `🔖 Reference: \`${b.bookingReference}\`\n` +
      `💅 Service: ${b.service}\n` +
      `📅 Date: ${b.date}\n` +
      `⏰ Time: ${b.time} to ${b.endTime}\n\n` +
      `Please arrive 5-10 minutes early. We look forward to pampering your nails! 💅✨`,
    statusRejected: b => `❌ **Appointment Request Declined**\n\n` +
      `🔖 Reference: \`${b.bookingReference}\`\n` +
      `💅 Service: ${b.service}\n` +
      `📅 Date: ${b.date} (${b.time})\n\n` +
      `We apologize that we cannot accommodate this specific time slot. Please feel free to book another time or contact the salon directly.`,
    statusCancelled: b => `ℹ️ Booking reference \`${b.bookingReference}\` has been cancelled.`,
    statusCompleted: b => `🌸 **Thank you for visiting our Nail Salon!**\nWe hope you love your new nails. See you next time! 💅💖`,
    servicesHeader: '💅 **Our Fingernail Services & Pricing:**\n\n',
    help: '💅 **Nail Salon Telegram Bot Commands:**\n\n' +
      '• /start - Main menu & language selection\n' +
      '• /book - Book a fingernail appointment\n' +
      '• /services - View nail services & price list\n' +
      '• /status - Check booking status by reference code\n' +
      '• /language - Change language (English / ខ្មែរ)\n' +
      '• /cancel - Cancel current booking flow\n' +
      '• /myid - Get your Telegram Chat ID\n' +
      '• /help - View this help guide'
  }
};

module.exports = { messages };
