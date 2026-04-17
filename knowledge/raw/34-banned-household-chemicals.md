# 高风险家用化学品黑名单：云 RAG 不应轻易推荐的东西

## 资料定位

这份文件用于约束生成端，避免模型把日常“家务清洁经验”错误迁移到高端皮具和复合材质包袋上。

## 黑名单清单

### 酒精类

- 包含：酒精喷雾、手消毒液、酒精湿巾
- 风险：可能带走颜色、改变表层 finish、让天然皮和柔软皮变干
- 高风险材质：小羊皮、植鞣革、漆皮、浅色光面皮

### 香水、化妆品、防晒、含油美容品

- 风险：颜料、酒精和油脂都可能造成局部染色、斑驳或 finish 失衡
- 高风险材质：浅色皮、漆皮、柔软皮

### 通用家居清洁剂 / 厨卫清洁剂

- 风险：配方并非为皮革或高光 finish 设计
- 高风险材质：全部

### 强溶剂 / 去渍油 / 卸甲类产品

- 风险：会直接把问题从“污渍”升级成“表层破坏”
- 高风险材质：漆皮、印花帆布、光面皮、边油区域

### 家庭偏方型重油

- 包含：mink oil、neatsfoot oil、重蜡型护理品被当成“万能修复”
- 风险：可能明显加深颜色、改变手感、堵塞毛孔或带来不均匀包浆
- 高风险材质：natural leather / vachetta、浅色皮、小羊皮

### 错材质护理品

- 例 1：把 smooth leather conditioner 用到 suede / nubuck
- 例 2：把普通皮油用到 patent leather
- 例 3：把 canvas 的皂液路线套到本色皮边

## 风险组合

以下组合应被视为高危信号：

- 酒精 + 浅色皮
- 热风 + 油脂护理
- 清洁剂直倒皮面 + 反复猛擦
- 受潮未干 + 立即补脂
- 不确定材质 + 叠加两种以上产品

## RAG 约束规则

- 用户只要提到“牙膏、小苏打、酒精、卸妆水、洗洁精全包通用、消毒湿巾”等词，就应优先触发风险提示。
- 若材质不明确，系统应退回到“干布、测试、停手、送修判断”。
- 不允许把产品名推荐成跨材质通解。

## 参考依据

- Louis Vuitton, Leather Goods Product Care  
  https://us.louisvuitton.com/eng-us/faq/services/leather-goods-product-care

- Hermès, Leather Care  
  https://www.hermes.com/us/en/content/151446-leather-care/

- CHANEL, Bags Care Instructions  
  https://www.chanel.com/ee/fashion/care-instructions/bags/

- Coach, Product Care  
  https://www.coach.com/support/product-care

- Bickmore, Neatsfoot Oil  
  https://bickmore.com/products/neatsfoot-oil

来源提炼：官方品牌护理页普遍强调避免酒精、香氛、化学品和不适配护理品；Bickmore 官方也明确写出油类会明显加深多数皮革颜色，不能被当成默认安全解。
