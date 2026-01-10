@echo off
chcp 65001 >nul
echo ==============================================
echo   ЗАГРУЗКА MEDIA SENDER НА GITHUB
echo ==============================================
echo.

set "repo_url=https://github.com/dontrlycare/12.git"

echo Репозиторий: %repo_url%
echo.

echo [1/6] Инициализация Git...
git init

echo.
echo [2/6] Добавление файлов...
git add .

echo.
echo [3/6] Создание коммита...
git commit -m "MediaSender App - Initial commit"

echo.
echo [4/6] Настройка ветки main...
git branch -M main

echo.
echo [5/6] Привязка репозитория...
git remote remove origin 2>nul
git remote add origin %repo_url%

echo.
echo [6/6] Отправка на GitHub...
echo (Может открыться окно авторизации GitHub)
git push -u origin main --force

echo.
echo ==============================================
if %errorlevel% neq 0 (
    echo ОШИБКА! Читайте текст выше.
) else (
    echo УСПЕШНО! Проект загружен на GitHub.
    echo.
    echo ============ СЛЕДУЮЩИЙ ШАГ: RENDER ============
    echo.
    echo 1. Откройте: https://dashboard.render.com
    echo 2. New ^> Web Service
    echo 3. Подключите GitHub и выберите репо "12"
    echo 4. Настройки:
    echo    - Name: media-sender
    echo    - Root Directory: server
    echo    - Build Command: npm install
    echo    - Start Command: npm start
    echo.
    echo 5. Environment Variables (добавьте все 4):
    echo    TELEGRAM_BOT_TOKEN = 8301735351:AAEewM4NIoIJ1cZn38-W1BQqVfOezCYQviI
    echo    SUPABASE_URL = https://xtdfbxouutpzqnpnnpxf.supabase.co
    echo    SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0ZGZieG91dXRwenFucG5ucHhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzc4OTEsImV4cCI6MjA4MzY1Mzg5MX0.cVeKDvPj-jyvTZURLzrr0JVNAikMiDEJHxFqLyJH1Bw
    echo    ADMIN_CHAT_ID = 1640761708
    echo.
    echo 6. Нажмите Create Web Service
    echo 7. Дождитесь деплоя (2-3 минуты)
    echo 8. Скопируйте URL сервиса (типа https://xxx.onrender.com)
    echo.
    echo ===============================================
)
echo.
pause
