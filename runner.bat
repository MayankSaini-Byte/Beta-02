@echo off
setlocal

if /i "%~1"=="model" goto model_service
if /i "%~1"=="api" goto api_server

set "ROOT=%~dp0"
if not exist "%ROOT%model-service\.venv\Scripts\python.exe" (
  echo PaddleOCR Python environment not found.
  echo Expected: %ROOT%model-service\.venv\Scripts\python.exe
  echo Reinstall it with: python -m pip install -r model-service\requirements.txt
  pause
  exit /b 1
)
if not exist "%ROOT%frontend\dist\index.html" (
  echo Built frontend not found.
  echo Run this once: npm --prefix frontend run build
  pause
  exit /b 1
)
if not exist "%ROOT%backend\node_modules\express" (
  echo Backend packages not found.
  echo Run this once: npm --prefix backend ci --omit=dev --ignore-scripts
  pause
  exit /b 1
)

start "KitchenSync OCR" "%ComSpec%" /k call "%~f0" model
start "KitchenSync API" "%ComSpec%" /k call "%~f0" api
echo Starting KitchenSync locally. Wait a few seconds for the services to initialize...
ping 127.0.0.1 -n 7 >nul
start "" "http://localhost:5000"
echo KitchenSync is at http://localhost:5000
exit /b 0

:model_service
cd /d "%~dp0model-service"
set "DISABLE_MODEL_SOURCE_CHECK=True"
set "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True"
.venv\Scripts\python.exe -m uvicorn model_service:app --host 127.0.0.1 --port 8000
if errorlevel 1 echo The local OCR service stopped with an error.
pause
exit /b

:api_server
cd /d "%~dp0backend"
set "MODEL_SERVICE_URL=http://127.0.0.1:8000"
set "MODEL_TIMEOUT_MS=60000"
set "PORT=5000"
node src\server.js
if errorlevel 1 echo The KitchenSync backend stopped with an error.
pause
exit /b
