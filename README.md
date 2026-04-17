# 皮具护理助手 / Leather Care RAG Assistant

一个面向皮具清洁、养护与送修判断的 RAG 毕设项目。系统把用户的自然语言问题整理为可执行的护理建议，并尽量展示百炼应用返回的真实命中依据，适合用于课程展示、方案答辩和后续产品化迭代。

## 项目定位

这个仓库不是一个“本地向量库 Demo”，而是一套完整的前后端产品原型：

- 前端使用 Next.js 搭建护理对话工作台、知识库状态页和评测页
- 后端使用 Flask 负责问答编排、百炼应用调用、来源解析和离线流水线
- 在线问答的检索真相来自阿里云百炼应用，而不是本地 manifests
- 本地知识库流水线仍然保留，用于资料整理、离线产物生成、评测和论文材料输出

## 核心能力

| 模块 | 能力 |
| --- | --- |
| 护理对话 | 将问题整理为 `适用判断 / 所需工具 / 操作步骤 / 注意事项 / 何时送修 / 参考来源` 六段式结果 |
| 来源展示 | 展示百炼返回的 `doc_references`、召回切片与紧凑来源信息 |
| 知识库工作台 | 查看 App ID、知识库 ID、运行模式、部署状态和来源说明 |
| 评测工作台 | 运行测试集并输出平均得分、关键词命中和来源情况 |
| 离线流水线 | 清洗 `knowledge/raw/` 资料，生成 chunks、FAQ、评测集和百炼导入清单 |

## 系统架构

```text
用户问题
  ↓
Next.js 前端（/）
  ↓  POST /api/chat
Flask 后端
  ↓
阿里云百炼应用（BAILIAN_APP_ID）
  ↓
百炼知识库 / 应用内检索
  ↓
返回回答、doc_references、thoughts
  ↓
后端整理为结构化 sections + sources
  ↓
前端展示护理建议与命中来源
```

离线资料处理链路：

```text
knowledge/raw/*
  ↓
python manage.py ingest
  ↓
knowledge/generated/manifests/*
  ↓
百炼导入清单 / FAQ / 评测集 / 论文材料
```

## 技术栈

- 前端：Next.js 16、React 19、Tailwind CSS 4
- 后端：Flask 3
- 模型与检索：阿里云百炼应用 `dashscope.Application.call`
- 部署：Vercel Services（前后端同仓部署）
- 数据产物：JSONL manifests、Markdown checklist、FAQ、评测集

## 页面说明

- `/`
  护理对话工作台，面向最终用户提问与结果展示
- `/knowledge`
  知识库工作台，展示应用配置、运行模式和来源状态
- `/eval`
  评测工作台，运行测试集并查看评分结果

## 目录结构

```text
.
├── frontend/                     # Next.js 前端
├── backend/                      # Flask 后端
│   ├── app/
│   ├── tests/
│   └── manage.py
├── knowledge/
│   ├── raw/                      # 原始知识资料
│   ├── processed/                # 清洗与切分中间产物
│   └── generated/                # chunks / faq / eval / manifests
├── QA_dataset/                   # 种子问答资料
├── design-system/                # 设计系统文档
├── scripts/                      # 一键初始化、ingest、演示脚本
├── vercel.json                   # Vercel Services 配置
└── README.md
```

## 运行模式说明

### 在线模式

- 前端请求 Flask `/api/chat`
- Flask 直接调用百炼应用
- 页面展示的来源依据以百炼应用返回的结果为准

### 离线模式

- `python manage.py ingest` 处理本地资料
- 生成 chunk / FAQ / eval / checklist
- 这些产物用于评测、数据准备、论文材料和百炼导入辅助

一句话概括：

> 线上问答看百炼，离线产物看本地流水线。

## 快速开始

### 1. 环境要求

- Python 3
- Node.js 20+
- npm

### 2. 初始化依赖

```bash
./scripts/bootstrap.sh
```

这个脚本会完成：

- 创建 `.venv`
- 安装 `backend/requirements.txt`
- 安装 `frontend/` 依赖
- 若根目录没有 `.env`，自动从 `.env.example` 复制

### 3. 配置环境变量

```bash
cp .env.example .env
```

推荐至少填写下列变量：

