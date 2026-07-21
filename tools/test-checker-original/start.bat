@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================================
echo   Test savollari bazasi ishga tushmoqda...
echo   (Bu oynani yopsangiz, dastur to'xtaydi)
echo ====================================================
py server.py
if errorlevel 1 (
  echo.
  echo Xatolik yuz berdi. Python o'rnatilganiga ishonch hosil qiling.
  pause
)
