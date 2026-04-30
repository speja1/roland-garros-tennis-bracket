FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV HOST=0.0.0.0
ENV PORT=4173
ENV DATA_DIR=/app/data

EXPOSE 4173

CMD ["npm", "start"]