| 变量 | 本地开发 | Vercel 部署 | 说明 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | 可选 | 不要设置 | 本地前端访问后端地址，生产环境默认走同域 `/api` |
| `DASHSCOPE_API_KEY` | 必填 | 必填 | 百炼 / DashScope API Key |
| `BAILIAN_APP_ID` | 必填 | 必填 | 百炼应用 App ID |
| `DASHSCOPE_MODEL_NAME` | 可选 | 可选 | 默认 `qwen-plus` |
| `DASHSCOPE_BASE_URL` | 可选 | 可选 | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `DASHSCOPE_WORKSPACE_ID` | 可选 | 可选 | 百炼 Workspace ID |
| `BAILIAN_DOCS_KB_ID` | 建议填写 | 建议填写 | 文档知识库 ID |
| `BAILIAN_FAQ_KB_ID` | 可选 | 可选 | FAQ 知识库 ID |
| `ENABLE_CLOUD_SYNC` | 可选 | 可选 | 默认 `false` |
| `BACKEND_HOST` | 可选 | 不需要 | 本地 Flask Host，默认 `127.0.0.1` |
| `BACKEND_PORT` | 可选 | 不需要 | 本地 Flask Port，默认 `8000` |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | 仅同步云端时 | 仅同步云端时 | 云端同步相关 |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 仅同步云端时 | 仅同步云端时 | 云端同步相关 |

安全提醒：

- 不要把真实 Key 提交到仓库
- 如果任何 Key 曾经暴露，请先在阿里云控制台作废并重新生成

### 4. 生成知识库离线产物并尝试同步百炼

```bash
./scripts/ingest.sh
```

或直接运行：

```bash
cd backend
../.venv/bin/python manage.py ingest --sync-cloud
```

生成结果包括：

- `knowledge/generated/manifests/chunks.jsonl`
- `knowledge/generated/manifests/faq.jsonl`
- `knowledge/generated/manifests/eval.jsonl`
- `knowledge/generated/manifests/ingest-report.json`
- `knowledge/generated/manifests/bailian-sync.json`
- `knowledge/generated/manifests/bailian-import-checklist.md`

说明：

- `./scripts/ingest.sh` 现在默认会同时尝试云端同步
- 若 `.env` 中未开启 `ENABLE_CLOUD_SYNC=true`，脚本会正常生成本地产物，并在 `bailian-sync.json` 里标记 `skipped`
- 若要完全跳过云端同步，可执行 `./scripts/ingest.sh --local-only`
- 若已开启云端同步但缺少阿里云凭证或 Workspace，脚本会在 `bailian-sync.json` 里标记 `blocked`

### 5. 启动本地后端

```bash
./scripts/run_demo.sh
```

说明：

- 该脚本会先执行一次 `ingest`
- 且默认尝试同步百炼知识库
- 再启动 Flask 服务
- 默认监听 `http://127.0.0.1:8000`

也可以手动运行：

```bash
cd backend
../.venv/bin/python manage.py serve
```

### 6. 启动前端

```bash
cd frontend
npm run dev
```

默认地址：

- 前端：`http://localhost:3000`
- 后端：`http://127.0.0.1:8000`

## 常用命令

```bash
# 初始化
./scripts/bootstrap.sh

# 生成知识库产物，并尝试同步百炼
./scripts/ingest.sh

# 仅生成本地产物，不做云端同步
./scripts/ingest.sh --local-only

# 启动本地演示（先 ingest 再启动后端）
./scripts/run_demo.sh

# 后端测试
cd backend && ../.venv/bin/pytest -q

# 前端检查
cd frontend && npm run lint

# 前端构建
cd frontend && npm run build

# 运行评测
cd backend && ../.venv/bin/python manage.py eval
```

## 百炼应用配置建议

为了让来源抽屉正常显示，请确保百炼应用侧满足以下条件：

1. `BAILIAN_APP_ID` 指向的就是当前线上实际调用的那个应用
2. 应用已经绑定正确的知识库
3. 已开启“展示回答来源”
4. 修改配置后已经重新发布应用

建议：

- 优先把 `knowledge/raw/` 下的 Markdown 文档逐个上传到百炼，便于查看命中文档
- 不建议把全部资料合并成一个超大 bundle 作为唯一导入文件，否则来源展示可读性会下降

## API 概览

### `GET /api/health`

返回运行状态、部署目标、知识库 ID、App ID 等健康信息。

### `GET /api/sources`

返回当前来源模式摘要。在线部署时会说明系统已切换为百炼应用直连。

