# Despliegue producción — landing CCM SOFTWARE

Repo: `https://github.com/ceballos25/landing.ccmsoftware.com.local.git`

## 1. Clonar

```bash
cd /var/www   # o la ruta de tu hosting
git clone https://github.com/ceballos25/landing.ccmsoftware.com.local.git landing.ccmsoftware.com.co
cd landing.ccmsoftware.com.co
```

(Si el repo es privado: usa SSH o un personal access token.)

## 2. PHP + Composer

Requiere **PHP ≥ 8.2** con extensiones: `curl`, `json`, `mbstring`, `openssl`.

```bash
composer install --no-dev --optimize-autoloader
```

## 3. Variables de entorno (fuera del git)

Crea el archivo de secretos (elige **una** ruta):

- `../.env-ra` (carpeta padre del repo), o
- `.env-ra` dentro del proyecto (está en `.gitignore`)

```bash
nano /var/www/.env-ra
# o: nano .env-ra
```

Mínimo recomendado:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://TU-DOMINIO.com

WHATSAPP_NUMBER=573233745913
CONTACT_EMAIL=contacto@ccmsoftware.com.co
CONTACT_PHONE_DISPLAY=+57 323 374 5913
ADMIN_NOTIFY_EMAIL=contacto@ccmsoftware.com.co

PRICE_COP=600000
PRICE_LABEL=$600.000 COP / mes
BRAND_NAME=CCM SOFTWARE_
BRAND_LEGAL=CCM SOFTWARE_ S.A.S.

GMAIL_USER=...
GMAIL_APP_PASSWORD=...
GMAIL_FROM=contacto@ccmsoftware.com.co
GMAIL_FROM_NAME=CCM SOFTWARE_
GMAIL_HOST=smtp.gmail.com
GMAIL_PORT=587

META_PIXEL_ID=
META_CAPI_TOKEN=
META_GRAPH_API_VERSION=v25.0
META_CAPI_TEST_CODE=
META_TRACKING_ENABLED=true
REQUIRE_CONSENT=false
```

Permisos del env:

```bash
chmod 640 /var/www/.env-ra
# chown según tu usuario web, ej: chown www-data:www-data /var/www/.env-ra
```

## 4. Storage (Apache/Nginx PHP debe escribir)

```bash
mkdir -p storage/{leads,logs,queue,sessions}
chmod -R 775 storage
# Si el PHP corre como www-data:
chown -R www-data:www-data storage
```

## 5. DocumentRoot = `public/`

El vhost debe apuntar a **`…/landing.ccmsoftware.com.co/public`**, no a la raíz del repo.

Apache (ejemplo):

```apache
DocumentRoot /var/www/landing.ccmsoftware.com.co/public

<Directory /var/www/landing.ccmsoftware.com.co/public>
    Options FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
```

Nginx: `root …/public;` + `try_files $uri $uri/ /index.php?$query_string;`

SSL (Let’s Encrypt / panel) sobre el dominio. Luego recarga el servidor web.

## 6. Probar

1. Abre `https://TU-DOMINIO.com` → filtro “¿Vendes rifas?”
2. Completa un lead de prueba → correo a lead + admin
3. Meta (si ya pusiste Pixel/token): Events Manager → Test events / Overview

## 7. Actualizar después

```bash
cd /var/www/landing.ccmsoftware.com.co
git pull origin main
composer install --no-dev --optimize-autoloader
# no toques .env-ra
```

## Checklist rápido

- [ ] Clone + `composer install`
- [ ] `.env-ra` con `APP_URL` real, Gmail, Meta
- [ ] `DocumentRoot` → `public/`
- [ ] HTTPS OK
- [ ] `storage/` escribible por PHP
- [ ] Lead de prueba (correo)
- [ ] Eventos Meta en Events Manager
