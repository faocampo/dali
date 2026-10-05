# Dalí — paquete de marca para web

Archivos finales preparados para producción. Los SVG del logotipo tienen fondo transparente, un `viewBox` recortado y toda la tipografía convertida a trazados; no requieren fuentes externas.

## Logotipos SVG

| Archivo | Uso recomendado |
| --- | --- |
| `svg/dali-logo-light.svg` | Navegación y superficies claras |
| `svg/dali-logo-dark.svg` | Navegación y superficies oscuras |
| `svg/dali-logo-mono.svg` | Impresión y aplicaciones de un color |
| `svg/dali-symbol-color.svg` | Icono de producto sobre superficies claras |
| `svg/dali-symbol-dark.svg` | Icono de producto sobre superficies oscuras |
| `svg/dali-symbol-mono.svg` | Símbolo monocromático |

Las variantes `light` y `dark` se refieren a la superficie de destino. Todas mantienen transparencia alrededor del logo.

## Iconos de aplicación

- `png/dali-app-icon-1024.png`
- `png/dali-app-icon-512.png`
- `png/dali-app-icon-192.png`
- `png/dali-app-icon-master.svg` — master vectorial editable

Los PNG son cuadrados y tienen fondo opaco, apropiado para iconos de aplicación y PWA.

## Favicon

- `favicon/favicon.svg` — opción principal para navegadores modernos
- `favicon/favicon.ico` — contiene tamaños 16, 32 y 48 px
- `favicon/favicon-16.png`
- `favicon/favicon-32.png`
- `favicon/favicon-48.png`
- `favicon/favicon-256.png`
- `favicon/apple-touch-icon.png` — 180 × 180 px

## Integración HTML

```html
<link rel="icon" href="/branding/favicon/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/branding/favicon/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/branding/favicon/apple-touch-icon.png">
```

Logotipo principal:

```html
<img
  src="/branding/svg/dali-logo-light.svg"
  alt="Dalí"
  width="260"
  height="80"
>
```

Cambio automático según el tema del sistema:

```html
<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="/branding/svg/dali-logo-dark.svg"
  >
  <img
    src="/branding/svg/dali-logo-light.svg"
    alt="Dalí"
    width="260"
  >
</picture>
```

## React / Next.js

```jsx
<img
  src="/branding/svg/dali-logo-light.svg"
  alt="Dalí"
  className="h-10 w-auto dark:hidden"
/>
<img
  src="/branding/svg/dali-logo-dark.svg"
  alt="Dalí"
  className="hidden h-10 w-auto dark:block"
/>
```

Cuando el nombre “Dalí” ya esté escrito junto al símbolo, utiliza `alt=""` en el símbolo para evitar una lectura duplicada por tecnologías de asistencia.

## Recomendaciones

- No deformar el logo: conservar siempre su proporción.
- No recolorear las variantes cromáticas.
- Usar el SVG siempre que sea posible.
- Reservar los PNG para tiendas, PWA, perfiles e iconos del sistema.
- Mantener alrededor del logotipo un espacio mínimo equivalente a la altura del punto de la “í”.
