FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run prepare:web


FROM nginx:alpine

RUN apk add --no-cache nodejs npm supervisor

WORKDIR /app

COPY --from=builder /app /app

COPY --from=builder /app/www /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY supervisord.conf /etc/supervisord.conf

EXPOSE 80

CMD ["/usr/bin/supervisord","-c","/etc/supervisord.conf"]
