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


