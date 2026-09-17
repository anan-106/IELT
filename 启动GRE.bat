@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8788/
  python -m http.server 8788 --bind 127.0.0.1
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8788/
  py -m http.server 8788 --bind 127.0.0.1
  goto :eof
)
echo 未检测到 Python。请安装 Python 3，或直接用其他本地 HTTP server 打开本项目。
pause
