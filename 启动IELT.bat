@echo off
setlocal
cd /d "%~dp0"
set PORT=8787

where py >nul 2>nul
if %errorlevel%==0 (
  start "IELT Memory Server" /min cmd /c "cd /d \"%~dp0\" && py -m http.server %PORT% --bind 127.0.0.1"
  timeout /t 1 /nobreak >nul
  start "" "http://127.0.0.1:%PORT%/"
  exit /b 0
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "IELT Memory Server" /min cmd /c "cd /d \"%~dp0\" && python -m http.server %PORT% --bind 127.0.0.1"
  timeout /t 1 /nobreak >nul
  start "" "http://127.0.0.1:%PORT%/"
  exit /b 0
)

echo.
echo [IELT Memory] 未找到 Python。
echo 请安装 Python 3，或使用 GitHub Pages 打开本项目。
echo 不建议直接双击 index.html 依赖 file:// 的 localStorage。
echo.
pause
