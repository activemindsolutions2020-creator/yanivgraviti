@echo off
echo =========================================
echo  Deploying changes to the Server (Render)
echo =========================================
echo.

git add .
git commit -m "Auto update %date% %time%"
git push

echo.
echo =========================================
echo  Done! Render will now auto-deploy.
echo  It usually takes 2-3 minutes to go live.
echo =========================================
pause
