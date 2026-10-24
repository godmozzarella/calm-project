# Выпуск Calm через GitHub Actions

Сайт уже работает на VPS. Код поступает туда через `git fetch` и fast-forward в `main`, а Docker Compose пересобирает приложение на сервере. База MongoDB, аватары и серверные `.env` остаются на VPS; текущий процесс резервного копирования не меняется. Workflow не удаляет тома и не переносит данные.

## Что делает workflow

- На push в `main` и в pull request запускает Maven-тесты, тесты экспортёра, frontend lint, build и frontend unit-тесты.
- Вкладка **Actions → Check and release → Run workflow** запускает те же проверки для выбранной ветки. Выбрать `main`: только запуск из `main` может перейти к выкладке.
- После успешных проверок GitHub подключается к VPS по SSH, передаёт SHA проверенного коммита, делает fast-forward серверного `main`, запускает существующий production preflight и `docker compose up -d --build --no-deps --wait` для backend, frontend, training-worker и Caddy. Затем проверяет health backend, состояние сервисов и публичный HTTPS.
- Обычный push в `main` **не выкладывает** сайт автоматически. Каждый выпуск запускается вручную. Один workflow не допускает параллельные выпуски из `main`.

## Однократная настройка

1. На VPS убедиться, что checkout стоит на `main`, рабочее дерево чистое, `git fetch origin main` проходит без интерактивного ввода, а пользователь релиза может выполнять `docker compose`. Проверить серверные `.env`, `backend/.env` и `backend/.env.training-worker` с правами `600` и production preflight: `sh backend/scripts/check-prod-training-readiness.sh --release`. Серверные секреты в GitHub не переносить.
2. Создать **отдельную** SSH-пару для GitHub Actions, добавить её публичный ключ в `~/.ssh/authorized_keys` пользователя релиза на VPS. Личный SSH-ключ Mac не использовать. Приватный ключ поместить в GitHub repository secret `DEPLOY_SSH_KEY`.
3. Сверить ED25519 host key сервера через уже доверенное SSH-подключение (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) и результат `ssh-keyscan -t ed25519 <адрес>` на Mac. Проверенную строку `ssh-keyscan` сохранить как repository secret `DEPLOY_KNOWN_HOSTS`. Один только `ssh-keyscan` без сверки не подтверждает личность сервера.
4. В **Settings → Secrets and variables → Actions → Repository secrets** создать:

   | Secret | Значение |
   | --- | --- |
   | `DEPLOY_HOST` | DNS-имя или IPv4 VPS, доступные GitHub runner |
   | `DEPLOY_USER` | SSH-пользователь релиза |
   | `DEPLOY_PATH` | Абсолютный путь к checkout проекта на VPS без пробелов |
   | `DEPLOY_SSH_KEY` | Приватный ключ отдельной пары |
   | `DEPLOY_KNOWN_HOSTS` | Проверенная строка host key VPS |

5. Опубликовать workflow своим обычным `git commit` и `git push origin main`. Дождаться зелёной проверки push. После этого вручную запустить **Run workflow** для `main` и проверить результат выпуска. По желанию защитить `main` обязательными проверками `backend` и `frontend` через branch protection/ruleset.

## Проверка и ограничения

На VPS скрипт отказывается работать при локальных изменениях, другой ветке, коммите вне `origin/main` или попытке выложить коммит старше текущего. `check-prod-training-readiness.sh --release` проверяет секретные env и конфигурацию перед пересборкой. Если сборка или health-check не пройдут, job станет красным; автоматического отката нет. В этом случае смотреть вывод job, `docker compose ... ps` и логи нужного сервиса на VPS; не запускать `down -v`.

GitHub runner не получает данные MongoDB или содержимое серверных env. Успешный health-check подтверждает запуск backend; пользовательский сценарий, письмо, HTTPS и актуальность резервных копий следует проверять отдельно после значимых релизов.
