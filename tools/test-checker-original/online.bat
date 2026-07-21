@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Test savollari - ONLAYN
echo ============================================================
echo   ONLAYN REJIM  (do'stlar bilan birga savol qo'shish)
echo ============================================================
echo.

rem cloudflared ni topamiz: avval shu papkada, keyin tizim PATH da
set "CFD="
if exist "%~dp0cloudflared.exe" set "CFD=%~dp0cloudflared.exe"
if not defined CFD (
  where cloudflared >nul 2>nul && set "CFD=cloudflared"
)
if not defined CFD (
  echo [!] cloudflared topilmadi. Avval uni o'rnating:
  echo.
  echo   1-yo'l ^(oson^):  winget install --id Cloudflare.cloudflared
  echo   2-yo'l:  https://github.com/cloudflare/cloudflared/releases/latest
  echo            dan "cloudflared-windows-amd64.exe" ni yuklab oling,
  echo            nomini "cloudflared.exe" ga o'zgartirib, shu papkaga qo'ying.
  echo.
  echo So'ng online.bat ni qaytadan ishga tushiring.
  echo.
  pause
  exit /b 1
)

echo Server ishga tushmoqda ^(port 8000^)... Server oynasini YOPMANG.
start "Test server (yopmang)" cmd /k py server.py 8000
timeout /t 3 >nul

echo.
echo ============================================================
echo   Pastda chiqadigan  https://....trycloudflare.com  havolasini
echo   do'stlaringizga yuboring. Ular o'sha havolani brauzerda ochib
echo   savol qo'sha oladi.
echo.
echo   ESLATMA: bu oyna VA server oynasi OCHIQ turishi kerak.
echo   Kompyuteringiz o'chsa yoki oynalar yopilsa - havola ishlamaydi.
echo   To'xtatish: shu oynada Ctrl+C bosing.
echo ============================================================
echo.
"%CFD%" tunnel --url http://127.0.0.1:8000
echo.
echo Tunnel to'xtadi. Server oynasini ham yopishingiz mumkin.
pause
