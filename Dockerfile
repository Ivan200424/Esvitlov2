FROM node:20-alpine

WORKDIR /app

# Копіюємо package files
COPY package*.json ./

# Встановлюємо залежності
RUN npm ci --only=production

# Копіюємо весь код
COPY . .

# Змінна середовища для timezone
ENV TZ=Europe/Kyiv

# Expose port for webhook/health check
EXPOSE 3000

# Запускаємо бота
CMD ["node", "src/index.js"]
