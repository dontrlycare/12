/**
 * API Client for MediaSender App
 * Handles all communication with the backend server
 */

// ВАЖНО: Замените на URL вашего Render сервера после деплоя
const API_BASE_URL = 'https://your-render-app.onrender.com';

const API = {
    /**
     * Verify registration code
     * @param {string} code - 6-digit verification code
     * @returns {Promise<{success: boolean, user?: object, message?: string}>}
     */
    async verifyCode(code) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/verify-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code })
            });

            return await response.json();
        } catch (error) {
            console.error('API Error (verifyCode):', error);
            return { success: false, message: 'Ошибка соединения с сервером' };
        }
    },

    /**
     * Get user data by chat ID
     * @param {string} chatId - Telegram chat ID
     * @returns {Promise<{success: boolean, user?: object, message?: string}>}
     */
    async getUser(chatId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/${chatId}`);
            return await response.json();
        } catch (error) {
            console.error('API Error (getUser):', error);
            return { success: false, message: 'Ошибка соединения с сервером' };
        }
    },

    /**
     * Send media to admin
     * @param {string} userId - User ID
     * @param {File} file - Media file
     * @param {string} mediaType - 'photo' or 'video'
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async sendMedia(userId, file, mediaType) {
        try {
            const formData = new FormData();
            formData.append('userId', userId);
            formData.append('mediaType', mediaType);
            formData.append('media', file);

            const response = await fetch(`${API_BASE_URL}/api/send-media`, {
                method: 'POST',
                body: formData
            });

            return await response.json();
        } catch (error) {
            console.error('API Error (sendMedia):', error);
            return { success: false, message: 'Ошибка отправки медиа' };
        }
    }
};

// Export for use in app.js
window.API = API;
