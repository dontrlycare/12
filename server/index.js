require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists (use /tmp on Render for ephemeral storage)
const uploadsDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadsDir}`);
}

// Multer for file uploads
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Generate random 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ==================== TELEGRAM BOT HANDLERS ====================

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || `user_${chatId}`;

  try {
    // Check if user already exists
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_chat_id', chatId.toString())
      .single();

    if (!user) {
      // Create new user if not exists
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          telegram_chat_id: chatId.toString(),
          telegram_username: username,
          points: 0
        })
        .select()
        .single();

      if (userError) {
        console.error('Error creating user:', userError);
        bot.sendMessage(chatId,
          `❌ Ошибка регистрации. Попробуйте позже.`
        );
        return;
      }
      user = newUser;

      // Welcome new user
      bot.sendMessage(chatId,
        `🎉 Добро пожаловать!\n\n` +
        `Вы успешно зарегистрированы в системе.\n` +
        `Теперь вы можете отправлять медиа через приложение и зарабатывать баллы!`
      );
    } else {
      // Generate verification code for existing user
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store verification code
      await supabase
        .from('verification_codes')
        .insert({
          code: code,
          telegram_chat_id: chatId.toString(),
          telegram_username: username,
          expires_at: expiresAt.toISOString(),
          used: false
        });

      bot.sendMessage(chatId,
        `👋 С возвращением, @${username}!\n\n` +
        `📱 Ваш код для входа:\n\n` +
        `\`${code}\`\n\n` +
        `⏰ Код действителен 10 минут.`,
        { parse_mode: 'Markdown' }
      );
    }

  } catch (error) {
    console.error('Error in /start handler:', error);
    bot.sendMessage(chatId,
      `❌ Произошла ошибка. Попробуйте позже.`
    );
  }
});

// Verify code from app
app.post('/api/verify-code', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Код не указан'
    });
  }

  try {
    // Find valid code
    const { data: codeData, error: codeError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (codeError || !codeData) {
      return res.status(400).json({
        success: false,
        message: 'Неверный или просроченный код'
      });
    }

    // Mark code as used
    await supabase
      .from('verification_codes')
      .update({ used: true })
      .eq('id', codeData.id);

    // Get or create user
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_chat_id', codeData.telegram_chat_id)
      .single();

    if (userError || !user) {
      // Create new user if not exists
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          telegram_chat_id: codeData.telegram_chat_id,
          telegram_username: codeData.telegram_username,
          points: 0
        })
        .select()
        .single();

      if (createError) {
        return res.status(500).json({
          success: false,
          message: 'Ошибка создания пользователя'
        });
      }
      user = newUser;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        telegram_chat_id: user.telegram_chat_id,
        telegram_username: user.telegram_username,
        points: user.points
      }
    });

  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Get user data
app.get('/api/user/:chatId', async (req, res) => {
  const { chatId } = req.params;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_chat_id', chatId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        telegram_chat_id: user.telegram_chat_id,
        telegram_username: user.telegram_username,
        points: user.points
      }
    });

  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Send media to admin
app.post('/api/send-media', upload.single('media'), async (req, res) => {
  const { userId, mediaType } = req.body;
  const file = req.file;

  if (!file || !userId) {
    return res.status(400).json({
      success: false,
      message: 'Файл или ID пользователя не указаны'
    });
  }

  try {
    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      fs.unlinkSync(file.path);
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Create pending media record
    const { data: mediaRecord, error: mediaError } = await supabase
      .from('pending_media')
      .insert({
        user_id: userId,
        media_type: mediaType || 'photo',
        status: 'pending'
      })
      .select()
      .single();

    if (mediaError) {
      fs.unlinkSync(file.path);
      return res.status(500).json({
        success: false,
        message: 'Ошибка сохранения'
      });
    }

    // Prepare inline keyboard
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Принять', callback_data: `accept_${mediaRecord.id}` },
        { text: '❌ Отклонить', callback_data: `reject_${mediaRecord.id}` }
      ]]
    };

    // Send to admin based on media type
    const caption = `📤 Новое медиа\n\n👤 @${user.telegram_username}\n💎 Баллы: ${user.points}`;

    // Read file as buffer for more reliable sending
    const fileBuffer = fs.readFileSync(file.path);
    const fileName = file.originalname || (mediaType === 'video' ? 'video.mp4' : 'photo.jpg');

    console.log(`📤 Sending ${mediaType} to admin: ${fileName} (${fileBuffer.length} bytes)`);

    if (mediaType === 'video') {
      await bot.sendVideo(ADMIN_CHAT_ID, fileBuffer, {
        caption: caption,
        reply_markup: keyboard
      }, {
        filename: fileName,
        contentType: file.mimetype || 'video/mp4'
      });
    } else {
      await bot.sendPhoto(ADMIN_CHAT_ID, fileBuffer, {
        caption: caption,
        reply_markup: keyboard
      }, {
        filename: fileName,
        contentType: file.mimetype || 'image/jpeg'
      });
    }

    // Clean up file
    fs.unlinkSync(file.path);
    console.log(`✅ Media sent successfully, file cleaned up`);

    res.json({ success: true, message: 'Медиа отправлено!' });

  } catch (error) {
    console.error('Error sending media:', error);
    console.error('Error details:', error.message);
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    res.status(500).json({ success: false, message: 'Ошибка отправки' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Telegram bot is active`);
});
