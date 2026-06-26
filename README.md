# ReviewAgent 🌟

Agente de IA para gestionar y responder reseñas de Google Maps de forma inteligente.

## Características

- Respuestas personalizadas por restaurante (tono, personalidad, tipo de cocina)
- Modo individual y modo lote (hasta 70+ restaurantes)
- Filtro automático de riesgo (sanidad, intoxicación, etc.) → cola de revisión manual
- Historial persistente
- Escalable a 70+ negocios

## Deploy en Vercel

1. Conecta este repo en [vercel.com](https://vercel.com)
2. Agrega la variable de entorno: `ANTHROPIC_API_KEY=sk-ant-...`
3. Deploy automático ✅

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# Agrega tu ANTHROPIC_API_KEY en .env.local
npm run dev
```