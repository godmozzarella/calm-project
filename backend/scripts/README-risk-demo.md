# Данные для проверки персонального прогноза

Скрипт копирует учётную запись существующего админа в отдельную базу `calm_risk_demo` и добавляет синтетические данные: 60 дней погодной истории, погоду на сегодня и три следующих дня, 11 дней с приступами и 4 дня с препаратами. Рабочую базу он только читает. Повторный запуск пересоздаёт только записи с префиксом `risk-demo-`, чтобы даты оставались актуальными.

В корне проекта при запущенном Docker Compose и единственном администраторе:

```sh
docker compose exec -T mongo mongosh --quiet calm --file /dev/stdin < backend/scripts/seed-risk-demo.js
```

Если администраторов несколько, укажите нужный email:

```sh
docker compose exec -T -e CALM_RISK_DEMO_EMAIL='адрес-админа@example.com' mongo mongosh --quiet calm --file /dev/stdin < backend/scripts/seed-risk-demo.js
```

Запуск через `--file` останавливается при первой ошибке скрипта.

Для просмотра запустите рядом с обычным приложением отдельный бэкенд и фронтенд:

```sh
cd backend
JAVA_TOOL_OPTIONS=-Duser.timezone=UTC MONGO_URI=mongodb://localhost:27017/calm_risk_demo PORT=8081 mvn spring-boot:run
```

```sh
cd frontend
VITE_API_URL=http://localhost:8081/api npm run dev
```

Откройте `http://localhost:5173` и войдите с теми же данными админа. У демонстрационной копии выключены уведомления и сброшены refresh-токены. Для повторяемого сценария можно передать `CALM_RISK_DEMO_TODAY=YYYY-MM-DD` через `docker compose exec -e`.

Погодные снимки в скрипте вымышленные. Они служат для проверки интерфейса, порогов и вычислений, а не для оценки качества прогноза на реальных данных.
