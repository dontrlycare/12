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

// Multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
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
  
  // Generate verification code
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_chat_id', chatId)
      .single();
    
    if (existingUser) {
      bot.sendMessage(chatId, 
        `✅ Вы уже зарегистрированы!\n\n` +
        `👤 Username: @${existingUser.telegram_username}\n` +
        `💎 Баллы: ${existingUser.points}\n\n` +
        `Используйте приложение для отправки медиа.`
      );
      return;
    }
    
    // Delete old codes for this user
    await supabase
      .from('verification_codes')
      .delete()
      .eq('telegram_chat_id', chatId);
    
    // Save new verification code
    await supabase
      .from('verification_codes')
      .insert({
        code: code,
        telegram_chat_id: chatId,
        telegram_username: username,
        used: false,
        expires_at: expiresAt.toISOString()
      });
    
    // Send code to user
    bot.sendMessage(chatId, 
      `🔐 Ваш код регистрации:\n\n` +
      `<code>${code}</code>\n\n` +
      `📱 Введите этот код в приложении для завершения регистрации.\n\n` +
      `⏱ Код действителен 10 минут.`,
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('Error in /start:', error);
    bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
});

// Handle callback queries (Accept/Reject buttons)
bot.on('callback_query', async (query) => {
  const data = query.data;
  const messageId = query.message.message_id;
  const chatId = query.message.chat.id;
  
  if (data.startsWith('accept_')) {
    const oderId = data.split('_')[1];
    
    try {
      // Get pending media info
      const { data: mediaData, error } = await supabase
        .from('pending_media')
        .select('*, users(*)')
        .eq('id', oderId)
        .single();
      
      if (error || !mediaData) {
        bot.answerCallbackQuery(query.id, { text: '❌ Медиа не найдено' });
        return;
      }
      
      // Add point to user
      await supabase
        .from('users')
        .update({ points: mediaData.users.points + 1 })
        .eq('id', mediaData.user_id);
      
      // Update media status
      await supabase
        .from('pending_media')
        .update({ status: 'accepted' })
        .eq('id', oderId);
      
      // Update message
      bot.editMessageCaption(
        `✅ ПРИНЯТО\n\n` +
        `👤 @${mediaData.users.telegram_username}\n` +
        `💎 Начислен 1 балл (всего: ${mediaData.users.points + 1})`,
        {
          chat_id: chatId,
          message_id: messageId
        }
      );
      
      bot.answerCallbackQuery(query.id, { text: '✅ Балл начислен!' });
      
    } catch (error) {
      console.error('Error accepting:', error);
      bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
    }
    
  } else if (data.startsWith('reject_')) {
    const oderId = data.split('_')[1];
    
    try {
      // Update media status
      await supabase
        .from('pending_media')
        .update({ status: 'rejected' })
        .eq('id', oderId);
      
      // Get media info for caption
      const { data: mediaData } = await supabase
        .from('pending_media')
        .select('*, users(*)')
        .eq('id', oderId)
        .single();
      
      // Update message
      if (mediaData) {
        bot.editMessageCaption(
          `❌ ОТКЛОНЕНО\n\n` +
          `👤 @${mediaData.users.telegram_username}`,
          {
            chat_id: chatId,
            message_id: messageId
          }
        );
      }
      
      bot.answerCallbackQuery(query.id, { text: '❌ Отклонено' });
      
    } catch (error) {
      console.error('Error rejecting:', error);
      bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
    }
  }
});

// ==================== API ENDPOINTS ====================

// Verify registration code
app.post('/api/verify-code', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ success: false, message: 'Код не указан' });
  }
  
  try {
    // Find valid code
    const { data: codeData, error } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !codeData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Неверный или истекший код' 
      });
    }
    
    // Create user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        telegram_chat_id: codeData.telegram_chat_id,
        telegram_username: codeData.telegram_username,
        points: 0
      })
      .select()
      .single();
    
    if (userError) {
      console.error('Error creating user:', userError);
      return res.status(500).json({ 
        success: false, 
        message: 'Ошибка создания пользователя' 
      });
    }
    
    // Mark code as used
    await supabase
      .from('verification_codes')
      .update({ used: true })
      .eq('id', codeData.id);
    
    // Notify user in Telegram
    bot.sendMessage(codeData.telegram_chat_id, 
      `🎉 Регистрация завершена!\n\n` +
      `Теперь вы можете отправлять медиа через приложение и зарабатывать баллы!`
    );
    
    res.json({ 
      success: true, 
      user: {
        id: newUser.id,
        telegram_chat_id: newUser.telegram_chat_id,
        telegram_username: newUser.telegram_username,
        points: newUser.points
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
    
    if (mediaType === 'video') {
      await bot.sendVideo(ADMIN_CHAT_ID, file.path, {
        caption: caption,
        reply_markup: keyboard
      });
    } else {
      await bot.sendPhoto(ADMIN_CHAT_ID, file.path, {
        caption: caption,
        reply_markup: keyboard
      });
    }
    
    // Clean up file
    fs.unlinkSync(file.path);
    
    res.json({ success: true, message: 'Медиа отправлено!' });
    
  } catch (error) {
    console.error('Error sending media:', error);
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
