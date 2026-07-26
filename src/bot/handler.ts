import type {
  TelegramUpdate,
  TelegramWebhookMethod,
} from '../telegram/types.js';
import { mainMenu, ticketTypes, backHome } from '../telegram/keyboards.js';
import { editMessageText, sendMessage } from '../telegram/api.js';
import { upsertTelegramUser, type UserType } from '../db/users.js';
import {
  createTicketFromState,
  setTicketState,
  type TicketType,
} from '../db/states.js';
import { listMyTickets } from '../db/tickets.js';
import { env } from '../config.js';

type WaitUntil = (promise: Promise<unknown>) => void;

const typeLabels: Record<TicketType, string> = {
  suggestion: '💡 Taklif',
  complaint: '📢 Shikoyat',
  request: '📝 Talab',
  other: '💬 Boshqa',
};

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

function welcomeText(source: UserType) {
  const audience =
    source === 'student'
      ? '🎓 O‘quvchi'
      : source === 'employee'
        ? '💼 Xodim'
        : '👋 Foydalanuvchi';

  return [
    `<b>${audience}</b>`,
    '',
    'Assalomu alaykum! Fikringiz biz uchun muhim.',
    'Taklif, talab yoki shikoyatingizni maxfiy tarzda yuborishingiz mumkin.',
    '',
    '<i>Shaxsiy ma’lumotlar faqat maxsus vakolatli superadmin uchun ko‘rinadi.</i>',
  ].join('\n');
}

async function notifySuperadmins(ticketCode: string, text: string) {
  if (!env.SUPERADMIN_IDS.length) return;

  await Promise.allSettled(
    env.SUPERADMIN_IDS.map((chatId) =>
      sendMessage(
        chatId,
        [
          '🆕 <b>Yangi murojaat</b>',
          '',
          `<b>${ticketCode}</b>`,
          text.length > 500 ? `${text.slice(0, 500)}…` : text,
        ].join('\n'),
      ),
    ),
  );
}

export async function handleUpdate(
  update: TelegramUpdate,
  waitUntil: WaitUntil,
): Promise<TelegramWebhookMethod | null> {
  const message = update.message;

  if (message?.from && message.text?.startsWith('/start')) {
    const source = parseStartSource(message.text);

    // User sees the menu immediately; DB write does not block the response.
    waitUntil(
      upsertTelegramUser({
        telegramId: message.from.id,
        firstName: message.from.first_name,
        lastName: message.from.last_name,
        username: message.from.username,
        userType: source,
      }).catch((error) => console.error('User upsert failed:', error)),
    );

    return directSendMessage(message.chat.id, welcomeText(source), mainMenu);
  }

  const callback = update.callback_query;

  if (callback?.data && callback.message) {
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;
    const telegramId = callback.from.id;
    const data = callback.data;

    if (data === 'menu:home') {
      waitUntil(
        editMessageText(
          chatId,
          messageId,
          '🏠 <b>Bosh menyu</b>\n\nKerakli bo‘limni tanlang:',
          { reply_markup: mainMenu },
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

      if (!(type in typeLabels)) {
        return directAnswerCallback(callback.id);
      }

      // Spinner ends immediately. Critical state is stored first, then prompt is sent.
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

            const body = tickets.length
              ? tickets
                  .map((ticket) => {
                    const label =
                      typeLabels[ticket.type as TicketType] ?? ticket.type;
                    return `<b>${ticket.ticket_code}</b> — ${label}\n${ticket.status}`;
                  })
                  .join('\n\n')
              : 'Hozircha murojaatlaringiz yo‘q.';

            await editMessageText(
              chatId,
              messageId,
              `📋 <b>Mening murojaatlarim</b>\n\n${body}`,
              { reply_markup: backHome },
            );
          } catch (error) {
            console.error('List tickets failed:', error);
            await sendMessage(chatId, '⚠️ Ro‘yxatni yuklab bo‘lmadi.').catch(
              () => undefined,
            );
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
            '🔒 Murojaatlar maxfiy saqlanadi.',
            'Oddiy admin muallifning shaxsiy ma’lumotlarini ko‘rmaydi.',
          ].join('\n'),
          { reply_markup: backHome },
        ).catch((error) => console.error('About edit failed:', error)),
      );

      return directAnswerCallback(callback.id);
    }

    return directAnswerCallback(callback.id);
  }

  if (message?.from && message.text && !message.text.startsWith('/')) {
    try {
      const ticketCode = await createTicketFromState(
        message.from.id,
        message.text.trim(),
      );

      if (!ticketCode) {
        return directSendMessage(
          message.chat.id,
          '🏠 Murojaat yuborish uchun bosh menyudan <b>“✍️ Murojaat yuborish”</b> tugmasini tanlang.',
          mainMenu,
        );
      }

      waitUntil(notifySuperadmins(ticketCode, message.text));

      return directSendMessage(
        message.chat.id,
        [
          '✅ <b>Murojaatingiz qabul qilindi!</b>',
          '',
          `Murojaat raqami: <b>${ticketCode}</b>`,
          '',
          'Holatini “📋 Mening murojaatlarim” bo‘limidan kuzatishingiz mumkin.',
        ].join('\n'),
        mainMenu,
      );
    } catch (error) {
      console.error('Create ticket failed:', error);

      return directSendMessage(
        message.chat.id,
        '⚠️ Hozir kichik texnik muammo yuz berdi. Iltimos, qayta urinib ko‘ring.',
        mainMenu,
      );
    }
  }

  return null;
}
