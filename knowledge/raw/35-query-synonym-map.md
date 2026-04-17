# 检索同义词与品牌材质映射：面向云 RAG 的问法扩展卡

## 资料定位

这不是护理说明，而是召回增强资料。目标是让用户口语、品牌术语、英文材质名和中文常用说法能映射到正确场景卡。

## 材质同义词

### 植鞣革

- 中文常见：植鞣革、本色皮、原色皮、浅色手柄、LV 手柄皮
- 英文常见：vegetable-tanned leather、natural leather、natural cowhide、vachetta、original natural leather
- 关联文件：
  - `15-vegetable-tanned-handle-darkening-patina.md`
  - `16-vegetable-tanned-water-stain-wet-darkening.md`

### 小羊皮

- 中文常见：小羊皮、羊皮、软羊皮、细皮
- 英文常见：lambskin、nappa
- 关联文件：
  - `18-lambskin-surface-marks.md`

### 漆皮

- 中文常见：漆皮、亮皮、高光皮
- 英文常见：patent leather、vernis
- 关联文件：
  - `19-patent-leather-color-transfer.md`

### 翻毛皮 / 反绒皮

- 中文常见：翻毛皮、反绒、麂皮感、磨砂皮、绒面皮
- 英文常见：suede、nubuck、roughout
- 关联文件：
  - `20-suede-watermark-oil-routing.md`

### 涂层帆布

- 中文常见：老花帆布、涂层帆布、印花帆布、拼皮帆布
- 英文常见：coated canvas、monogram canvas、damier canvas、canvas with leather trim、jacquard
- 关联文件：
  - `21-coated-canvas-cleaning-near-trim.md`

## 症状同义词

### 发黑 / 变深

- 同义表达：发乌、盘黑、颜色吃深、手油包浆、握把发暗、氧化黑
- 优先路由：
  - 植鞣革握持区：`15`
  - 遇水后局部变深：`16`
  - 翻毛皮局部暗斑：`20`

### 染色 / 串色

- 同义表达：蹭色、掉色沾上去、牛仔染色、颜色迁移、color transfer、pigment transfer
- 优先路由：
  - 光面浅色皮：`17`
  - 漆皮：`19`
  - 帆布印花：`21`
  - 升级送修判断：`42`

### 水痕 / 潮斑

- 同义表达：碰水后变深、淋雨痕、潮印、干了还有印
- 优先路由：
  - 植鞣革：`16`
  - 通用湿包止损：`22`
  - 湿气与异味升级：`44`

### 印子 / 压痕 / 发亮

- 同义表达：压了个印、磨亮了、表面不均、链条压痕
- 优先路由：
  - 小羊皮轻痕：`18`
  - 收纳与压痕预防：`23`
  - 结构阈值：`43`

## 品牌映射

- Louis Vuitton 常见指向：
  - vachetta / natural cowhide -> `15` `16`
  - monogram canvas / damier canvas -> `21`
  - vernis -> `19`

- CHANEL 常见指向：
  - lambskin / small leather goods -> `18`
  - chain pressure / storage -> `23`
  - repair / restoring care -> `41` `42` `43`

- LOEWE 常见指向：
  - smooth calfskin / nappa lambskin -> `17` `18`
  - bags got wet / room temperature dry -> `22`

- Coach 常见指向：
  - original natural leather -> `15` `16`
  - suede / nubuck -> `20`
  - repair workshop -> `43`

- Longchamp 常见指向：
  - Le Pliage corners / zipper / handles -> `43`
  - canvas with leather trim -> `21`

## 检索增强建议

- 当问题同时出现“材质词 + 症状词 + 部位词”，优先路由到场景卡。
- 当问题出现“能不能用某产品”，优先路由到工具矩阵。
- 当问题出现“已经这样了还能自己弄吗”，优先路由到送修阈值卡。

## 参考依据

- Louis Vuitton, Leather Goods Product Care  
  https://us.louisvuitton.com/eng-us/faq/services/leather-goods-product-care

- CHANEL, Bags Care Instructions / CHANEL & moi  
  https://www.chanel.com/ee/fashion/care-instructions/bags/  
  https://www.chanel.com/al/fashion/services/chanel-et-moi/

- LOEWE, Care Guide  
  https://www.loewe.com/usa/en/care-guide-page

- Coach, Product Care / Repairs  
  https://www.coach.com/support/product-care  
  https://www.coach.com/support/repairs

- Longchamp, Repairs / Care Instructions  
  https://www.longchamp.com/us/en/after-sales-repairs-and-services/repairs/  
  https://www.longchamp.com/us/en/after-sales-repairs-and-services/care-instructions/
