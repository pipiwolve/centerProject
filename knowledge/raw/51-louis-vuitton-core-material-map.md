# Louis Vuitton 核心材质映射卡：从官方材质名到护理路线

## 资料定位

这是一张面向 Louis Vuitton 用户问法的材质翻译卡。目标是把官方材质名直接路由到正确护理路线，而不是把所有 LV 皮具都混成同一种“真皮包”。

## 使用规则

- 先识别 LV 官方材质名。
- 再映射到基础护理族群。
- 一旦命中 `natural leather / vernis / canvas + trim`，优先提高风险分流精度。

## 核心材质映射

### Natural Leather / Natural Cowhide / Vegetable-Tanned Cowhide

- 路由到：植鞣革 / 本色皮 / vachetta
- 常见场景：手柄变深、包浆、水痕、遇水变色
- 关联文件：
  - `15-vegetable-tanned-handle-darkening-patina.md`
  - `16-vegetable-tanned-water-stain-wet-darkening.md`
  - `41-send-repair-threshold-natural-light-leather.md`

### Monogram Canvas / Damier Canvas

- 路由到：涂层帆布 / coated canvas
- 常见场景：表层脏污、印花保护、与皮边交界误清洁
- 关联文件：
  - `21-coated-canvas-cleaning-near-trim.md`
  - `47-canvas-trim-cross-contamination.md`

### Monogram Empreinte Leather / Bicolor Monogram Empreinte Leather

- 路由到：压纹成革 / embossed finished leather
- 常见场景：表层色迁移、轻污、失光、避免重溶剂
- 关联文件：
  - `17-smooth-light-leather-color-transfer.md`
  - `32-cleaner-conditioner-compatibility-matrix.md`
  - `42-send-repair-threshold-color-transfer-finish.md`

### Vernis Leather

- 路由到：漆皮 / patent leather
- 常见场景：深色材料迁移、发黄、finish 高风险
- 关联文件：
  - `19-patent-leather-color-transfer.md`
  - `26-patent-leather-yellowing-aging.md`

### Epi Leather

- 路由到：压纹成革 / embossed finished leather
- 常见场景：表层轻污、色迁移、finish 保持
- 关联文件：
  - `17-smooth-light-leather-color-transfer.md`
  - `32-cleaner-conditioner-compatibility-matrix.md`

## 判断重点

1. 同样是 LV，`Natural Cowhide` 和 `Monogram Empreinte` 的清洁边界完全不同。
2. `Monogram Canvas` 不是皮革，不应该被错误路由到补脂或皮革 cleaner。
3. `Vernis` 必须和普通压纹成革分开。

## 参考依据

- Louis Vuitton, Leather Goods Product Care  
  https://us.louisvuitton.com/eng-us/faq/services/leather-goods-product-care

- Victorine Wallet, Monogram Empreinte Leather  
  https://us.louisvuitton.com/eng-us/products/victorine-wallet-monogram-empreinte-nvprod530012v/M11988

- Pocket Organizer, Epi Leather  
  https://us.louisvuitton.com/eng-us/products/pocket-organizer-epi-008210/M60642

来源提炼：LV 官方护理页和官方产品页都明确区分了 natural leather、canvas、vernis、empreinte、Epi 等材质族群，适合直接作为 RAG 的第一层路由依据。
