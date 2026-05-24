# Calm — Backend

REST-API для трекера головной боли Calm. Spring Boot 3.4 + Spring Data MongoDB + Spring Security (JWT).

## Стек

- **Java 21** (target). Сборка может идти на JDK 21+ (включая 25).
- **Spring Boot 3.4.1**: web, data-mongodb, security, validation, actuator.
- **MongoDB 6+** (доменное хранилище). Локально — `mongodb://localhost:27017/calm`.
- **jjwt 0.12** — выпуск/верификация JWT.
- **flapdoodle embedded mongo** — только в тестах.

## Структура

Пакетирование «по фичам»:

```
src/main/java/com/calm/
├── CalmApplication.java         главный класс, @EnableMongoAuditing
├── config/                      cross-cutting конфиги (CORS, Security)
├── common/exception/            глобальные исключения и ErrorResponse
├── security/                    JwtService, JwtAuthFilter, AuthenticatedUser
└── feature/
    ├── auth/                    /auth/register, /auth/login
    ├── user/                    /users/me (GET/PATCH)
    ├── attack/                  CRUD /attacks
    └── medication/              CRUD /medications + /medications/overuse
```

В каждой feature: `*.java` (модель), `*Repository.java` (Spring Data),
`*Service.java` (бизнес-логика), `*Controller.java` (REST), `dto/`.

## API (черновик)

| Метод  | Путь                                | Описание                                       | Auth |
|--------|-------------------------------------|------------------------------------------------|------|
| POST   | `/api/auth/register`                | Регистрация. Body: `{ email, name, password }` | —    |
| POST   | `/api/auth/login`                   | Вход. Body: `{ email, password }`              | —    |
| GET    | `/api/users/me`                     | Текущий пользователь                           | ✅   |
| PATCH  | `/api/users/me`                     | Обновить профиль (имя, email, пароль, аватар)  | ✅   |
| GET    | `/api/attacks?from=&to=`            | Список приступов (опц. диапазон)               | ✅   |
| POST   | `/api/attacks`                      | Создать приступ                                | ✅   |
| GET    | `/api/attacks/{id}`                 | Получить один                                  | ✅   |
| PUT    | `/api/attacks/{id}`                 | Обновить                                       | ✅   |
| DELETE | `/api/attacks/{id}`                 | Удалить                                        | ✅   |
| GET    | `/api/medications?from=&to=`        | Список препаратов                              | ✅   |
| POST   | `/api/medications`                  | Создать                                        | ✅   |
| PUT    | `/api/medications/{id}`             | Обновить                                       | ✅   |
| DELETE | `/api/medications/{id}`             | Удалить                                        | ✅   |
| GET    | `/api/medications/overuse?year&month` | Уникальные дни приёма в месяце (для MOH-плитки) | ✅   |
| GET    | `/api/actuator/health`              | Health-check                                   | —    |

Auth: после `register`/`login` сервер возвращает `{ token, user }`. Фронт кладёт
`Authorization: Bearer <token>` во все защищённые запросы.

Все коллекции в Mongo фильтруются по `userId` — пользователь видит только свои данные.

## Конфигурация

`src/main/resources/application.yml` берёт настройки из ENV:

| Переменная           | По умолчанию                              | Описание                          |
|----------------------|-------------------------------------------|-----------------------------------|
| `MONGO_URI`          | `mongodb://localhost:27017/calm`          | Подключение к Mongo               |
| `PORT`               | `8080`                                    | HTTP-порт                         |
| `CALM_JWT_SECRET`    | dev-secret (НЕ для прода)                 | Секрет JWT, ≥ 32 байт             |
| `CALM_JWT_EXP_MIN`   | `1440` (24 часа)                          | Срок жизни access-токена          |
| `CALM_CORS_ORIGINS`  | `http://localhost:5173,http://localhost:4173` | Разрешённые origin'ы фронта   |

## Запуск

Локально требуется MongoDB. Самый быстрый способ — Docker:

```sh
docker run -d --name calm-mongo -p 27017:27017 mongo:7
```

Затем:

```sh
cd backend
mvn spring-boot:run
```

API будет доступно на `http://localhost:8080/api`.

## Тесты

```sh
mvn test
```

В тестах поднимается embedded MongoDB через `de.flapdoodle.embed.mongo`,
реальный Mongo не нужен.

## Что ещё надо доделать (после первого green-build)

- Rate-limit на `/auth/*` (брутфорс защиты пока нет).
- Refresh-токены (сейчас только access).
- Серверные агрегаты для `/stats` (KPI, паттерны) — пока считаются на фронте.
- Загрузка/хранение аватаров (S3/GridFS).
- Серверный PDF-рендер отчёта.
- Классификация препаратов (`therapeuticClass` / `purpose`) и честная MOH-метрика —
  поля в модели уже зарезервированы.
- Docker Compose для bring-up `app + mongo` одной командой.
- OpenAPI/Swagger.
