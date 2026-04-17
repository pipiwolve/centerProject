# 奢侈品牌材质术语映射卡：官方命名到基础材质的归类

## 资料定位

这是一份为云 RAG 准备的术语映射卡，用来把品牌自己的材质命名路由到更通用的护理类别，减少“看得懂产品页，但接不上护理逻辑”的断层。

## Louis Vuitton

### Natural Leather / Natural Cowhide / Vegetable-Tanned Cowhide

- 路由到：植鞣革 / 本色皮 / vachetta
- 典型问题：包浆、遇水变深、水痕、易刮伤
- 关联知识：
  - `15-vegetable-tanned-handle-darkening-patina.md`
  - `16-vegetable-tanned-water-stain-wet-darkening.md`

### Vernis Leather

- 路由到：漆皮 / patent leather
- 典型问题：染色、黄变、失去镜面感
- 关联知识：
  - `19-patent-leather-color-transfer.md`
  - `26-patent-leather-yellowing-aging.md`

### Monogram Canvas / Damier Canvas

- 路由到：涂层帆布 / coated canvas
- 典型问题：表层脏污、靠近皮边清洁、印花保护
- 关联知识：
  - `21-coated-canvas-cleaning-near-trim.md`

## Coach

### Glovetanned / Glovetanned Pebble

- 路由到：柔软光面或压纹成革
- 典型问题：表面痕、失光、需要正确 cleaner / moisturizer 兼容
- 说明：Coach 官方把 glovetanned 列入其 leather cleaner 可用范围。

### Natural Calf

- 路由到：浅色天然皮 / natural calf
- 典型问题：更接近天然浅色成革，需要保守处理
- 关联知识：
  - `17-smooth-light-leather-color-transfer.md`
  - `41-send-repair-threshold-natural-light-leather.md`

### Signature Coated Canvas

- 路由到：涂层帆布 / coated canvas
- 典型问题：表面脏污与边皮分区清洁
- 关联知识：
  - `21-coated-canvas-cleaning-near-trim.md`

### Refined Calf / Smooth Calf / Soft Calf / Polished Pebble

- 路由到：光面或轻压纹成革
- 典型问题：表层染色、轻污、失光、finish 边界
- 关联知识：
  - `17-smooth-light-leather-color-transfer.md`
  - `32-cleaner-conditioner-compatibility-matrix.md`

## CHANEL

### Lambskin

- 路由到：小羊皮
- 典型问题：轻痕、链条压痕、色迁移、表面极敏感
- 关联知识：
  - `18-lambskin-surface-marks.md`
  - `25-chain-pressure-marks-delicate-leather.md`

### Patent Leather

- 路由到：漆皮
- 典型问题：色迁移、finish 高风险
- 关联知识：
  - `19-patent-leather-color-transfer.md`
  - `26-patent-leather-yellowing-aging.md`

### Suede / Nubuck

- 路由到：翻毛皮 / nubuck
- 典型问题：液体敏感、链条压痕敏感、颜色迁移
- 关联知识：
  - `20-suede-watermark-oil-routing.md`
  - `25-chain-pressure-marks-delicate-leather.md`

## LOEWE

### Classic Calfskin

- 路由到：光面牛皮 / classic calf
- 常见风险：表层轻污、色迁移、finish 管理

### Soft Grained Calfskin / Supple Grained Calfskin / Fine Grained Calfskin

- 路由到：颗粒或软粒面牛皮
- 常见风险：形态软化、边角磨损、轻污与失光

### Suede

- 路由到：翻毛皮 / 绒面革
- 常见风险：液体、油污、链条压痕

## 使用规则

1. 品牌术语优先映射到“基础材质类别”，再进入场景卡。
2. 一旦映射到 patent / suede / natural leather，就自动提高风险等级。
3. 如果一个产品同时写了 `canvas + leather trim` 或 `calfskin and suede`，检索时要保留复合材质信息，不能只抓第一项。

## 参考依据

- Louis Vuitton, Leather Goods Product Care  
  https://us.louisvuitton.com/eng-us/faq/services/leather-goods-product-care

- Coach, Product Care Set  
  https://www.coach.com/products/coach-product-care-set/225.html

- Coach, Product Care  
  https://www.coach.com/support/product-care

- CHANEL, Bags Care Instructions  
  https://www.chanel.com/us/fashion/care-instructions/bags//

- LOEWE official product pages  
  https://www.loewe.com/usa/en/women/amazona-31-cropped-bag-in-classic-calfskin/A039N31X05-0120.html  
  https://www.loewe.com/usa/en/women/bags/amazona/amazona-23-bag-in-soft-grained-calfskin/A039N07X02-9567.html  
  https://www.loewe.com/usa/en/women/bags/small-puzzle-bag-in-classic-calfskin-and-suede/A510S21XCF-1100.html
