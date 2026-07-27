import type {
  TelegramUpdate,
  TelegramWebhookMethod,
} from '../telegram/types.js';
import {
  mainMenu,
  ticketTypes,
  backHome,
  adminHome,
  backAdmin,
} from '../telegram/keyboards.js';
import { editMessageText, sendMessage } from '../telegram/api.js';
import { upsertTelegramUser, type UserType } from '../db/users.js';
import {
  consumeAdminReplyState,
  consumeUserReplyState,
  createTicketFromState,
  setAdminReplyState,
  setTicketState,
  setUserReplyState,
  type TicketType,
} from '../db/states.js';
import {
  addTicketMessage,
  getAdminTicket,
  getMyTicket,
  getTicketOwnerId,
  listAdminTickets,
  listIdentityAuditLogs,
  getIdentityAuditLog,
  listMyTickets,
  revealTicketIdentity,
  updateTicketStatus,
  type TicketStatus,
} from '../db/tickets.js';
import { env } from '../config.js';
import { isAdmin, isSuperadmin } from './auth.js';
import { esc } from '../utils/html.js';

type WaitUntil = (promise: Promise<unknown>) => void;
type Button = { text: string; callback_data: string };

const typeLabels: Record<TicketType, string> = {
  suggestion: '💡 Taklif',
  complaint: '📢 Shikoyat',
  request: '📝 Talab',
  other: '💬 Boshqa',
};

const statusLabels: Record<TicketStatus, string> = {
  new: '🆕 Yangi',
  reviewing: '👀 Ko‘rib chiqilmoqda',
  progress: '🛠 Jarayonda',
  resolved: '✅ Hal qilindi',
};

const sourceLabels: Record<string, string> = {
  student: '🎓 O‘quvchi',
  employee: '💼 Xodim',
  unknown: '👤 Foydalanuvchi',
};

function formatAuditDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('uz-UZ', {
      timeZone: 'Asia/Tashkent',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function directSendMessage(
  chatId: number,
  text: string,
  replyMarkup?: unknown,
): TelegramWebhookMethod {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };
}

function directAnswerCallback(callbackId: string): TelegramWebhookMethod {
  return {
    method: 'answerCallbackQuery',
    callback_query_id: callbackId,
  };
}

function parseStartSource(text?: string): UserType {
  if (!text) return 'unknown';
  const [, param = ''] = text.trim().split(/\s+/, 2);

  if (param === 'student') return 'student';
  if (param === 'employee') return 'employee';
  return 'unknown';
}

function welcomeText(source: UserType): string {
  const audience =
    source === 'student'
      ? '🎓 O‘quvchi'
      : source === 'employee'
        ? '💼 Xodim'
        : '👋 Xush kelibsiz';

  return [
    `<b>${audience}</b>`,
    '',
    'Assalomu alaykum!',
    'Fikringiz biz uchun muhim.',
    'Taklif, talab yoki shikoyatingizni erkin tarzda yuborishingiz mumkin.',
    '',
    '🔒 <b>Fikringiz erkin, murojaatingiz maxfiy.</b>',
    'Murojaatlar anonim tarzda ko‘rib chiqiladi.',
  ].join('\n');
}

function adminTicketButtons(ticketCode: string, superadmin: boolean) {
  const rows: Button[][] = [
    [{ text: '💬 Anonim javob', callback_data: `admin:reply:${ticketCode}` }],
    [
      {
        text: '👀 Ko‘rilmoqda',
        callback_data: `admin:set:${ticketCode}:reviewing`,
      },
      {
        text: '🛠 Jarayonda',
        callback_data: `admin:set:${ticketCode}:progress`,
      },
    ],
    [
      {
        text: '✅ Hal qilindi',
        callback_data: `admin:set:${ticketCode}:resolved`,
      },
    ],
  ];

  if (superadmin) {
    rows.push([
      {
        text: '👁 Muallifni ko‘rish',
        callback_data: `super:reveal:${ticketCode}`,
      },
    ]);
  }

  rows.push([{ text: '⬅️ Murojaatlar', callback_data: 'admin:list:all' }]);
  return { inline_keyboard: rows };
}

function revealReasonKeyboard(ticketCode: string) {
  return {
    inline_keyboard: [
      [
        {
          text: '🛡 Xavfsizlik',
          callback_data: `super:reason:${ticketCode}:security`,
        },
      ],
      [
        {
          text: '📞 Bog‘lanish zarur',
          callback_data: `super:reason:${ticketCode}:contact`,
        },
      ],
      [
        {
          text: '🔎 Tekshiruv',
          callback_data: `super:reason:${ticketCode}:review`,
        },
      ],
      [{ text: '⬅️ Orqaga', callback_data: `admin:view:${ticketCode}` }],
    ],
  };
}

function userTicketKeyboard(ticketCode: string) {
  return {
    inline_keyboard: [
      [{ text: '💬 Javob yozish', callback_data: `user:reply:${ticketCode}` }],
      [{ text: '⬅️ Murojaatlarim', callback_data: 'tickets:mine' }],
    ],
  };
}

function formatThread(
  messages: Array<{ sender_type: string; text: string | null }>,
  originalText?: string,
): string {
  if (!messages.length) return '';

  const cleaned = messages.filter((message, index) => {
    if (
      index === 0 &&
      message.sender_type === 'user' &&
      originalText &&
      (message.text ?? '').trim() === originalText.trim()
    ) {
      return false;
    }
    return true;
  });

  if (!cleaned.length) return '';

  const lines = cleaned.map((message) => {
    const who =
      message.sender_type === 'user'
        ? '👤 Murojaatchi'
        : message.sender_type === 'superadmin'
          ? '👑 Rahbariyat'
          : '💼 Admin';

    return `${who}: ${esc(message.text ?? '')}`;
  });

  return `\n\n<b>Yozishmalar:</b>\n${lines.join('\n\n')}`;
}

function adminReplySentKeyboard(ticketCode: string) {
  return {
    inline_keyboard: [
      [
        {
          text: '📂 Murojaatga qaytish',
          callback_data: `admin:view:${ticketCode}`,
        },
      ],
      [{ text: '🛠 Admin panel', callback_data: 'admin:home' }],
    ],
  };
}

function userReplySentKeyboard(ticketCode: string) {
  return {
    inline_keyboard: [
      [
        {
          text: '📂 Murojaatni ko‘rish',
          callback_data: `user:view:${ticketCode}`,
        },
      ],
      [{ text: '🏠 Bosh menyu', callback_data: 'menu:home' }],
    ],
  };
}

async function notifyAdmins(
  ticketCode: string,
  text: string,
  type: TicketType,
) {
  const ids = [...new Set([...env.ADMIN_IDS, ...env.SUPERADMIN_IDS])];
  if (!ids.length) return;

  await Promise.allSettled(
    ids.map((chatId) =>
      sendMessage(
        chatId,
        [
          '🆕 <b>YANGI MUROJAAT</b>',
          '',
          `<b>#${esc(ticketCode)}</b>`,
          typeLabels[type],
          '',
          '<b>Murojaat:</b>',
          esc(text.length > 700 ? `${text.slice(0, 700)}…` : text),
          '',
          '🔒 Muallif anonim ko‘rsatiladi.',
        ].join('\n'),
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📂 Ochish',
                  callback_data: `admin:view:${ticketCode}`,
                },
              ],
            ],
          },
        },
      ),
    ),
  );
}

async function renderAdminTicket(
  chatId: number,
  messageId: number,
  ticketCode: string,
  superadmin: boolean,
) {
  const ticket = await getAdminTicket(ticketCode);

  if (!ticket) {
    await editMessageText(chatId, messageId, '⚠️ Murojaat topilmadi.', {
      reply_markup: backAdmin,
    });
    return;
  }

  const type = typeLabels[ticket.type as TicketType] ?? esc(ticket.type);
  const status =
    statusLabels[ticket.status as TicketStatus] ?? esc(ticket.status);
  const source = sourceLabels[ticket.source] ?? '👤 Foydalanuvchi';

  const body = [
    `📨 <b>#${esc(ticket.ticket_code)}</b>`,
    '',
    type,
    source,
    status,
    '',
    '<b>Murojaat:</b>',
    esc(ticket.text),
    formatThread(ticket.messages, ticket.text),
  ].join('\n');

  await editMessageText(chatId, messageId, body, {
    reply_markup: adminTicketButtons(ticket.ticket_code, superadmin),
  });
}

