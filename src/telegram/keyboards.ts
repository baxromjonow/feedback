export const mainMenu = {
  inline_keyboard: [
    [{ text: '✍️ Murojaat yuborish', callback_data: 'ticket:new' }],
    [{ text: '📋 Mening murojaatlarim', callback_data: 'tickets:mine' }],
    [{ text: 'ℹ️ Bot haqida', callback_data: 'about' }],
  ],
};

export const ticketTypes = {
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

export const backHome = {
  inline_keyboard: [[{ text: '⬅️ Bosh menyu', callback_data: 'menu:home' }]],
};
