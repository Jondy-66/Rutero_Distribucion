# === STAGE 1: Dependencias ===
FROM node:20-slim AS deps
WORKDIR /app

# Instalar dependencias
COPY package.json ./
RUN npm install

# === STAGE 2: Compilador ===
FROM node:20-slim AS builder
WORKDIR /app

# Copiar dependencias de la etapa anterior
COPY --from=deps /app/node_modules ./node_modules
# Copiar el resto del código de la aplicación
COPY . .

# Variables de entorno públicas (si las hubiera)
# Asegúrate de que las variables NEXT_PUBLIC_* estén disponibles durante la compilación si son necesarias.

# Construir la aplicación para producción
RUN npm run build

# === STAGE 3: Ejecución (Producción) ===
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copiar los artefactos de compilación de la etapa anterior
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Exponer el puerto en el que se ejecuta la aplicación Next.js
EXPOSE 3000

# Comando para iniciar la aplicación
# El script "start" en package.json es "next start"
CMD ["npm", "start"]
