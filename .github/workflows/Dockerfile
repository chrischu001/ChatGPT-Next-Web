FROM node:18-alpine AS builder

WORKDIR /app

# 复制项目文件
COPY . .

# 安装依赖并构建
RUN npm i 
RUN npm run build

# 使用更小的运行时镜像
FROM node:18-alpine AS runner

WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

# 只安装生产依赖
RUN npm install --production

# 安装 cloudflared
COPY --from=cloudflare/cloudflared:latest /usr/local/bin/cloudflared /usr/local/bin/cloudflared

EXPOSE 3000

# 使用shell形式的CMD来运行多个命令
CMD sh -c "if [ -n \"$CF_TOKEN\" ]; then cloudflared tunnel --no-autoupdate run --token $CF_TOKEN & npm run start; else npm run start; fi"
