export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  date: number;
  text?: string;
  chat: {
    id: number;
    type: string;
  };
  from?: TelegramUser;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type TelegramWebhookMethod = {
  method: string;
  [key: string]: unknown;
};
