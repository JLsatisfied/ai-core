import{_ as n,H as a,f as p,i}from"./chunks/framework.B9XaR4fg.js";const k=JSON.parse('{"title":"项目概述","description":"","frontmatter":{},"headers":[],"relativePath":"guide/intro.md","filePath":"guide/intro.md"}'),e={name:"guide/intro.md"};function l(t,s,c,r,o,h){return a(),p("div",null,[...s[0]||(s[0]=[i(`<h1 id="项目概述" tabindex="-1">项目概述 <a class="header-anchor" href="#项目概述" aria-label="Permalink to &quot;项目概述&quot;">​</a></h1><p><strong>冒险纪元</strong> (未来智匠 / Wise Forge) 是一个基于 Vue 3 + TypeScript 的全栈 AI 对话平台前端项目。</p><h2 id="核心能力" tabindex="-1">核心能力 <a class="header-anchor" href="#核心能力" aria-label="Permalink to &quot;核心能力&quot;">​</a></h2><ul><li><strong>多模型 AI 对话</strong>：支持 DeepSeek-V3 (快速/深度思考双模式) 和讯飞星火 Spark Pro 两种大模型</li><li><strong>SSE 流式输出</strong>：实时打字机效果，支持中断和重连，两套独立的流式处理逻辑</li><li><strong>深度思考</strong>：展示模型推理过程 (reasoning_content)，透明化 AI 思考链路，三种思考状态</li><li><strong>Markdown 渲染</strong>：Web Worker 后台渲染，消息队列模式，不阻塞主线程交互</li><li><strong>完整认证</strong>：RSA 公钥加密 + SVG 图形验证码 + 30 天免登录 + Token 持久化</li><li><strong>AI 角色模板</strong>：预设角色模板系统，分页浏览，一键创建 AI 助手分类</li><li><strong>客服小部件</strong>：可配置的可嵌入聊天组件，6 种预设主题色，移动端实时预览</li><li><strong>RPG 文字冒险</strong>：AI 作为 DM 游戏主持人，D20 骰子、HP/MP 系统、背包管理</li><li><strong>语音合成 (TTS)</strong>：浏览器内置 Web Speech API 朗读 AI 回复</li><li><strong>PDF 文件对话</strong>：上传 PDF 文件，后端提取文本后作为对话上下文</li></ul><h2 id="项目结构" tabindex="-1">项目结构 <a class="header-anchor" href="#项目结构" aria-label="Permalink to &quot;项目结构&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>wise-forge/</span></span>
<span class="line"><span>├── public/                     # 静态资源 (favicon, 图片等)</span></span>
<span class="line"><span>├── src/</span></span>
<span class="line"><span>│   ├── api/                    # API 层</span></span>
<span class="line"><span>│   │   ├── user.ts             # 用户认证 (登录/注册/密码修改/RSA公钥/验证码)</span></span>
<span class="line"><span>│   │   └── aicg.ts             # AI 对话 (会话CRUD/分类/模板/图片生成/文件上传/客服)</span></span>
<span class="line"><span>│   ├── assets/</span></span>
<span class="line"><span>│   │   └── font/               # 像素字体 (DottedSongtiCircle)</span></span>
<span class="line"><span>│   ├── components/             # 全局公共组件</span></span>
<span class="line"><span>│   │   ├── ContextMenu.vue     # 右键菜单</span></span>
<span class="line"><span>│   │   └── SkeletonLoader.vue  # 骨架屏加载器 (5种变体)</span></span>
<span class="line"><span>│   ├── composables/            # 组合式函数</span></span>
<span class="line"><span>│   │   ├── useFileUpload.ts    # 文件/头像上传</span></span>
<span class="line"><span>│   │   ├── useSpeech.ts        # 语音合成 (Web Speech API)</span></span>
<span class="line"><span>│   │   └── useContextMenu.ts   # 右键菜单逻辑</span></span>
<span class="line"><span>│   ├── plugins/                # Vite 自定义插件</span></span>
<span class="line"><span>│   ├── router/</span></span>
<span class="line"><span>│   │   └── index.ts            # Vue Router 4 + 路由守卫 + NProgress</span></span>
<span class="line"><span>│   ├── store/</span></span>
<span class="line"><span>│   │   └── index.ts            # Pinia 状态管理 (token/freeEntry)</span></span>
<span class="line"><span>│   ├── styles/                 # 全局样式</span></span>
<span class="line"><span>│   │   ├── _pixel-theme.scss   # 像素主题变量 &amp; mixins</span></span>
<span class="line"><span>│   │   └── pixel-utilities.scss# 共享工具类</span></span>
<span class="line"><span>│   ├── utils/</span></span>
<span class="line"><span>│   │   ├── http/</span></span>
<span class="line"><span>│   │   │   ├── axios.ts        # Axios 实例 + 拦截器 (Token自动附加/401跳转)</span></span>
<span class="line"><span>│   │   │   └── config.ts       # HTTP 配置 (BASE_URL)</span></span>
<span class="line"><span>│   │   └── types/</span></span>
<span class="line"><span>│   │       └── ai.ts           # 完整 TypeScript 类型定义</span></span>
<span class="line"><span>│   ├── view/</span></span>
<span class="line"><span>│   │   ├── home/               # 首页（登录/注册—4种模式）</span></span>
<span class="line"><span>│   │   │   ├── index.vue</span></span>
<span class="line"><span>│   │   │   └── images/         # 首页图片资源</span></span>
<span class="line"><span>│   │   ├── intelligence/       # AI 对话页 (核心)</span></span>
<span class="line"><span>│   │   │   ├── index.vue       # 主组件 (1300+ 行编排逻辑)</span></span>
<span class="line"><span>│   │   │   ├── worker.js       # Web Worker Markdown 渲染</span></span>
<span class="line"><span>│   │   │   └── components/     # 6 个子组件</span></span>
<span class="line"><span>│   │   │       ├── SideBar.vue         # 侧边栏 (分类/删除)</span></span>
<span class="line"><span>│   │   │       ├── NavBar.vue          # 顶栏 (模型切换/用户菜单)</span></span>
<span class="line"><span>│   │   │       ├── ChatInput.vue       # 输入区 (文件/导出/清除/深思)</span></span>
<span class="line"><span>│   │   │       ├── ChatMessageItem.vue # 消息气泡 (复制/编辑/朗读/折叠)</span></span>
<span class="line"><span>│   │   │       ├── TemplateDialog.vue  # 模板选择弹窗 (分页)</span></span>
<span class="line"><span>│   │   │       └── UserProfileModal.vue# 用户信息弹窗 (昵称/头像)</span></span>
<span class="line"><span>│   │   ├── adventure/          # RPG 文字冒险页</span></span>
<span class="line"><span>│   │   │   ├── index.vue       # 主组件 (DM Prompt/选项解析/状态解析)</span></span>
<span class="line"><span>│   │   │   ├── composables/</span></span>
<span class="line"><span>│   │   │   │   └── useAdventureState.ts  # 冒险状态管理 (HP/MP/背包/D20)</span></span>
<span class="line"><span>│   │   │   ├── data/</span></span>
<span class="line"><span>│   │   │   │   └── adventureScenes.ts    # 3个预设冒险场景</span></span>
<span class="line"><span>│   │   │   └── components/     # 4 个子组件</span></span>
<span class="line"><span>│   │   │       ├── AdventureHUD.vue      # 左侧状态面板 (HP/MP/背包)</span></span>
<span class="line"><span>│   │   │       ├── AdventureMessage.vue  # 消息渲染</span></span>
<span class="line"><span>│   │   │       ├── AdventureInput.vue    # 快捷动作按钮</span></span>
<span class="line"><span>│   │   │       └── SceneSelectDialog.vue # 场景选择弹窗</span></span>
<span class="line"><span>│   │   ├── customer-service/   # AI 客服配置页面</span></span>
<span class="line"><span>│   │   │   └── index.vue       # 配置面板 + 预览 + 嵌入代码生成</span></span>
<span class="line"><span>│   │   └── error/              # 404 页面</span></span>
<span class="line"><span>│   │       └── 404.vue</span></span>
<span class="line"><span>│   ├── App.vue                 # 根组件</span></span>
<span class="line"><span>│   ├── main.ts                 # 入口文件</span></span>
<span class="line"><span>│   └── style.css               # 全局基础样式</span></span>
<span class="line"><span>├── .env.development            # 开发环境变量</span></span>
<span class="line"><span>├── commitlint.config.js        # Commit 规范 (Conventional Commits)</span></span>
<span class="line"><span>├── eslint.config.js            # ESLint 配置 (Flat Config)</span></span>
<span class="line"><span>├── stylelint.config.js         # Stylelint 配置</span></span>
<span class="line"><span>├── .prettierrc                 # Prettier 配置</span></span>
<span class="line"><span>├── .husky/                     # Git Hooks</span></span>
<span class="line"><span>│   ├── commit-msg              # Commit 信息校验</span></span>
<span class="line"><span>│   └── pre-commit              # lint-staged 格式检查</span></span>
<span class="line"><span>├── .lintstagedrc               # lint-staged 配置</span></span>
<span class="line"><span>├── tsconfig.json               # TypeScript 配置</span></span>
<span class="line"><span>└── vite.config.ts              # Vite 配置 (代理/分包/构建优化)</span></span></code></pre></div><h2 id="启动方式" tabindex="-1">启动方式 <a class="header-anchor" href="#启动方式" aria-label="Permalink to &quot;启动方式&quot;">​</a></h2><h3 id="环境要求" tabindex="-1">环境要求 <a class="header-anchor" href="#环境要求" aria-label="Permalink to &quot;环境要求&quot;">​</a></h3><ul><li>Node.js &gt;= 18</li><li>npm &gt;= 9</li></ul><h3 id="安装-运行" tabindex="-1">安装 &amp; 运行 <a class="header-anchor" href="#安装-运行" aria-label="Permalink to &quot;安装 &amp; 运行&quot;">​</a></h3><div class="language-bash vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 安装依赖</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> install</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 开发模式 (默认 http://localhost:5173)</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> run</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> dev</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 构建生产</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> run</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> build</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 预览构建结果</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> run</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> preview</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 构建分析 (ANALYZE=true)</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> run</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> build:analyze</span></span></code></pre></div><h3 id="代码质量" tabindex="-1">代码质量 <a class="header-anchor" href="#代码质量" aria-label="Permalink to &quot;代码质量&quot;">​</a></h3><div class="language-bash vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Prettier 格式化</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> run</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> format</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 检查格式</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> run</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> format:check</span></span></code></pre></div>`,13)])])}const g=n(e,[["render",l]]);export{k as __pageData,g as default};