### `POST /api/chat`

请求示例：

```json
{
  "query": "植鞣革手柄发黑了怎么清理？",
  "session_id": "optional-session-id",
  "debug": true
}
```

返回核心字段：

- `answer`
- `sections`
- `sources`
- `retrieval_trace`
- `latency_ms`

### `POST /api/eval/run`

运行评测集并返回评分报告。

### `POST /api/ingest/run` / `GET /api/ingest/status`

- 本地可通过命令行执行 `ingest`
- Vercel 线上为只读运行时，这两个接口会返回停用说明

## Vercel 全栈部署

本项目使用根目录的 `vercel.json` 以 Services 方式部署：

- `frontend` 服务挂载到 `/`
- `backend` 服务挂载到 `/api`

### 部署前准备

1. 本地执行 `./scripts/ingest.sh`
2. 将 `knowledge/generated/manifests/` 一并提交到仓库

原因：

- Vercel 运行时是只读的
- 线上不会动态重建本地知识库产物
- 评测、状态展示和辅助产物仍依赖这些文件

### 推荐部署步骤

1. 将整个仓库导入 Vercel
2. 使用仓库根目录，不要单独设置 Root Directory
3. 如果账号已开通 Services，按 `vercel.json` 进行前后端联合部署
4. 配置环境变量：

```bash
DASHSCOPE_API_KEY=<your-key>
BAILIAN_APP_ID=<your-app-id>
DASHSCOPE_MODEL_NAME=qwen-plus
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_WORKSPACE_ID=<optional-workspace-id>
BAILIAN_DOCS_KB_ID=<your-docs-kb-id>
BAILIAN_FAQ_KB_ID=<optional-faq-kb-id>
ENABLE_CLOUD_SYNC=false
```

注意：

- 不要在 Vercel 上设置 `NEXT_PUBLIC_API_BASE_URL`
- 生产环境前端默认会走同域 `/api`

### 如果账号没有 Services 能力

可退回到双端分离模式：

- 前端部署到 Vercel
- 后端单独部署到其他可运行 Flask 的环境
- 此时再显式配置 `NEXT_PUBLIC_API_BASE_URL`

## 验证清单

建议在提交或答辩前完成以下检查：

- `cd backend && ../.venv/bin/pytest -q`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- 打开 `/api/health`，确认 `retrieval_mode=bailian_app`
- 对话页提问一次，确认能返回结构化护理建议
- 若开启来源展示，确认右侧“百炼命中来源”能看到紧凑来源信息而不是原始长链接

## 常见问题

### 1. 回答里明显用了知识库内容，但来源抽屉是空的

优先检查：

- 百炼应用是否开启“展示回答来源”
- 开启后是否重新发布
- Vercel 环境变量里的 `BAILIAN_APP_ID` 是否和控制台里修改的是同一个应用
- 是否已经部署到最新后端代码

### 2. 页面被超长来源文本挤压变形

最新版本已经对来源摘要做了紧凑化处理，并对卡片增加了断行与溢出保护。如果线上仍出现该问题，通常说明部署还停留在旧版本。

### 3. `/api/chat` 返回 `InvalidApiKey`

说明 `DASHSCOPE_API_KEY` 无效、已过期或填错环境。请在阿里云控制台重新生成并更新部署环境变量。

### 4. `POST /api/ingest/run` 在线返回 409

这是预期行为。Vercel 线上使用百炼应用直连，运行时不会重建本地 manifests。
请改为在本地执行 `./scripts/ingest.sh`。该脚本会默认同时尝试同步百炼，并生成页面展示依赖的 manifests。

## 当前仓库适合什么场景

- 毕业设计演示
- RAG 产品原型
- 百炼应用 + Web 工作台整合示例
- 皮具护理知识库问答场景

如果你希望继续演进，它也适合作为以下方向的起点：

- 多轮会话记忆
- 更严格的来源引用样式
- 图片辅助诊断
- 品牌 / 材质 / 部件级路由细化
- 管理后台与资料维护流程

## 备注

- 项目已经切换为“百炼应用直连”路线，线上来源展示以百炼返回为准
- 离线流水线仍然保留，因为它对资料维护、评测和论文展示都很有价值
- `.codex/skills/ui-ux-pro-max/` 用于本项目的 UI/UX 迭代辅助，但不参与线上业务逻辑
