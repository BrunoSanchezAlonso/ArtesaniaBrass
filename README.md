# ArtesaniaBrass

Tienda online de joyería artesanal en bronce y latón. Frontend estático con Supabase (productos, pedidos, admin) y pagos con Stripe Checkout.

## Estructura del proyecto

```
ArtesaniaBrass/
├── public/                 # Web pública (desplegar esta carpeta)
│   ├── index.html          # Tienda
│   ├── admin.html          # Panel de administración
│   ├── success.html        # Confirmación de pago
│   ├── cancel.html         # Pago cancelado
│   ├── css/
│   ├── js/
│   │   ├── store.js        # Lógica de la tienda
│   │   ├── admin.js        # Panel admin
│   │   ├── productos.js    # Productos locales de respaldo
│   │   └── config/         # Claves Supabase y Stripe (local)
│   └── assets/images/      # Imágenes estáticas
├── supabase/
│   ├── migrations/         # Esquema de base de datos
│   └── functions/          # Backend (checkout, pedidos, emails)
├── scripts/
│   └── setup-config.js     # Crear archivos de configuración
├── netlify.toml            # Configuración de despliegue
└── package.json
```

## Primer uso en local

1. Instalar dependencias:

```bash
npm install
```

2. Crear configuración (si no existe):

```bash
npm run setup:config
```

3. Editar `public/js/config/supabase-config.js` y `public/js/config/stripe-config.js` con tus claves.

4. Copiar las imágenes a `public/assets/images/`.

5. Arrancar la web:

```bash
npm run dev
```

Abre http://localhost:3000

## Supabase (backend)

```bash
npx supabase login
npm run supabase:link
npm run supabase:db:push
npm run supabase:functions:deploy
```

Configura los secretos en Supabase: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `STORE_OWNER_EMAIL`.

## Publicar en Netlify

1. Sube el repositorio a GitHub.
2. En [Netlify](https://app.netlify.com), conecta el repositorio.
3. Netlify detectará `netlify.toml` y publicará la carpeta `public/`.
4. Añade la URL de Netlify en Supabase → Authentication → URL Configuration.

## Subir a GitHub

```bash
git init
git add .
git commit -m "Estructura inicial ArtesaniaBrass"
git branch -M main
git remote add origin https://github.com/BrunoSanchezAlonso/ArtesaniaBrass.git
git push -u origin main
```

> Los archivos `supabase-config.js` y `stripe-config.js` no se suben al repositorio (están en `.gitignore`). En cada máquina nueva, ejecuta `npm run setup:config` y rellena las claves.

## Licencia

Proyecto privado — ArtesaniaBrass © 2026
