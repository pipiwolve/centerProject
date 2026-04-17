# Leather Care RAG Assistant

一套为毕业设计准备的皮具养护 RAG 系统，当前已经收敛为：

- `frontend/`: Next.js App Router 前端，作为 Vercel 主站点
- `backend/`: Flask 后端，作为同一个 Vercel 项目里的 `/api` 服务
- `knowledge/`: 原始资料、离线处理产物、FAQ/评测生成产物
- `.codex/skills/ui-ux-pro-max/`: 保留的 UI/UX 设计 skill

## 技术路线

- 前端：Next.js 16 + Tailwind 4
- 后端：Flask 3
- 在线问答：`Next.js -> Flask -> 百炼应用(AppId)`
- 模型与检索：阿里云百炼应用 `dashscope.Application.call`
- 来源抽屉：展示百炼返回的 `doc_references` 与 `thoughts/observation`
- 云端知识库：百炼知识库 `zwb68dlfs9`
- 部署：Vercel Services，一次部署前后端

## 已实现功能

- 对话工作台：固定 6 段式输出，展示百炼真实命中来源
- 知识库工作台：展示 App ID、知识库 ID、云端模式与运行时状态
- 评测工作台：批量运行测试集并输出评分
- 离线知识库流水线：
  - 读取 `knowledge/raw/` 下的 `md/txt/docx/pdf`
  - 清洗与切分
  - 元数据标注
  - FAQ 自动补全
  - 评测集自动生成
  - 导出离线 manifests 与百炼导入清单

说明：离线 `ingest` 仍然保留给资料整理和论文材料使用，但线上问答的唯一检索真相已经切到百炼应用。

## 本地开发

1. 初始化依赖：

```bash
./scripts/bootstrap.sh
```

2. 复制并填写环境变量：

```bash
cp .env.example .env
```

本地最少需要：

- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`
- `DASHSCOPE_API_KEY=<你的新 Key>`
- `BAILIAN_APP_ID=<你的百炼应用 AppId>`
- `BAILIAN_DOCS_KB_ID=zwb68dlfs9`

如果你之前暴露过 DashScope API Key，请先在阿里云控制台作废并重新生成。

3. 生成知识库产物：

```bash
./scripts/ingest.sh
```

执行后会生成：

- `knowledge/generated/manifests/chunks.jsonl`
- `knowledge/generated/manifests/faq.jsonl`
- `knowledge/generated/manifests/eval.jsonl`
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

## 百炼知识库与应用

- 目标知识库 ID：`zwb68dlfs9`
- 在线运行必须提供 `BAILIAN_APP_ID`
- 该 App 需要提前绑定当前皮具知识库
- 来源抽屉依赖百炼应用返回的 `doc_references` 与召回切片
- `knowledge/raw/` 下的 Markdown 仍建议逐个上传到百炼控制台，方便论文展示文档数量与命中来源

不建议把 `knowledge/generated/docs_kb_bundle.md` 当成主上传文件，因为那会把展示效果压缩成单一大文档。

## Vercel 全栈部署

当前仓库已经改为 Vercel Services 结构，根目录下的 [vercel.json](/Users/Zhuanz/Documents/antigravitProject/center毕设/vercel.json) 会同时部署：

- `frontend` 服务：`/`
- `backend` 服务：`/api`

部署前先做两件事：

1. 先在本地执行 `./scripts/ingest.sh`
2. 把 `knowledge/generated/manifests/` 一并提交并推送到 GitHub

原因：Vercel 运行时是只读的，部署后的 `/api/ingest/run` 会被自动关闭；离线产物仍保留给资料准备和评测使用。

### Vercel 操作步骤

1. 直接导入整个仓库，不再设置 `Root Directory`
2. 在 Project Settings 里把 Framework Preset 设为 `Services`
3. 配置环境变量：

```bash
DASHSCOPE_API_KEY=<你的新 Key>
BAILIAN_APP_ID=<你的百炼应用 AppId>
DASHSCOPE_MODEL_NAME=qwen-plus
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_DOCS_KB_ID=zwb68dlfs9
ENABLE_CLOUD_SYNC=false
```

不要在 Vercel 上设置：

- `NEXT_PUBLIC_API_BASE_URL`

原因：Vercel Services 会自动注入 `NEXT_PUBLIC_BACKEND_URL=/api`，前端已经做了兼容处理。

### 部署后行为

- 前端会自动通过同域 `/api` 访问 Flask 后端
- `/api/health` 会返回 `retrieval_mode=bailian_app`、`source_backend=bailian`、`bailian_app_id`
- `/api/chat` 会直接请求百炼应用，并把来源抽屉映射成“引用 + 切片”
- `/api/sources` 会返回云端状态摘要，而不是本地 chunk/faq 统计
- `/api/ingest/run` 与 `/api/ingest/status` 在 Vercel 上会返回停用说明

### 如果 Vercel 后台没有 Services 选项

当前官方 Services 仍可能需要账号侧开通。如果你的项目设置里看不到 `Services` 这个 Framework Preset，需要先在 Vercel 侧开通该能力；否则只能暂时退回“前端部署到 Vercel，后端本地运行”的模式。

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
- `backend`: `python manage.py ingest` 可生成 chunk / FAQ / eval manifests
- `backend`: `/api/health`、`/api/sources`、`/api/chat` 云端模式测试通过
- `frontend`: `npm run build` 通过

## 备注

- `ui-ux-pro-max-skill` 原仓库不是标准 Codex `SKILL.md` 安装结构，本项目改为使用其官方 CLI 安装方式保留到 `.codex/skills/ui-ux-pro-max/`
- 当前运行链路已经切换为“百炼应用直连”，不再以本地 manifests 作为线上来源抽屉真相
