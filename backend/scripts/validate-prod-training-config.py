"""Validate rendered production Compose and secrets without printing secret values."""

import json
import hashlib
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit


def fail(message):
    raise SystemExit(message)


def read_env(path):
    values = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("\"'")
    return values


def mongo_identity(uri, expected_user, expected_database):
    try:
        parsed = urlsplit(uri)
        valid = (
            parsed.scheme in ("mongodb", "mongodb+srv")
            and parsed.username == expected_user
            and parsed.password
            and parsed.path == f"/{expected_database}"
        )
    except ValueError:
        valid = False
    if not valid:
        fail(f"Mongo URI must use role {expected_user} and database {expected_database}")


config = json.load(sys.stdin)
services = config.get("services", {})
expected = {"mongo", "backend", "frontend", "caddy", "training-worker"}
if not expected.issubset(services):
    fail("Production Compose is missing a required service")
if "--auth" not in services["mongo"].get("command", []):
    fail("Production MongoDB must start with --auth")
for name in expected - {"caddy"}:
    if services[name].get("ports"):
        fail(f"{name} must not publish ports in production")
caddy_ports = {int(port.get("published", -1)) for port in services["caddy"].get("ports", [])}
if caddy_ports != {80, 443}:
    fail("Caddy must publish only ports 80 and 443")
worker_env = services["training-worker"].get("environment", {})
if worker_env.get("CALM_RISK_TRAINING_TEST_MODE") != "NO":
    fail("Training worker must not run in test mode")
if worker_env.get("CALM_TRAINING_REBUILD_CONFIRM") != "YES":
    fail("Training worker must explicitly rebuild active snapshots")
export_mounts = [item for item in services["training-worker"].get("volumes", [])
                 if item.get("target") == "/scripts/export-shared-risk-training.js"]
if len(export_mounts) != 1 or not export_mounts[0].get("source", "").endswith(
        "/backend/scripts/export-shared-risk-training-v3.js"):
    fail("Production worker must mount the version 3 exporter")

root = read_env(".env")
backend = read_env("backend/.env")
worker = read_env("backend/.env.training-worker")
mongo_identity(root["CALM_MONGO_URI"], "calm_app", "calm")
mongo_identity(worker["CALM_TRAINING_SOURCE_URI"], "calm_risk_export_reader", "calm")
mongo_identity(worker["CALM_TRAINING_MONGO_URI"], "calm_risk_training_writer", "calm_risk_training")
if len(worker["CALM_TRAINING_HMAC_KEY"].encode("utf-8")) < 32:
    fail("Training HMAC key must contain at least 32 bytes")
if backend["CALM_RISK_PILOT_APPROVED_CONSENT_VERSION"] != worker["CALM_RISK_CONSENT_VERSION"]:
    fail("Backend and training worker consent versions differ")
digest = worker["CALM_RISK_CONSENT_DIGEST"]
if not re.fullmatch(r"[a-f0-9]{64}", digest) or digest != backend["CALM_RISK_PILOT_APPROVED_CONSENT_DIGEST"]:
    fail("Backend and training worker consent digests differ or are invalid")
policy_source = Path("backend/src/main/java/com/calm/feature/risk/SharedModelConsentPolicy.java").read_text()
version_match = re.search(r'public static final String VERSION = "([^"]+)"', policy_source)
text_match = re.search(r'public static final List<String> TEXT = List\.of\((.*?)\);', policy_source, re.S)
paragraphs = re.findall(r'"([^"\\]*)"', text_match.group(1)) if text_match else []
if not version_match or not paragraphs:
    fail("Cannot verify the consent policy in backend source")
actual_digest = hashlib.sha256("\n".join(paragraphs).encode("utf-8")).hexdigest()
if version_match.group(1) != worker["CALM_RISK_CONSENT_VERSION"] or actual_digest != digest:
    fail("Configured consent does not match the backend policy")

print("Production Compose, Mongo roles and consent settings are consistent.")
