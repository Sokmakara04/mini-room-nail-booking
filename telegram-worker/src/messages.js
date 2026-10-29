export const messages = {
  km: {
    languagePrompt: 'សូមជ្រើសរើសភាសា / Please choose your language:',
    welcome: name => `💅 សូមស្វាគមន៍មកកាន់ ${name}!\n\nយើងខ្ញុំផ្ដល់ជូននូវសេវាកម្មថែរក្សា និងរចនាម៉ូដក្រចកដៃ (Fingernails) កម្រិតស្តង់ដារខ្ពស់។ សូមជ្រើសរើសមុខងារខាងក្រោម៖`,
    menu: 'តើបងចង់ធ្វើអ្វី?',
    book: '📅 កក់សេវាកម្មក្រចកដៃ',
    services: '💅 សេវាកម្មក្រចកដៃ និងតម្លៃ',
    myBookings: '🔍 ពិនិត្យស្ថានភាពការកក់',
    locationBtn: '📍 ទីតាំងហាង',
    getDirectionsBtn: '🗺️ មើលផ្លូវទៅហាង (Google Maps)',
    locationInfo: name => `📍 **ទីតាំងហាង ${name}**\n\n` +
      `សូមស្វាគមន៍មកកាន់ហាងយើងខ្ញុំ! បងអាចចុចតំណភ្ជាប់ខាងក្រោមដើម្បីមើលទីតាំង ឬផ្លូវធ្វើដំណើរនៅលើ Google Maps:\n\n` +
      `🗺️ [មើលផ្លូវទៅហាងនៅលើ Google Maps](https://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it)\n\n` +
      `📍 \`https://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it\``,
    changeLang: '🌐 ភាសា / Language',
    helpBtn: 'ℹ️ ជំនួយ',
    chooseGroup: '💅 សូមជ្រើសរើសផ្នែកសេវាកម្មក្រចកដៃ (Service Group)៖',
    backToGroups: '◀️ ថយទៅផ្នែកសេវាកម្ម',
    allGroupsBtn: '📁 ផ្នែកសេវាកម្មទាំងអស់',
    mainMenuBtn: '↩️ ម៉ឺនុយមេ',
    servicesInGroup: groupName => `💅 **ផ្នែក៖ ${groupName}**\n\nសូមជ្រើសរើសសេវាកម្មដែលបងចង់កក់៖`,
    emptyGroup: 'ℹ️ មិនទាន់មានសេវាកម្មក្នុងផ្នែកនេះនៅឡើយទេ។ សូមជ្រើសរើសផ្នែកផ្សេងទៀត។',
    serviceUnavailable: '⚠️ សុំទោស សេវាកម្មនេះលែងមាន ឬត្រូវបានផ្អាកជាបណ្ដោះអាសន្ន។ សូមជ្រើសរើសសេវាកម្មផ្សេងទៀត។',
    groupUnavailable: '⚠️ សុំទោស ផ្នែកសេវាកម្មនេះត្រូវបានផ្អាកជាបណ្ដោះអាសន្ន។ សូមជ្រើសរើសផ្នែកផ្សេងទៀត។',
    chooseService: '💅 សូមជ្រើសរើសសេវាកម្មក្រចកដៃដែលបងពេញចិត្ត៖',
    selectedService: s => `✨ បងបានជ្រើសរើស៖\n💅 **${s.nameKm || s.name}**\n💵 តម្លៃ៖ $${s.price}\n⏱️ រយៈពេល៖ ${s.durationMinutes} នាទី\n📝 ${s.descriptionKm || s.description || ''}`,
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
      `🌐 ប្រភព៖ ${(b.source || 'telegram').toUpperCase()}\n` +
      (b.telegramId ? `💬 Telegram ID: ${b.telegramId}\n` : ''),
    statusConfirmed: b => `✅ **ការកក់ក្រចកដៃរបស់បងត្រូវបានបញ្ជាក់ហើយ!**\n\n` +
      `🔖 លេខកូដ៖ \`${b.bookingReference}\`\n` +
      `💅 សេវាកម្ម៖ ${b.serviceKm || b.service}\n` +
      `📅 ថ្ងៃ៖ ${b.date}\n` +
      `⏰ ម៉ោង៖ ${b.time} ដល់ ${b.endTime}\n\n` +
      `សូមអញ្ជើញមកដល់មុនម៉ោង 5-10 នាទី។ ហាងយើងខ្ញុំរីករាយស្វាគមន៍បង! 💅✨\n\n` +
      `📍 **ទីតាំងហាង (Google Maps)៖**\nhttps://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it`,
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
      '• /services - មើលសេវាកម្ម និងតម្លៃក្រចកដៃទាំងអស់\n' +
      '• /location - មើលទីតាំងហាងនៅលើ Google Maps\n' +
      '• /status - ពិនិត្យស្ថានភាពការកក់របស់អ្នក (វាយ /status NL-XXXXXX)\n' +
      '• /cancel - បោះបង់សំណើកក់ដែលកំពុងធ្វើ\n' +
      '• /language - ជ្រើសរើសភាសា (ខ្មែរ / English)\n' +
      '• /myid - មើលលេខសម្គាល់ Telegram ID របស់អ្នក\n' +
      '• /help - ការណែនាំបន្ថែម'
  },
  en: {
    languagePrompt: 'Please choose your language / សូមជ្រើសរើសភាសា៖',
    welcome: name => `💅 Welcome to ${name}!\n\nWe provide professional, high-standard fingernail care and luxury nail art. Please choose an option below:`,
    menu: 'What would you like to do?',
    book: '📅 Book Fingernail Appointment',
    services: '💅 Nail Services & Pricing',
    myBookings: '🔍 Check Booking Status',
    locationBtn: '📍 Our Location / ទីតាំងហាង',
    getDirectionsBtn: '🗺️ Get Directions (Google Maps)',
    locationInfo: name => `📍 **${name} Location**\n\n` +
      `Welcome to our salon! Tap the link below to get directions or view our location on Google Maps:\n\n` +
      `🗺️ [Get Directions on Google Maps](https://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it)\n\n` +
      `📍 \`https://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it\``,
    changeLang: '🌐 Language / ភាសា',
    helpBtn: 'ℹ️ Help',
    chooseGroup: '💅 Please choose a service group:',
    backToGroups: '◀️ Back to Service Groups',
    allGroupsBtn: '📁 All Service Groups',
    mainMenuBtn: '↩️ Main Menu',
    servicesInGroup: groupName => `💅 **Group: ${groupName}**\n\nSelect a treatment to book:`,
    emptyGroup: 'ℹ️ No active treatments found in this group yet. Please choose another group.',
    serviceUnavailable: '⚠️ Sorry, this treatment is no longer available or currently inactive. Please choose another service.',
    groupUnavailable: '⚠️ Sorry, this service group is currently inactive. Please choose another group.',
    chooseService: '💅 Please select your preferred fingernail treatment:',
    selectedService: s => `✨ Selected Service:\n💅 **${s.name}**\n💵 Price: $${s.price}\n⏱️ Duration: ${s.durationMinutes} mins\n📝 ${s.description || ''}`,
    askDate: '📅 Please choose an appointment date below or type in YYYY-MM-DD (e.g. 2026-10-20):',
    badDate: '⚠️ Invalid date or date in the past. Please choose today or an upcoming date.',
    dateClosed: '❌ Sorry, the salon is closed on this day. Please select another date.',
    askTime: '⏰ Please select an available time slot below or enter time (HH:mm format, e.g. 14:00):',
    noSlotsOnDate: '❌ Sorry, no appointment slots are available on this date. Please choose another date.',
    badTime: '⚠️ Invalid time format. Please use HH:mm (e.g. 10:30 or 14:00).',
    slotUnavailable: '❌ Sorry, that time slot is fully booked or falls during salon break hours. Please choose another time.',
    askName: '👤 Please enter your full name:',
    badName: '⚠️ Name must be between 2 and 100 characters.',
    askPhone: '📞 Please enter your contact phone number (or click the Share Contact button):',
    badPhone: '⚠️ Please provide a valid phone number (at least 8 digits).',
    review: b => `📋 **Please review your fingernail booking:**\n\n` +
      `💅 Service: ${b.service}\n` +
      `💵 Price: $${b.price}\n` +
      `⏱️ Duration: ${b.durationMinutes} mins\n` +
      `📅 Date: ${b.date}\n` +
      `⏰ Time: ${b.time} to ${b.endTime}\n` +
      `👤 Name: ${b.customerName}\n` +
      `📞 Phone: ${b.phone}\n\n` +
      `Would you like to confirm this appointment request?`,
    confirmBtn: '✅ Confirm Appointment',
    cancelBtn: '❌ Cancel',
    saved: b => `🎉 **Your appointment request has been submitted!**\n\n` +
      `🔖 **Booking Reference:** \`${b.bookingReference}\`\n` +
      `💅 Service: ${b.service}\n` +
      `📅 Date: ${b.date}\n` +
      `⏰ Time: ${b.time} - ${b.endTime}\n` +
      `⏳ Status: Pending salon confirmation\n\n` +
      `We will review your request and send a confirmation message here on Telegram shortly. Thank you! ✨`,
    notSaved: '❌ Sorry, we could not save your booking. The slot may have just been reserved. Please try again.',
    cancelled: '↩️ Booking process cancelled. Send /book or use the menu to start over.',
    noBookingInProgress: 'ℹ️ No booking in progress. Send /book to schedule an appointment.',
    adminNew: b => `🆕 **New Fingernail Booking Received!**\n\n` +
      `🔖 Ref: \`${b.bookingReference}\`\n` +
      `💅 Service: ${b.service} ($${b.price})\n` +
      `⏱️ Duration: ${b.durationMinutes} mins\n` +
      `📅 Date/Time: ${b.date} (${b.time} - ${b.endTime})\n` +
      `👤 Customer: ${b.customerName}\n` +
      `📞 Phone: ${b.phone}\n` +
      `🌐 Source: ${(b.source || 'telegram').toUpperCase()}\n` +
      (b.telegramId ? `💬 Telegram ID: ${b.telegramId}\n` : ''),
    statusConfirmed: b => `✅ **Your fingernail booking is CONFIRMED!**\n\n` +
      `🔖 Reference: \`${b.bookingReference}\`\n` +
      `💅 Service: ${b.service}\n` +
      `📅 Date: ${b.date}\n` +
      `⏰ Time: ${b.time} - ${b.endTime}\n\n` +
      `Please arrive 5-10 minutes before your scheduled appointment. We look forward to pampering you! 💅✨\n\n` +
      `📍 **Location & Directions (Google Maps):**\nhttps://maps.app.goo.gl/4qxBK6hFcZJoorRK7?g_st=it`,
    statusRejected: b => `❌ **Booking Request Declined**\n\n` +
      `🔖 Reference: \`${b.bookingReference}\`\n` +
      `💅 Service: ${b.service}\n` +
      `📅 Date: ${b.date} (${b.time})\n\n` +
      `We apologize that we are unable to accommodate your appointment at this specific time. Please choose another slot or contact the salon directly.`,
    statusCancelled: b => `ℹ️ Booking \`${b.bookingReference}\` has been cancelled.`,
    statusCompleted: b => `🌸 **Thank you for visiting us!**\nWe hope you love your beautiful nails. See you next time! 💅💖`,
    servicesHeader: '💅 **Fingernail Services & Price List:**\n\n',
    help: '💅 **Telegram Bot Instructions:**\n\n' +
      '• /start - Open the main menu\n' +
      '• /book - Book a fingernail appointment\n' +
      '• /services - View all fingernail treatments & prices\n' +
      '• /location - View salon location & directions on Google Maps\n' +
      '• /status - Check booking status (e.g. /status NL-XXXXXX)\n' +
      '• /cancel - Cancel current booking draft\n' +
      '• /language - Switch language (English / ខ្មែរ)\n' +
      '• /myid - Get your Telegram Chat ID\n' +
      '• /help - Show this guide'
  }
};