export async function handleUpdate(
  update: TelegramUpdate,
  waitUntil: WaitUntil,
): Promise<TelegramWebhookMethod | null> {
  const message = update.message;

  if (message?.from && message.text?.startsWith('/start')) {
    const source = parseStartSource(message.text);
    const admin = isAdmin(message.from.id);

    waitUntil(
      upsertTelegramUser({
        telegramId: message.from.id,
        firstName: message.from.first_name,
        lastName: message.from.last_name,
        username: message.from.username,
        userType: source,
      }).catch((error) => console.error('User upsert failed:', error)),
    );

    return directSendMessage(message.chat.id, welcomeText(source), mainMenu(admin));
  }

  if (message?.from && message.text === '/admin') {
    if (!isAdmin(message.from.id)) {
      return directSendMessage(
        message.chat.id,
        '⛔ Bu bo‘lim faqat vakolatli adminlar uchun.',
        mainMenu(false),
      );
    }

    return directSendMessage(
      message.chat.id,
      '🛠 <b>ADMIN PANEL</b>\n\nMurojaatlarni holati bo‘yicha boshqaring:',
      adminHome(isSuperadmin(message.from.id)),
    );
  }

  const callback = update.callback_query;

  if (callback?.data && callback.message) {
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;
    const telegramId = callback.from.id;
    const data = callback.data;
    const admin = isAdmin(telegramId);
    const superadmin = isSuperadmin(telegramId);

    if (data === 'menu:home') {
      waitUntil(
        editMessageText(
          chatId,
          messageId,
          '🏠 <b>Bosh menyu</b>\n\nKerakli bo‘limni tanlang:',
          { reply_markup: mainMenu(admin) },
        ).catch((error) => console.error('Edit menu failed:', error)),
      );
      return directAnswerCallback(callback.id);
    }

    if (data === 'ticket:new') {
      waitUntil(
        editMessageText(
          chatId,
          messageId,
          '✍️ <b>Yangi murojaat</b>\n\nMurojaat turini tanlang:',
          { reply_markup: ticketTypes },
        ).catch((error) => console.error('Edit ticket menu failed:', error)),
      );
      return directAnswerCallback(callback.id);
    }

    if (data.startsWith('ticket:type:')) {
      const type = data.replace('ticket:type:', '') as TicketType;
      if (!(type in typeLabels)) return directAnswerCallback(callback.id);

      waitUntil(
        (async () => {
          try {
            await setTicketState(telegramId, type);
            await sendMessage(
              chatId,
              `${typeLabels[type]} tanlandi.\n\nMurojaatingizni bitta xabarda yozing ✍️`,
              {
                reply_markup: {
                  force_reply: true,
                  input_field_placeholder: 'Murojaatingizni yozing...',
                },
              },
            );
          } catch (error) {
            console.error('Set state failed:', error);
            await sendMessage(
              chatId,
              '⚠️ Texnik xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.',
            ).catch(() => undefined);
          }
        })(),
      );
      return directAnswerCallback(callback.id);
    }

    if (data === 'tickets:mine') {
      waitUntil(
        (async () => {
          try {
            const tickets = await listMyTickets(telegramId);

            if (!tickets.length) {
              await editMessageText(
                chatId,
                messageId,
                '📋 <b>Mening murojaatlarim</b>\n\nHozircha murojaatlaringiz yo‘q.',
                { reply_markup: backHome },
              );
              return;
            }

            const buttons: Button[][] = tickets.map((ticket) => [
              {
                text: `${ticket.ticket_code} • ${
                  statusLabels[ticket.status as TicketStatus] ?? ticket.status
                }`,
                callback_data: `user:view:${ticket.ticket_code}`,
              },
            ]);
            buttons.push([{ text: '⬅️ Bosh menyu', callback_data: 'menu:home' }]);

            await editMessageText(
              chatId,
              messageId,
              '📋 <b>Mening murojaatlarim</b>\n\nKo‘rish uchun murojaatni tanlang:',
              { reply_markup: { inline_keyboard: buttons } },
            );
          } catch (error) {
            console.error('List tickets failed:', error);
          }
        })(),
      );
      return directAnswerCallback(callback.id);
    }

    if (data.startsWith('user:view:')) {
      const ticketCode = data.replace('user:view:', '');

      waitUntil(
        (async () => {
          try {
            const ticket = await getMyTicket(telegramId, ticketCode);
            if (!ticket) {
              await editMessageText(chatId, messageId, '⚠️ Murojaat topilmadi.', {
                reply_markup: backHome,
              });
              return;
            }

            const type = typeLabels[ticket.type as TicketType] ?? esc(ticket.type);
            const status =
              statusLabels[ticket.status as TicketStatus] ?? esc(ticket.status);

            await editMessageText(
              chatId,
              messageId,
              [
                `📨 <b>#${esc(ticket.ticket_code)}</b>`,
                '',
                type,
                status,
                '',
                '<b>Murojaat:</b>',
                esc(ticket.text),
                formatThread(ticket.messages, ticket.text),
              ].join('\n'),
              { reply_markup: userTicketKeyboard(ticket.ticket_code) },
            );
          } catch (error) {
            console.error('Open user ticket failed:', error);
          }
        })(),
      );
      return directAnswerCallback(callback.id);
    }

    if (data.startsWith('user:reply:')) {
      const ticketCode = data.replace('user:reply:', '');

      waitUntil(
        (async () => {
          try {
            const ticket = await getMyTicket(telegramId, ticketCode);
            if (!ticket) return;

            await setUserReplyState(telegramId, ticketCode);
            await sendMessage(
              chatId,
              `💬 <b>#${esc(ticketCode)}</b> bo‘yicha javobingizni yozing:`,
              {
                reply_markup: {
                  force_reply: true,
                  input_field_placeholder: 'Javobingiz...',
                },
              },
            );
          } catch (error) {
            console.error('User reply state failed:', error);
          }
        })(),
      );
      return directAnswerCallback(callback.id);
    }

    if (data === 'about') {
      waitUntil(
        editMessageText(
          chatId,
          messageId,
          [
            'ℹ️ <b>Bot haqida</b>',
            '',
            'Bu bot o‘quv markaziga talab, taklif va shikoyatlarni yuborish uchun yaratilgan.',
            '',
            '🔒 <b>Fikringiz erkin, murojaatingiz maxfiy.</b>',
            'Murojaatlar anonim tarzda ko‘rib chiqiladi.',
          ].join('\n'),
          { reply_markup: backHome },
        ).catch((error) => console.error('About edit failed:', error)),
      );
      return directAnswerCallback(callback.id);
    }

    // ADMIN
    if (data === 'admin:home') {
      if (!admin) return directAnswerCallback(callback.id);

      waitUntil(
        editMessageText(
          chatId,
          messageId,
          '🛠 <b>ADMIN PANEL</b>\n\nMurojaatlarni holati bo‘yicha boshqaring:',
          { reply_markup: adminHome(superadmin) },
        ).catch((error) => console.error('Admin home failed:', error)),
      );
      return directAnswerCallback(callback.id);
    }

    if (data.startsWith('admin:list:')) {
      if (!admin) return directAnswerCallback(callback.id);

      const rawStatus = data.replace('admin:list:', '');
      const status = rawStatus === 'all' ? undefined : (rawStatus as TicketStatus);

      waitUntil(
        (async () => {
          try {
            const tickets = await listAdminTickets(status);

            if (!tickets.length) {
              await editMessageText(
                chatId,
                messageId,
                '📭 Bu bo‘limda hozircha murojaat yo‘q.',
                { reply_markup: backAdmin },
              );
              return;
            }

            const buttons: Button[][] = tickets.map((ticket) => [
              {
                text: `${ticket.ticket_code} • ${
                  typeLabels[ticket.type as TicketType] ?? ticket.type
                } • ${statusLabels[ticket.status as TicketStatus] ?? ticket.status}`,
                callback_data: `admin:view:${ticket.ticket_code}`,
              },
            ]);
            buttons.push([{ text: '⬅️ Admin panel', callback_data: 'admin:home' }]);

            await editMessageText(
              chatId,
              messageId,
              '📚 <b>Murojaatlar</b>\n\nOchish uchun tanlang:',
              { reply_markup: { inline_keyboard: buttons } },
            );
          } catch (error) {
            console.error('Admin list failed:', error);
          }
        })(),
      );
      return directAnswerCallback(callback.id);
    }

    if (data.startsWith('admin:view:')) {
      if (!admin) return directAnswerCallback(callback.id);
      const ticketCode = data.replace('admin:view:', '');

      waitUntil(
        renderAdminTicket(chatId, messageId, ticketCode, superadmin).catch(
          (error) => console.error('Admin ticket render failed:', error),
        ),
      );
      return directAnswerCallback(callback.id);
    }

    if (data.startsWith('admin:set:')) {
      if (!admin) return directAnswerCallback(callback.id);

      const [, , ticketCode, rawStatus] = data.split(':');
      const status = rawStatus as TicketStatus;
      if (!(status in statusLabels)) return directAnswerCallback(callback.id);

      waitUntil(
        (async () => {
          try {
            const ownerId = await updateTicketStatus(ticketCode, status);
            await Promise.allSettled([
              renderAdminTicket(chatId, messageId, ticketCode, superadmin),
              sendMessage(
                ownerId,
                `🔔 <b>#${esc(ticketCode)}</b> holati yangilandi:\n${statusLabels[status]}`,
              ),
            ]);
          } catch (error) {
            console.error('Update status failed:', error);
          }
        })(),
      );
      return directAnswerCallback(callback.id);
    }

    if (data.startsWith('admin:reply:')) {
      if (!admin) return directAnswerCallback(callback.id);
      const ticketCode = data.replace('admin:reply:', '');

      waitUntil(
        (async () => {
          try {
            await setAdminReplyState(telegramId, ticketCode);
            await sendMessage(
              chatId,
              `💬 <b>#${esc(ticketCode)}</b> uchun anonim javobingizni yozing:`,
              {
                reply_markup: {
                  force_reply: true,
                  input_field_placeholder: 'Javobingiz...',
                },
              },
            );
          } catch (error) {
            console.error('Admin reply state failed:', error);
          }
        })(),
      );
      return directAnswerCallback(callback.id);
    }

    // SUPERADMIN
    if (data === 'super:audit:list') {
      if (!superadmin) return directAnswerCallback(callback.id);

      waitUntil(
        (async () => {
          try {
            const logs = await listIdentityAuditLogs(15);

            if (!logs.length) {
              await editMessageText(
                chatId,
                messageId,
                [
                  '📜 <b>AUDIT TARIXI</b>',
                  '',
                  'Hozircha muallif ma’lumoti ochilgan holatlar yo‘q.',
                ].join('\n'),
                {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '⬅️ Admin panel', callback_data: 'admin:home' }],
                    ],
                  },
                },
              );
              return;
            }

            const buttons: Button[][] = logs.map((log) => [
              {
                text: `#${log.ticket_code} • ${log.reason} • ${formatAuditDate(log.created_at)}`,
                callback_data: `super:audit:view:${log.id}`,
              },
            ]);

            buttons.push([
              { text: '🔄 Yangilash', callback_data: 'super:audit:list' },
            ]);
            buttons.push([
              { text: '⬅️ Admin panel', callback_data: 'admin:home' },
            ]);

            await editMessageText(
              chatId,
              messageId,
              [
                '📜 <b>AUDIT TARIXI</b>',
                '',
                'Muallif ma’lumotini ochish bo‘yicha so‘nggi harakatlar:',
                '',
                `Jami ko‘rsatilmoqda: <b>${logs.length}</b> ta`,
              ].join('\n'),
              { reply_markup: { inline_keyboard: buttons } },
            );
          } catch (error) {
            console.error('Audit list failed:', error);
            await editMessageText(
              chatId,
              messageId,
              '⚠️ Audit tarixini yuklab bo‘lmadi.',
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '⬅️ Admin panel', callback_data: 'admin:home' }],
                  ],
                },
              },
            ).catch(() => undefined);
          }
        })(),
      );
      return directAnswerCallback(callback.id);
    }

    if (data.startsWith('super:audit:view:')) {
      if (!superadmin) return directAnswerCallback(callback.id);

      const auditId = Number(data.replace('super:audit:view:', ''));
      if (!Number.isSafeInteger(auditId) || auditId <= 0) {
        return directAnswerCallback(callback.id);
      }

      waitUntil(
        (async () => {
          try {
            const log = await getIdentityAuditLog(auditId);

            if (!log) {
              await editMessageText(chatId, messageId, '⚠️ Audit yozuvi topilmadi.', {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '⬅️ Audit tarixiga', callback_data: 'super:audit:list' }],
                  ],
                },
              });
              return;
            }

            const adminName = log.superadmin_name
              ? esc(log.superadmin_name)
              : 'Nomi bazada mavjud emas';
            const adminUsername = log.superadmin_username
              ? `@${esc(log.superadmin_username)}`
              : 'Username mavjud emas';

            await editMessageText(
              chatId,
              messageId,
              [
                '📜 <b>AUDIT YOZUVI</b>',
                '',
                `📨 Murojaat: <b>#${esc(log.ticket_code)}</b>`,
                `🔎 Sabab: <b>${esc(log.reason)}</b>`,
                `🕐 Vaqt: <b>${esc(formatAuditDate(log.created_at))}</b>`,
                '',
                '<b>Muallif ma’lumotini ochgan superadmin:</b>',
                `👤 ${adminName}`,
                `🔗 ${adminUsername}`,
                `🆔 <code>${esc(log.superadmin_telegram_id)}</code>`,
                '',
                '🔒 Audit yozuvi faqat superadminlar uchun ko‘rinadi.',
              ].join('\n'),
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: '📨 Murojaatni ochish',
                        callback_data: `admin:view:${log.ticket_code}`,
                      },
                    ],
                    [{ text: '⬅️ Audit tarixiga', callback_data: 'super:audit:list' }],
                  ],
                },
              },
            );
          } catch (error) {
            console.error('Audit detail failed:', error);
          }
        })(),
      );
      return directAnswerCallback(callback.id);
    }

    if (data.startsWith('super:reveal:')) {
      if (!superadmin) return directAnswerCallback(callback.id);
      const ticketCode = data.replace('super:reveal:', '');

      waitUntil(
        editMessageText(
          chatId,
          messageId,
          [
            '👁 <b>Muallif ma’lumotini ochish</b>',
            '',
            'Bu harakat audit tarixiga yoziladi.',
            'Sababni tanlang:',
          ].join('\n'),
          { reply_markup: revealReasonKeyboard(ticketCode) },
        ).catch((error) => console.error('Reveal menu failed:', error)),
      );
      return directAnswerCallback(callback.id);
    }

    if (data.startsWith('super:reason:')) {
      if (!superadmin) return directAnswerCallback(callback.id);

      const [, , ticketCode, reasonCode] = data.split(':');
      const reasons: Record<string, string> = {
        security: 'Xavfsizlik',
        contact: 'Bog‘lanish zarur',
        review: 'Tekshiruv',
      };
      const reason = reasons[reasonCode] ?? 'Boshqa';

      waitUntil(
        (async () => {
          try {
            const user = await revealTicketIdentity(ticketCode, telegramId, reason);

            await editMessageText(
              chatId,
              messageId,
              [
                '👁 <b>MUALLIF MA’LUMOTI</b>',
                '',
                `📨 <b>#${esc(ticketCode)}</b>`,
                `🔎 Ochish sababi: ${esc(reason)}`,
                '',
                `👤 ${esc(user.full_name || 'Ko‘rsatilmagan')}`,
                `🔗 ${user.username ? '@' + esc(user.username) : 'Username mavjud emas'}`,
                `🆔 <code>${esc(user.telegram_id)}</code>`,
                `${sourceLabels[user.user_type] ?? esc(user.user_type)}`,
                '',
                '🧾 Ushbu ko‘rish audit tarixiga saqlandi.',
              ].join('\n'),
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: '⬅️ Murojaatga qaytish',
                        callback_data: `admin:view:${ticketCode}`,
                      },
                    ],
                  ],
                },
              },
            );
          } catch (error) {
            console.error('Reveal identity failed:', error);
          }
        })(),
      );
      return directAnswerCallback(callback.id);
    }

    return directAnswerCallback(callback.id);
  }

  // TEXT INPUT
  if (message?.from && message.text && !message.text.startsWith('/')) {
    const telegramId = message.from.id;
    const chatId = message.chat.id;
    const text = message.text.trim();

    // Admin reply takes priority.
    if (isAdmin(telegramId)) {
      try {
        const adminReplyTicket = await consumeAdminReplyState(telegramId);

        if (adminReplyTicket) {
          const ownerId = await getTicketOwnerId(adminReplyTicket);
          if (!ownerId) throw new Error('Ticket owner not found');

          await addTicketMessage(
            adminReplyTicket,
            isSuperadmin(telegramId) ? 'superadmin' : 'admin',
            text,
          );

          waitUntil(
            sendMessage(
              ownerId,
              [
                `📩 <b>#${esc(adminReplyTicket)}</b> murojaatingizga javob:`,
                '',
                esc(text),
              ].join('\n'),
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: '💬 Javob berish',
                        callback_data: `user:reply:${adminReplyTicket}`,
                      },
                    ],
                  ],
                },
              },
            ).catch((error) => console.error('Owner notify failed:', error)),
          );

          return directSendMessage(
            chatId,
            [
              '✅ <b>Javob yuborildi!</b>',
              '',
              `<b>#${esc(adminReplyTicket)}</b> murojaat egasiga`,
              'anonim tarzda yetkazildi.',
            ].join('\n'),
            adminReplySentKeyboard(adminReplyTicket),
          );
        }
      } catch (error) {
        console.error('Admin text reply failed:', error);
      }
    }

    // User reply to existing ticket.
    try {
      const replyTicket = await consumeUserReplyState(telegramId);

      if (replyTicket) {
        await addTicketMessage(replyTicket, 'user', text);

        const adminIds = [...new Set([...env.ADMIN_IDS, ...env.SUPERADMIN_IDS])];
        waitUntil(
          Promise.allSettled(
            adminIds.map((id) =>
              sendMessage(
                id,
                [
                  `💬 <b>#${esc(replyTicket)}</b> bo‘yicha yangi javob`,
                  '',
                  esc(text),
                ].join('\n'),
                {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: '📂 Ochish',
                          callback_data: `admin:view:${replyTicket}`,
                        },
                      ],
                    ],
                  },
                },
              ),
            ),
          ),
        );

        return directSendMessage(
          chatId,
          [
            '✅ <b>Javobingiz yuborildi!</b>',
            '',
            `<b>#${esc(replyTicket)}</b> murojaati bo‘yicha javob`,
            'rahbariyatga yetkazildi.',
          ].join('\n'),
          userReplySentKeyboard(replyTicket),
        );
      }
    } catch (error) {
      console.error('User reply failed:', error);
    }

    // New ticket.
    try {
      const created = await createTicketFromState(telegramId, text);

      if (!created) {
        return directSendMessage(
          chatId,
          '🏠 Murojaat yuborish uchun bosh menyudan <b>“✍️ Murojaat yuborish”</b> tugmasini tanlang.',
          mainMenu(isAdmin(telegramId)),
        );
      }

      waitUntil(notifyAdmins(created.ticketCode, text, created.type));

      return directSendMessage(
        chatId,
        [
          '✅ <b>Murojaatingiz qabul qilindi!</b>',
          '',
          `Murojaat raqami: <b>#${esc(created.ticketCode)}</b>`,
          '',
          'Holatini “📋 Mening murojaatlarim” bo‘limidan kuzatishingiz mumkin.',
        ].join('\n'),
        mainMenu(isAdmin(telegramId)),
      );
    } catch (error) {
      console.error('Create ticket failed:', error);

      return directSendMessage(
        chatId,
        '⚠️ Hozir kichik texnik muammo yuz berdi. Iltimos, qayta urinib ko‘ring.',
        mainMenu(isAdmin(telegramId)),
      );
    }
  }

  return null;
}
