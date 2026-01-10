@echo off
chcp 65001 >nul
echo ==============================================
echo   ЗАГРУЗКА MEDIA SENDER НА GITHUB
echo ==============================================
echo.

echo [1/3] Инициализация Git (если нужно)...
if not exist .git (
    git init
    git branch -M main
    set /p repo_url="Введите ссылку на репозиторий: "
    git remote add origin %repo_url%
)

echo.
echo [2/3] Добавление новых файлов...
git add .

echo.
echo [3/3] Отправка на GitHub...
set /p msg="Введите описание изменений (Enter для 'Update'): "
if "%msg%"=="" set msg=Update

git commit -m "%msg%"
git push origin main

echo.
echo ==============================================
if %errorlevel% neq 0 (
    echo ОШИБКА! Попробуйте с force push?
    choice /C YN /M "Использовать --force?"
    if errorlevel 1 git push origin main --force
) else (
    echo УСПЕШНО! Изменения отправлены.
    echo Теперь проверьте Actions на GitHub.
)
echo.
pause
