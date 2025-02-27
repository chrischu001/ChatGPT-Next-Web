FROM node:18-alpine AS builder

WORKDIR /app

# 安装git和wget
RUN apk add --no-cache git wget

# 克隆正确的仓库
RUN git clone https://github.com/QAbot-zh/ChatGPT-Next-Web.git .

# 下载SVG图标
RUN wget -O app/icon/chatgpt.svg https://github.com/chrischu001/ChatGPT-Next-Web/raw/refs/heads/main/.github/assets/chatgpt.svg

# 创建自定义样式文件
RUN mkdir -p app/styles/ && \
    echo '@import "./animation.scss";\n \
@import "./window.scss";\n\
\n\
@mixin light {\n\
  --theme: light;\n\
  --white: #fff;\n\
  --black: #303030;\n\
  --gray: #fafafa;\n\
  --primary: #315ef8;\n\
  --second: #f3f3f6;\n\
  --hover-color: #f3f3f3;\n\
  --bar-color: rgba(0,0,0,.1);\n\
  --theme-color: var(--gray);\n\
  --shadow: 50px 50px 100px 10px rgba(0,0,0,.1);\n\
  --card-shadow: 0px 2px 4px 0px rgba(0,0,0,.05);\n\
  --border-in-light: 1px solid #dedede;\n\
  --sidebar-sub-title: rgba(38,47,156,.5);\n\
}\n\
\n\
@mixin dark {\n\
  --theme: dark;\n\
  --white: #1e1e1e;\n\
  --black: #bbb;\n\
  --gray: #151515;\n\
  --primary: #315ef8;\n\
  --second: #26262c;\n\
  --hover-color: #323232;\n\
  --bar-color: rgba(255, 255, 255, 0.1);\n\
  --border-in-light: 1px solid rgba(255, 255, 255, 0.192);\n\
  --theme-color: var(--gray);\n\
\n\
  div:not(.no-dark) > svg {\n\
    filter: invert(0.5);\n\
  }\n\
}\n\
\n\
.light {\n\
  @include light;\n\
}\n\
\n\
.dark {\n\
  @include dark;\n\
}\n\
\n\
.mask {\n\
  filter: invert(0.8);\n\
}\n\
\n\
:root {\n\
  @include light;\n\
\n\
  --window-width: 90vw;\n\
  --window-height: 90vh;\n\
  --sidebar-width: 300px;\n\
  --window-content-width: calc(100% - var(--sidebar-width));\n\
  --message-max-width: 80%;\n\
  --full-height: 100%;\n\
}\n\
\n\
@media only screen and (max-width: 600px) {\n\
  :root {\n\
    --window-width: 100vw;\n\
    --window-height: var(--full-height);\n\
    --sidebar-width: 100vw;\n\
    --window-content-width: var(--window-width);\n\
    --message-max-width: 100%;\n\
  }\n\
\n\
  .no-mobile {\n\
    display: none;\n\
  }\n\
}\n\
\n\
@media (prefers-color-scheme: dark) {\n\
  :root {\n\
    @include dark;\n\
  }\n\
}' > app/styles/custom_globals.scss

# 将原始样式的其余部分附加到新样式
RUN sed -n '/html {/,$p' app/styles/globals.scss >> app/styles/custom_globals.scss

# 替换原始样式文件
RUN cp app/styles/custom_globals.scss app/styles/globals.scss

# 修改标题和副标题
RUN sed -i 's/NextChat/NieAI Chat/g' app/components/sidebar.tsx && \
    sed -i 's/Build your own AI assistant./Quickly start your AI journey./g' app/components/sidebar.tsx

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
CMD ["sh", "-c", "if [ -n \"$CF_TOKEN\" ]; then cloudflared tunnel --no-autoupdate run --token $CF_TOKEN & node server.js; else node server.js; fi"]
