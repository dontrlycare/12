/**
 * MediaSender App - Main Application Logic
 * Handles UI, authentication, and media sending
 */

// ==================== App State ====================
const AppState = {
    user: null,
    selectedFile: null,
    selectedMediaType: null,
    isLoading: false
};

// ==================== Storage Keys ====================
const STORAGE_KEYS = {
    USER: 'mediasender_user'
};

// ==================== DOM Elements ====================
const DOM = {
    // Screens
    loadingScreen: document.getElementById('loading-screen'),
    authScreen: document.getElementById('auth-screen'),
    mainScreen: document.getElementById('main-screen'),

    // Auth
    verificationCode: document.getElementById('verification-code'),
    verifyBtn: document.getElementById('verify-btn'),
    authError: document.getElementById('auth-error'),

    // Main
    username: document.getElementById('username'),
    pointsValue: document.getElementById('points-value'),

    // Media
    emptyState: document.getElementById('empty-state'),
    mediaPreviewContainer: document.getElementById('media-preview-container'),
    imagePreview: document.getElementById('image-preview'),
    videoPreview: document.getElementById('video-preview'),
    removeMediaBtn: document.getElementById('remove-media'),
    fileInput: document.getElementById('file-input'),

    // Buttons
    selectMediaBtn: document.getElementById('select-media-btn'),
    sendMediaBtn: document.getElementById('send-media-btn'),

    // Toast
    toast: document.getElementById('success-toast'),
    toastMessage: document.getElementById('toast-message')
};

// ==================== Screen Navigation ====================
function showScreen(screen) {
    // Hide all screens with fade out
    [DOM.loadingScreen, DOM.authScreen, DOM.mainScreen].forEach(s => {
        if (!s.classList.contains('hidden')) {
            s.classList.add('fade-out');
            setTimeout(() => {
                s.classList.add('hidden');
                s.classList.remove('fade-out');
            }, 300);
        }
    });

    // Show target screen with fade in
    setTimeout(() => {
        screen.classList.remove('hidden');
        screen.classList.add('fade-in');
        setTimeout(() => {
            screen.classList.remove('fade-in');
        }, 300);
    }, 300);
}

// ==================== Toast Notifications ====================
function showToast(message, duration = 3000) {
    DOM.toastMessage.textContent = message;
    DOM.toast.classList.remove('hidden');
    DOM.toast.classList.add('show');

    setTimeout(() => {
        DOM.toast.classList.remove('show');
        setTimeout(() => {
            DOM.toast.classList.add('hidden');
        }, 200);
    }, duration);
}

// ==================== Button Loading State ====================
function setButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoader = button.querySelector('.btn-loader');

    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        if (btnText) btnText.style.opacity = '0';
        if (btnLoader) btnLoader.classList.remove('hidden');
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        if (btnText) btnText.style.opacity = '1';
        if (btnLoader) btnLoader.classList.add('hidden');
    }
}

