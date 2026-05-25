#!/usr/bin/env bash
# Запуск Calm-бэка в dev-режиме с подгрузкой backend/.env
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
	echo "→ Загружаю переменные из $ENV_FILE"
	set -a
	# shellcheck source=/dev/null
	source "$ENV_FILE"
	set +a
else
	echo "⚠ $ENV_FILE не найден. Скопируй .env.example в .env и заполни секреты."
fi

cd "$SCRIPT_DIR"
exec mvn spring-boot:run
