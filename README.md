# Leather Care RAG Assistant

一套为毕业设计准备的“一步到位”实现：

- `frontend/`: Next.js App Router 前端，适合直接部署到 Vercel
- `backend/`: Flask + LangChain 本地后端
- `knowledge/`: 原始资料、处理中间产物、FAQ/评测生成产物
- `.codex/skills/ui-ux-pro-max/`: 已通过 `uipro init --ai codex` 保留的 UI/UX 设计 skill

## 技术路线

- 前端：Next.js 16 + Tailwind 4
- 后端：Flask 3
- RAG 编排：LangChain Runnable 路线
- 模型：阿里云百炼 `ChatTongyi`，未配置密钥时自动回退到本地规则生成
- 知识库：本地 FAQ + 文档切片双层检索，百炼知识库用于云端归档和答辩展示

## 已实现功能

- 对话工作台：固定 6 段式输出，展示来源抽屉与检索分析
- 知识库工作台：重新 ingest、查看资料规模、百炼知识库 ID 和手动导入规则
- 评测工作台：批量运行测试集并输出评分
- 自动知识库流水线：
  - 读取 `knowledge/raw/` 下的 `md/txt/docx/pdf`
  - 清洗与切分
  - 元数据标注
  - FAQ 自动补全
  - 评测集自动生成
  - 导出本地 manifest 与百炼导入清单
  - 可选百炼同步

## 快速开始

1. 初始化依赖：

```bash
./scripts/bootstrap.sh
```

2. 复制并填写环境变量：

```bash
cp .env.example .env
```

先处理安全项：

- 如果你之前暴露过 DashScope API Key，请先在阿里云控制台作废并重新生成。

v1 最少需要：

- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`
- `DASHSCOPE_API_KEY=<你的新 Key>`
- `BAILIAN_DOCS_KB_ID=zwb68dlfs9`

模型相关：

- `DASHSCOPE_MODEL_NAME=qwen-plus`

如果你要启用自动同步百炼知识库，还要配置：

- `ENABLE_CLOUD_SYNC=true`
- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- `DASHSCOPE_WORKSPACE_ID`
- 可选已有知识库 ID：`BAILIAN_DOCS_KB_ID`、`BAILIAN_FAQ_KB_ID`

3. 生成知识库产物：

```bash
./scripts/ingest.sh
```

执行后会额外生成：

- `knowledge/generated/manifests/ingest-report.json`
- `knowledge/generated/manifests/bailian-import-checklist.md`

4. 启动本地后端：

```bash
./scripts/run_demo.sh
```

5. 本地开发前端：

```bash
cd frontend
npm run dev
```

## 百炼知识库导入

- 目标知识库 ID：`zwb68dlfs9`
- 上传目录：`knowledge/raw/`
- 上传方式：逐个上传 `01-14` 的 14 个独立 Markdown 文件
- 不要上传：`knowledge/generated/docs_kb_bundle.md`

原因：v1 在线问答走本地 LangChain 检索，百炼侧仅承担云端知识库归档与答辩展示。如果上传合并包，百炼只会看到 1 个大文档，不利于展示知识库文档规模。

## Vercel 部署前端

1. 在 Vercel 导入项目时，将 Root Directory 设为 `frontend`
2. 配置环境变量：

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

3. 构建命令与输出目录使用 Next.js 默认值即可

注意：当前方案默认是“同一台电脑打开 Vercel 前端并连接本地后端”的答辩模式，不是公网后端。

## 项目结构

```text
.
├── frontend
├── backend
├── knowledge
│   ├── raw
│   ├── processed
│   └── generated
├── QA_dataset
├── design-system
└── scripts
```

## 已完成验证

- `backend`: `pytest -q` 通过
- `backend`: `python manage.py ingest` 可生成 chunk / FAQ / eval manifest
- `backend`: `/api/health`、`/api/sources`、`/api/chat` 冒烟测试通过
- `frontend`: `npm run build` 通过

## 备注

- `ui-ux-pro-max-skill` 原仓库不是标准 Codex `SKILL.md` 安装结构，本项目改为使用其官方 CLI 安装方式保留到 `.codex/skills/ui-ux-pro-max/`
- 当前百炼知识库同步代码已接入 OpenAPI SDK，但只有在完整云端凭证配置后才会执行
- 当前运行链路是“本地 LangChain 检索 + 百炼模型生成”，不是 `dashscope.Application.call`
# centerProject