// ==================== Storage Helpers ====================
function saveUser(user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

function loadUser() {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
}

function clearUser() {
    localStorage.removeItem(STORAGE_KEYS.USER);
}

// ==================== Authentication ====================
async function handleVerifyCode() {
    const code = DOM.verificationCode.value.trim();

    if (code.length !== 6) {
        showError('Введите 6-значный код');
        return;
    }

    setButtonLoading(DOM.verifyBtn, true);
    DOM.authError.classList.add('hidden');

    const result = await API.verifyCode(code);

    setButtonLoading(DOM.verifyBtn, false);

    if (result.success) {
        AppState.user = result.user;
        saveUser(result.user);
        updateMainScreen();
        showScreen(DOM.mainScreen);
    } else {
        showError(result.message || 'Неверный код');
    }
}

function showError(message) {
    DOM.authError.textContent = message;
    DOM.authError.classList.remove('hidden');
}

// ==================== Main Screen Updates ====================
function updateMainScreen() {
    if (AppState.user) {
        DOM.username.textContent = `@${AppState.user.telegram_username}`;
        DOM.pointsValue.textContent = AppState.user.points;
    }
}

async function refreshUserData() {
    if (!AppState.user) return;

    const result = await API.getUser(AppState.user.telegram_chat_id);

    if (result.success) {
        AppState.user = result.user;
        saveUser(result.user);
        updateMainScreen();
    }
}

// ==================== Media Handling ====================
function handleSelectMedia() {
    DOM.fileInput.click();
}

function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Determine media type
    const isVideo = file.type.startsWith('video/');
    AppState.selectedFile = file;
    AppState.selectedMediaType = isVideo ? 'video' : 'photo';

    // Show preview
    const url = URL.createObjectURL(file);

    DOM.emptyState.classList.add('hidden');
    DOM.mediaPreviewContainer.classList.remove('hidden');

    if (isVideo) {
        DOM.imagePreview.classList.add('hidden');
        DOM.videoPreview.classList.remove('hidden');
        DOM.videoPreview.src = url;
    } else {
        DOM.videoPreview.classList.add('hidden');
        DOM.imagePreview.classList.remove('hidden');
        DOM.imagePreview.src = url;
    }

    // Enable send button
    DOM.sendMediaBtn.disabled = false;

    // Reset file input for selecting same file again
    event.target.value = '';
}

function handleRemoveMedia() {
    // Clear state
    AppState.selectedFile = null;
    AppState.selectedMediaType = null;

    // Reset preview
    DOM.imagePreview.src = '';
    DOM.imagePreview.classList.add('hidden');
    DOM.videoPreview.src = '';
    DOM.videoPreview.classList.add('hidden');
    DOM.mediaPreviewContainer.classList.add('hidden');

    // Show empty state
    DOM.emptyState.classList.remove('hidden');

    // Disable send button
    DOM.sendMediaBtn.disabled = true;
}

async function handleSendMedia() {
    if (!AppState.selectedFile || !AppState.user) return;

    setButtonLoading(DOM.sendMediaBtn, true);

    const result = await API.sendMedia(
        AppState.user.id,
        AppState.selectedFile,
        AppState.selectedMediaType
    );

    setButtonLoading(DOM.sendMediaBtn, false);

    if (result.success) {
        showToast('Отправлено! 🚀');
        handleRemoveMedia();

        // Refresh points after a short delay
        setTimeout(refreshUserData, 2000);
    } else {
        showToast(result.message || 'Ошибка отправки');
    }
}

// ==================== Event Listeners ====================
function setupEventListeners() {
    // Auth
    DOM.verificationCode.addEventListener('input', (e) => {
        // Only allow numbers
        e.target.value = e.target.value.replace(/\D/g, '');

        // Enable/disable button
        DOM.verifyBtn.disabled = e.target.value.length !== 6;
    });

    DOM.verifyBtn.addEventListener('click', handleVerifyCode);

    // Enter key to submit
    DOM.verificationCode.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && DOM.verificationCode.value.length === 6) {
            handleVerifyCode();
        }
    });

    // Media
    DOM.selectMediaBtn.addEventListener('click', handleSelectMedia);
    DOM.fileInput.addEventListener('change', handleFileSelected);
    DOM.removeMediaBtn.addEventListener('click', handleRemoveMedia);
    DOM.sendMediaBtn.addEventListener('click', handleSendMedia);

    // Refresh points when app becomes visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && AppState.user) {
            refreshUserData();
        }
    });
}

// ==================== App Initialization ====================
async function initApp() {
    // Check for saved user
    const savedUser = loadUser();

    if (savedUser) {
        AppState.user = savedUser;

        // Verify user still exists on server
        const result = await API.getUser(savedUser.telegram_chat_id);

        if (result.success) {
            AppState.user = result.user;
            saveUser(result.user);
            updateMainScreen();
            showScreen(DOM.mainScreen);
        } else {
            // User not found, clear and show auth
            clearUser();
            showScreen(DOM.authScreen);
        }
    } else {
        // No saved user, show auth
        setTimeout(() => {
            showScreen(DOM.authScreen);
        }, 1000);
    }

    setupEventListeners();
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
