@echo off
echo ============================================
echo  CATALOGO UNIFICADO v5 - Avisos y control
echo ============================================
echo.
cd /d C:\Users\Admin\Desktop\sistema-costeo-backend
copy /Y "%~dp0CatalogoArticulo.js" "models\CatalogoArticulo.js"
copy /Y "%~dp0costeoController.js" "controllers\costeoController.js"
copy /Y "%~dp0maestroRoutes.js" "routes\maestroRoutes.js"
copy /Y "%~dp0catalogoRoutes.js" "routes\catalogoRoutes.js"
copy /Y "%~dp0index.html" "public\index.html"
echo.
git add -A
git commit -m "Catalogo: avisos de diferencias al guardar y preview al importar"
git push
echo.
echo LISTO! Railway redeploya en 2-3 min.
pause
