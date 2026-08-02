@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo تشغيل موقع لوحة الشرف على هذا الجهاز فقط...
echo الرابط: http://127.0.0.1:8000/index.html
echo اترك هذه النافذة مفتوحة أثناء استخدام الموقع.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 1200; Start-Process 'http://127.0.0.1:8000/index.html'"
python -m http.server 8000 --bind 127.0.0.1
echo.
echo توقف الموقع المحلي. اضغط أي زر لإغلاق النافذة.
pause >nul
