FROM node:18-alpine AS builder

WORKDIR /app

# 安装git
RUN apk add --no-cache git

# 克隆正确的仓库
RUN git clone https://github.com/QAbot-zh/ChatGPT-Next-Web.git .
# 下载SVG图标
COPY /.github/assets/chatgpt.svg app/icon/chatgpt.svg

# 创建自定义样式文件
RUN mkdir -p app/styles/
RUN echo '@import "./animation.scss"; \
@import "./window.scss"; \
@mixin light { \
  --theme: light; \
  --white: #fff; \
  --black: #303030; \
  --gray: #fafafa; \
  --primary: #315ef8; \
  --second: #f3f3f6; \
  --hover-color: #f3f3f3; \
  --bar-color: rgba(0,0,0,.1); \
  --theme-color: var(--gray); \
  --shadow: 50px 50px 100px 10px rgba(0,0,0,.1); \
  --card-shadow: 0px 2px 4px 0px rgba(0,0,0,.05); \
  --border-in-light: 1px solid #dedede; \
  --sidebar-sub-title: rgba(38,47,156,.5); \
} \
@mixin dark { \
  --theme: dark; \
  --white: #1e1e1e; \
  --black: #bbb; \
  --gray: #151515; \
  --primary: #315ef8; \
  --second: #26262c; \
  --hover-color: #323232; \
  --bar-color: rgba(255, 255, 255, 0.1); \
  --border-in-light: 1px solid rgba(255, 255, 255, 0.192); \
  --theme-color: var(--gray); \
  div:not(.no-dark) > svg { \
    filter: invert(0.5); \
  } \
} \
.light { \
  @include light; \
} \
.dark { \
  @include dark; \
} \
.mask { \
  filter: invert(0.8); \
} \
:root { \
  @include light; \
  --window-width: 90vw; \
  --window-height: 90vh; \
  --sidebar-width: 300px; \
  --window-content-width: calc(100% - var(--sidebar-width)); \
  --message-max-width: 80%; \
  --full-height: 100%; \
} \
@media only screen and (max-width: 600px) { \
  :root { \
    --window-width: 100vw; \
    --window-height: var(--full-height); \
    --sidebar-width: 100vw; \
    --window-content-width: var(--window-width); \
    --message-max-width: 100%; \
  } \
  .no-mobile { \
    display: none; \
  } \
}' > app/styles/globals.scss

# 修改标题和副标题
RUN sed -i 's/NextChat/NieAI Chat/g' app/components/sidebar.tsx
RUN sed -i 's/Build your own AI assistant./Quickly start your AI journey./g' app/components/sidebar.tsx

# 安装依赖并构建
RUN npm install
RUN npm run build

# 运行时镜像
FROM node:18-alpine AS runner

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 安装 cloudflared
COPY --from=cloudflare/cloudflared:latest /usr/local/bin/cloudflared /usr/local/bin/cloudflared






# 设置环境变量
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

EXPOSE 3000

# 启动服务，如果提供了CF_TOKEN则启动Cloudflare tunnel
CMD if [ -n "$CF_TOKEN" ]; then \
      cloudflared tunnel --no-autoupdate run --token $CF_TOKEN & node server.js; \
    else \
      node server.js; \
    fi
