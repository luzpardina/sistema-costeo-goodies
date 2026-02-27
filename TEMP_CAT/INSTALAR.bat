@echo off
echo ============================================
echo  ACTUALIZANDO SISTEMA CON CATALOGO v2
echo ============================================
echo.

cd /d C:\Users\Admin\Desktop\sistema-costeo-backend

echo [1/4] Copiando models\index.js...
copy /Y "%~dp0index.js" "models\index.js"

echo [2/4] Copiando routes\catalogoRoutes.js...
copy /Y "%~dp0catalogoRoutes.js" "routes\catalogoRoutes.js"

echo [3/4] Copiando server.js...
copy /Y "%~dp0server.js" "server.js"

echo [4/4] Copiando public\index.html (frontend)...
copy /Y "%~dp0index.html" "public\index.html"

echo.
echo ============================================
echo  ARCHIVOS COPIADOS OK
echo ============================================
echo.
echo Haciendo commit y push a GitHub...
echo.

git add -A
git commit -m "Catalogo unificado con autocompletado de derechos e imp internos"
git push

echo.
echo ============================================
echo  LISTO! Railway va a redeployar en 2-3 min.
echo ============================================
echo.
pause
