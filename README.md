# Calm

Трекер головной боли: дневник приступов и препаратов, аналитика, экспорт для врача.

Монорепо из двух частей:

```
calm-project/
├── frontend/   React 19 + Vite 7 + SCSS modules (FSD-подобная архитектура)
└── backend/    Spring Boot 3.4 + Spring Data MongoDB + JWT
```

## Быстрый старт

### Frontend (dev)

```sh
cd frontend
npm install
npm run dev
```

Откроется `http://localhost:5173`. Сейчас фронт хранит всё в localStorage, бэк не обязателен.

### Backend (dev)

Нужна Mongo. Поднять локально:

```sh
docker run -d --name calm-mongo -p 27017:27017 mongo:7
```

Затем:

```sh
cd backend
mvn spring-boot:run
```

API будет на `http://localhost:8080/api`. Подробности — в [`backend/README.md`](backend/README.md).

## Стек

- **Фронт:** React 19, Vite 7, SCSS modules, react-router-dom 7, MUI icons. Чистый JS (jsconfig).
- **Бэк:** Java 21, Spring Boot 3.4, MongoDB, jjwt, bcrypt.
- **Хранилище:** MongoDB (планируется заменить текущий фронтовый localStorage).

## Где что лежит

| Что              | Где                                              |
|------------------|--------------------------------------------------|
| UI-страницы      | `frontend/src/pages/`                            |
| Виджеты дашборда | `frontend/src/widgets/`                          |
| Доменные entity  | `frontend/src/entities/{attack,medication,user}` |
| Бэкенд: API      | `backend/src/main/java/com/calm/feature/`        |
| Бэкенд: конфиг   | `backend/src/main/java/com/calm/config/`         |
| Бэкенд: security | `backend/src/main/java/com/calm/security/`       |

## Roadmap

См. [`backend/README.md`](backend/README.md), раздел «Что ещё надо доделать».
