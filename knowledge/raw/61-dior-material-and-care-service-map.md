# Dior 材质与 Care Service 映射卡：从官方 line page 词汇到护理路线

## 资料定位

这是一张把 Dior 官方产品线页面、产品页与 FAQ 里的材质词汇压缩成 RAG 路由规则的资料卡，适合处理 `Lady Dior`、`Saddle`、`Dior Book Tote` 这类只报系列名或只报官方材质名的问法。

## 一级原则

- Dior 同一产品线常同时覆盖 `lambskin / grained calfskin / suede / embroidery / calfskin + textile`，不要把系列名误判成单一材质。
- Dior 官方 FAQ 明确提供 repair services，并说明维修由工作坊 artisans 完成。
- 因此 Dior 问题一旦涉及结构、五金、明显 finish 失衡或深层污渍，应更早切到送修阈值，而不是给宽泛家庭清洁建议。

## 材质映射

### Cannage Lambskin

- 路由到：小羊皮 / 绗缝 delicate leather
- 常见线名：Lady Dior
- 高频问题：轻痕、压痕、色迁移、五金接触痕

### Suede Calfskin / Suede Goatskin

- 路由到：翻毛皮 / 绒面革
- 常见线名：Lady Dior、Saddle
- 高频问题：水痕、油污、摩擦倒绒、深浅色迁移

### Grained Calfskin

- 路由到：粒面牛皮 / finished leather
- 常见线名：Saddle
- 高频问题：轻污、边角磨损、五金邻近处失光

### Ultramatte Calfskin / Macrocannage Calfskin

- 路由到：有表面效果的成革 / matte finished calf
- 常见线名：Saddle、Dior Book Tote
- 高频问题：错用 cleaner 后局部发白、表面失衡、压纹区色差

### Dior Oblique Embroidery / Jacquard / Denim Embroidery

- 路由到：刺绣 / jacquard / textile family
- 常见线名：Dior Book Tote、Saddle
- 高频问题：纤维起毛、局部污渍、与皮边交界处交叉污染

### Embroidery with Calfskin / technical fabric with calfskin

- 路由到：复合材质
- 高频问题：主体与边皮必须分区处理，不能整包一个 cleaner 解决

## Care Service / 维修边界

- 用户目标如果是恢复接近专柜外观，或问题已经影响结构、开合、肩带、五金、局部 finish，应优先进入 Dior repair / care service 路由。
- 如果用户只说 `Lady Dior 脏了`、`Saddle 发黑了`，生产端不应直接生成清洁步骤，应先判定是 lambskin、grained calfskin、suede 还是 embroidery。

## 关联文件

- `17-smooth-light-leather-color-transfer.md`
- `18-lambskin-surface-marks.md`
- `20-suede-watermark-oil-routing.md`
- `27-finish-damage-from-wrong-products.md`
- `43-send-repair-threshold-structure-hardware.md`
- `47-canvas-trim-cross-contamination.md`

## 参考依据

- Dior, Lady Dior bags  
  https://www.dior.com/en_us/fashion/womens-fashion/bags/lady-dior

- Dior, Designer Saddle Bags  
  https://www.dior.com/en_us/womens-fashion/bags/saddle

- Dior, Dior Book Tote  
  https://www.dior.com/en_us/fashion/womens-fashion/bags/dior-book-tote

- Dior, Small Lady Dior Bag Black Cannage Lambskin  
  https://www.dior.com/en_us/fashion/products/M0618ONGE_M900

- Dior, Saddle Bag Black Grained Calfskin  
  https://www.dior.com/en_us/fashion/products/1ADPO093YKK_H00N

- Dior, FAQ Couture  
  https://www.dior.com/en_us/fashion/faq-couture
