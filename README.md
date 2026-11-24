# CCM SOFTWARE_ — Experiencia cinematográfica de ventas

Película interactiva en el navegador (~60–90 s) para captar organizadores de rifas interesados en el SaaS **CCM SOFTWARE_**.

Concepto: **Acabas de perder un cliente.**

## Requisitos

- PHP 8.2+
- Apache / OpenLiteSpeed (document root = raíz del proyecto **o** `public/`)
- Navegador moderno con autoplay policies estándar
- (Opcional) MySQL/MariaDB para analítica persistente
- (Opcional) Meta Pixel + Conversions API

## Instalación local

1. Copia el entorno:

```bash
cp .env.example .env
```

2. Configura al menos:

```env
WHATSAPP_NUMBER=57XXXXXXXXXX
APP_URL=https://raffle-landing.ccmsoftware.local
```

3. Si el document root es la raíz del proyecto (como en este vhost), ya existen symlinks:

- `assets` → `public/assets`
- `api` → `public/api`

4. Abre `https://raffle-landing.ccmsoftware.local/`

Composer es opcional (autoload PSR-4 propio en `app/Config/bootstrap.php`):

```bash
composer install
```

## Estructura

```
app/                 PHP (config, controllers, services)
public/              Entrada HTML + assets + API
views/               (reservado)
database/schema.sql  Analítica opcional
GUIA_GRABACION_VOCES.md
```

## Dónde poner tus voces

`public/assets/audio/voices/`

Ver `GUIA_GRABACION_VOCES.md`.

## Dónde poner el video del software

`public/assets/video/software-demo.mp4`

Mientras no exista, se usa el placeholder y un aviso en pantalla.

## WhatsApp

1. En `.env`: `WHATSAPP_NUMBER=573001234567` (internacional, solo dígitos).
2. El CTA **Quiero contratar mi sistema** abre `wa.me` con el mensaje prearmado.
3. Si falta el número, **no** redirige a un destinatario inventado: muestra aviso y log en consola.
4. El clic se registra como contacto potencial (`WhatsAppClicked` / `Contact`), **no** como Purchase.

## Meta Pixel + CAPI

En `.env`:

```env
META_TRACKING_ENABLED=true
META_PIXEL_ID=tu_pixel
META_CAPI_TOKEN=tu_token_servidor
META_GRAPH_API_VERSION=v25.0
META_CAPI_TEST_CODE=          # opcional, Events Manager test
REQUIRE_CONSENT=true
```

Configuración real en `~/websites/.env-ra` (no en el repo).

- **Pixel (browser):** solo `PageView` tras consentimiento.
- **CAPI (servidor):** `ViewContent`, `InitiateCheckout`, `Contact`, `Lead`, etc. con `event_id`, `fbp`/`fbc`, IP/UA y PII hasheada (SHA-256).
- El token CAPI **nunca** se expone al JavaScript.
- Optimiza campañas sobre **Lead** (primario) y **Contact** (WhatsApp / llamada).

## Analítica en base de datos

```env
DB_ENABLED=true
DB_HOST=127.0.0.1
DB_NAME=ccm_cinematic
DB_USER=...
DB_PASS=...
```

Importa `database/schema.sql`. Sin DB la experiencia funciona igual; solo no persiste eventos.

## Controles del visitante

- Subtítulos cuando hay voces
- `prefers-reduced-motion` reduce animaciones
- Recursos faltantes no bloquean el flujo

## Pruebas rápidas

```bash
php tests/smoke.php
curl -s https://raffle-landing.ccmsoftware.local/api/config.php
```

Rutas a validar en navegador: aceptar llamada, rechazar, silenciar, saltar, reiniciar, CTA WhatsApp.

## Pendiente del propietario

- [ ] Grabaciones de voz reales  
- [ ] Video real del panel/producto  
- [ ] `WHATSAPP_NUMBER`  
- [ ] Meta Pixel / CAPI (si aplica)  
- [ ] Música/SFX con licencia comercial si reemplazas los tonos provisionales  
