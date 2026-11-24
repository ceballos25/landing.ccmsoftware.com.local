-- CCM SOFTWARE_ — Analítica opcional de la experiencia cinematográfica
-- Ejecutar solo si DB_ENABLED=true

CREATE DATABASE IF NOT EXISTS ccm_cinematic
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ccm_cinematic;

CREATE TABLE IF NOT EXISTS experience_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  event_name VARCHAR(64) NOT NULL,
  scene VARCHAR(64) NOT NULL DEFAULT '',
  elapsed_ms INT UNSIGNED NOT NULL DEFAULT 0,
  utm_source VARCHAR(120) NOT NULL DEFAULT '',
  utm_medium VARCHAR(120) NOT NULL DEFAULT '',
  utm_campaign VARCHAR(120) NOT NULL DEFAULT '',
  device VARCHAR(64) NOT NULL DEFAULT '',
  interaction VARCHAR(120) NOT NULL DEFAULT '',
  payload_json JSON NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_id (event_id),
  KEY idx_session (session_id),
  KEY idx_event_name (event_name),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
