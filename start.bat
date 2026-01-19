@echo off
echo Starting Databases and Admin tools...

:: Перечисляем только нужные сервисы из вашего docker-compose
docker-compose up -d mongo-gh mongo-preprocessed postgres pgadmin4 mongo-gh-express mongo-preprocessed-express

echo Ready!
exit