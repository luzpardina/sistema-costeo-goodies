@echo off
echo ============================================
echo  CATALOGO UNIFICADO v4
echo  Unifica maestro + catalogo en uno solo
echo ============================================
echo.

cd /d C:\Users\Admin\Desktop\sistema-costeo-backend

echo [1/4] Copiando models\CatalogoArticulo.js...
copy /Y "%~dp0CatalogoArticulo.js" "models\CatalogoArticulo.js"

echo [2/4] Copiando controllers\costeoController.js...
copy /Y "%~dp0costeoController.js" "controllers\costeoController.js"

echo [3/4] Copiando routes\maestroRoutes.js...
copy /Y "%~dp0maestroRoutes.js" "routes\maestroRoutes.js"

echo [4/4] Copiando public\index.html (frontend)...
copy /Y "%~dp0index.html" "public\index.html"

echo.
echo Haciendo push a GitHub...
echo.

git add -A
git commit -m "Catalogo unificado: maestro + datos COMEX en uno solo"
git push

echo.
echo ============================================
echo  PUSH OK! Railway redeploya en 2-3 min.
echo.
echo  EJECUTAR EN PGADMIN el archivo:
echo  unificar_catalogos.sql
echo ============================================
echo.
pause
