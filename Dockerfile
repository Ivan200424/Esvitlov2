FROM node:20-alpine

WORKDIR /app

# Копіюємо package files
COPY package*.json ./

# Встановлюємо залежності
RUN npm ci --only=production

# Копіюємо весь код
COPY . .

# Створюємо директорію для даних
RUN mkdir -p /app/data

# Змінна середовища для timezone
ENV TZ=Europe/Kyiv

# Запускаємо бота
CMD ["node", "src/index.js"]
