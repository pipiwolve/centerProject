# 百炼知识库导入清单

- 目标知识库 ID: zwb68dlfs9
- 运行时检索模式: 本地 LangChain 检索
- 百炼角色: 云端知识库归档与答辩展示
- 上传策略: 手动上传独立 Markdown 文件
- 建议上传数量: 14
- 不建议上传的合并包: knowledge/generated/docs_kb_bundle.md

## 上传步骤

1. 打开百炼控制台中的目标知识库。
2. 逐个上传下列独立 Markdown 文件。
3. 不要使用 docs_kb_bundle.md 作为主知识库文件。
4. 上传完成后，确认云端文档数与下列清单一致。

## 推荐上传文件

- knowledge/raw/01-vegetable-tanned-care.md | 植鞣革的基础清洁与补脂
- knowledge/raw/02-suede-and-patent.md | 翻毛皮与漆皮的养护边界
- knowledge/raw/03-hardware-edge-paint.md | 五金、边油与肩带边缘维护
- knowledge/raw/04-storage-and-mold.md | 收纳、防潮与霉变处理
- knowledge/raw/05-rain-damage-and-hardening.md | 淋雨、返潮与皮面发硬干裂处理指南
- knowledge/raw/06-lambskin-scratch-care.md | 小羊皮与 Nappa 皮轻微划痕护理指南
- knowledge/raw/07-togo-shape-recovery.md | Togo 与软质包体塌陷、变形恢复指南
- knowledge/raw/08-coated-canvas-cleaning.md | 涂层帆布、老花帆布与织物拼接包清洁指南
- knowledge/raw/09-nylon-corner-repair.md | 尼龙包四角磨损、破洞与拉链边受损处理指南
- knowledge/raw/10-top-grain-recoloring.md | 头层牛皮轻微掉色、磨损与补色前判断指南
- knowledge/raw/11-material-identification-guide.md | 常见皮具材质识别与护理差异速查
- knowledge/raw/12-toolkit-and-chemical-safety.md | 皮具护理工具与化学品安全使用清单
- knowledge/raw/13-storage-humidity-and-seasonal-care.md | 收纳、防潮与季节性养护规则
- knowledge/raw/14-home-care-vs-professional-repair.md | 家庭护理与专业送修的边界判断

## 说明

- FAQ 合并包保留为本地检索和论文展示材料。
- 若目标知识库 ID 未配置，可先在 .env 中填写 BAILIAN_DOCS_KB_ID 后重新 ingest。