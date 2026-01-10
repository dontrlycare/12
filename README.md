# MediaSender App

Мобильное приложение для отправки фото/видео в Telegram бота с системой баллов.

## 📁 Структура проекта

```
MediaSenderApp/
├── server/          # Backend (Node.js + Telegram Bot)
├── app/             # Mobile App (Capacitor)
└── .github/         # CI/CD (GitHub Actions)
```

## 🚀 Быстрый старт

### 1. Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Выполните SQL запросы для создания таблиц (см. ниже)
3. Скопируйте URL и anon key проекта

**SQL для создания таблиц:**

```sql
-- Таблица пользователей
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_chat_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица кодов верификации
CREATE TABLE verification_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  telegram_username TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица ожидающих медиа
CREATE TABLE pending_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  media_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS политики
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_media ENABLE ROW LEVEL SECURITY;

-- Политики для сервера (используйте service_role key для полного доступа)
```

### 2. Настройка сервера

```bash
cd server
cp .env.example .env
# Заполните .env своими данными
npm install
npm start
```

### 3. Деплой на Render

1. Создайте Web Service на [render.com](https://render.com)
2. Подключите репозиторий
3. Root Directory: `server`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Добавьте Environment Variables:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `ADMIN_CHAT_ID`

### 4. Обновление API URL в приложении

Откройте `app/src/js/api.js` и замените:
```javascript
const API_BASE_URL = 'https://your-render-app.onrender.com';
```

### 5. Сборка приложения

Push в main branch запустит GitHub Actions:
- APK: Actions → Build Android & iOS → Artifacts → MediaSender-APK
- iOS: Требуется macOS с Xcode

## 📱 Функции

- ✅ Регистрация через Telegram
- ✅ Отправка фото и видео
- ✅ Модерация (принять/отклонить)
- ✅ Система баллов
- ✅ Минималистичный дизайн (черный/серый/белый)
- ✅ Плавные анимации

## 🔑 Получение Chat ID

Отправьте любое сообщение боту [@userinfobot](https://t.me/userinfobot) в Telegram чтобы узнать ваш Chat ID.
