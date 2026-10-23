FROM oven/bun:1.3.13 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun test && bun run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN sed -i 's/listen\(.*\)80;/listen\13000;/' /etc/nginx/conf.d/default.conf
EXPOSE 3000
