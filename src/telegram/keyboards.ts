type Button = { text: string; callback_data: string };
type Keyboard = { inline_keyboard: Button[][] };

export function mainMenu(showAdmin = false): Keyboard {
  const rows: Button[][] = [
    [{ text: '✍️ Murojaat yuborish', callback_data: 'ticket:new' }],
    [{ text: '📋 Mening murojaatlarim', callback_data: 'tickets:mine' }],
    [{ text: 'ℹ️ Bot haqida', callback_data: 'about' }],
  ];

  if (showAdmin) {
    rows.push([{ text: '🛠 Admin panel', callback_data: 'admin:home' }]);
  }

  return { inline_keyboard: rows };
}

export const ticketTypes: Keyboard = {
  inline_keyboard: [
    [
      { text: '💡 Taklif', callback_data: 'ticket:type:suggestion' },
      { text: '📢 Shikoyat', callback_data: 'ticket:type:complaint' },
    ],
    [
      { text: '📝 Talab', callback_data: 'ticket:type:request' },
      { text: '💬 Boshqa', callback_data: 'ticket:type:other' },
    ],
    [{ text: '⬅️ Orqaga', callback_data: 'menu:home' }],
  ],
};

export const adminHome: Keyboard = {
  inline_keyboard: [
    [
      { text: '🆕 Yangi', callback_data: 'admin:list:new' },
      { text: '👀 Ko‘rilmoqda', callback_data: 'admin:list:reviewing' },
    ],
    [
      { text: '🛠 Jarayonda', callback_data: 'admin:list:progress' },
      { text: '✅ Hal qilindi', callback_data: 'admin:list:resolved' },
    ],
    [{ text: '📚 Barchasi', callback_data: 'admin:list:all' }],
    [{ text: '🏠 Oddiy menyu', callback_data: 'menu:home' }],
  ],
};

export const backHome: Keyboard = {
  inline_keyboard: [[{ text: '⬅️ Bosh menyu', callback_data: 'menu:home' }]],
};

export const backAdmin: Keyboard = {
  inline_keyboard: [[{ text: '⬅️ Admin panel', callback_data: 'admin:home' }]],
};
