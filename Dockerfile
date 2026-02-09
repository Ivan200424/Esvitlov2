FROM node:20-alpine

# better-sqlite3 потребує build tools для компіляції native модуля
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Копіюємо package files та встановлюємо залежності
COPY package*.json ./
RUN npm ci --only=production

# Копіюємо код
COPY . .

# Створюємо директорію для бази даних
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "src/index.js"]
