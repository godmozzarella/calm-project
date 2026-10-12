#!/usr/bin/env python3
"""Safely configure local Gmail SMTP credentials in the ignored backend/.env."""

from getpass import getpass
from pathlib import Path
import os
import re
import tempfile


env_path = Path(__file__).resolve().parents[1] / ".env"
email = input("Gmail address: ").strip()
if not re.fullmatch(r"[^\s@]+@[^\s@]+", email):
    raise SystemExit("Enter a valid email address.")

app_password = "".join(getpass("Google App Password (input hidden): ").split())
if len(app_password) != 16 or not app_password.isalnum():
    raise SystemExit("Google App Password should contain 16 letters/digits; spaces are removed automatically.")

updates = {
    "CALM_MAIL_PROVIDER": "smtp",
    "CALM_SMTP_HOST": "smtp.gmail.com",
    "CALM_SMTP_PORT": "587",
    "CALM_SMTP_USER": email,
    "CALM_SMTP_PASS": app_password,
    "CALM_MAIL_FROM": email,
    "CALM_MAIL_FROM_NAME": "Calm",
    "CALM_SMTP_DEBUG": "false",
}

existing = env_path.read_text().splitlines() if env_path.exists() else []
remaining = [line for line in existing if line.partition("=")[0] not in updates]
content = "\n".join([*remaining, *(f"{key}={value}" for key, value in updates.items())]) + "\n"
env_path.parent.mkdir(parents=True, exist_ok=True)

fd, temporary_name = tempfile.mkstemp(prefix=".env-calm-", dir=env_path.parent)
try:
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as temporary:
        temporary.write(content)
        temporary.flush()
        os.fsync(temporary.fileno())
    os.replace(temporary_name, env_path)
finally:
    if os.path.exists(temporary_name):
        os.unlink(temporary_name)

print("Gmail SMTP settings saved to backend/.env (permissions 600); the password was not displayed.")
