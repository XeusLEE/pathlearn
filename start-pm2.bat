@echo off
set PM2_HOME=C:\Users\Administrator\.pm2
cd /d C:\inetpub\wwwroot\pathlearnerz.com
call C:\Users\Administrator\AppData\Roaming\npm\pm2.cmd start ecosystem.config.js
call C:\Users\Administrator\AppData\Roaming\npm\pm2.cmd save
