# 清洁剂与护理剂兼容矩阵：按材质决定，不按“看起来差不多”决定

## 资料定位

这份文件用于云 RAG 判断“某类 cleaner / conditioner 能不能上某种材质”，避免把 smooth finished leather 的经验误投到植鞣革、羊皮、漆皮和翻毛皮上。

## 一级规则

- `smooth finished leather` 才是大多数 leather cleaner / leather conditioner 的默认适用对象。
- `unfinished / rawhide / natural leather / 本色植鞣革` 不自动进入 conditioner 逻辑。
- `suede / nubuck / roughout` 只进入绒面专用逻辑。
- `patent leather` 只进入漆皮专用逻辑。

## 材质兼容矩阵

### 光面成革 / Smooth Finished Leather / Calfskin / Cowhide

- 可考虑：smooth leather cleaner、spot cleaner、wax-free conditioner
- 代表依据：Bick 1、Bick 4、Coach leather cleaner / moisturizer
- 使用前提：必须先做 hidden spot test
- 不应混用：酒精、香水、强力去污剂、未知家居清洁剂

### 植鞣革 / Natural Leather / Vachetta / Original Natural Leather

- 默认路线：干式除尘、吸水止损、自然老化接受度判断
- 不作为默认家庭方案：通用 cleaner、saddle soap、mink oil、neatsfoot oil、重护理
- 原因：官方品牌资料对 natural leather 的家庭处理明显更保守，重点是避免加水、加热和化学干预

### 小羊皮 / Lambskin / Nappa

- 默认路线：软布、轻度表面整理、隐藏位测试
- 谨慎路线：只有在品牌或专业人员明确允许时才进入 cleaner / moisturizer
- 不建议：强清洁、厚涂护理、重度抛光

### 漆皮 / Patent Leather / Vernis

- 可考虑：patent-specific care only
- 不应使用：普通皮革油、滋养霜、鞋油、smooth leather conditioner
- 风险：会把高光 finish 处理成发雾、发黏或失去镜面感

### 翻毛皮 / Suede / Nubuck / Roughout

- 可考虑：suede / nubuck cleaner、干式橡皮、专用刷
- 不应使用：smooth leather cleaner、conditioner、鞋油、皮乳
- 风险：一旦用错产品，容易造成结块、油斑、局部发黑

### 涂层帆布 / Canvas with Leather Trim

- 默认路线：微湿软布 + 极少量温和皂液，仅限帆布区域
- 不应套用：皮革 conditioner 到帆布印花区
- 风险：真正危险的是液体串到皮边、线边和胶边

## 产品级参考

### Bick 1 Leather Cleaner

- 定位：aggressive cleaner for smooth finished leathers
- 关键限制：先做 colorfastness 测试
- 不等于：所有真皮都可用

### Bick 4 Leather Conditioner

- 定位：smooth finished leather 的 wax-free conditioner
- 关键限制：不用于 suede、rough-out、distressed、napped leathers

### Saddle Soap

- 定位：smooth finished leather 工具型清洁方案
- 关键限制：不用于 suede、rough-out、napped leathers
- 补充提醒：Luxury bag 的 natural leather / vachetta 不自动适用 saddle soap 路线

## 送修分流

以下情况不再靠 cleaner / conditioner 继续推进：

- 处理中已经带出原色。
- 表层 finish 已经改变。
- 用户目标已从“表面清洁”变成“恢复原始色泽、均色、补色”。

## 参考依据

- Bickmore, Bick 1 Leather Cleaner  
  https://bickmore.com/bick-1-leather-cleaner-8oz

- Bickmore, Bick 4 Leather Conditioner  
  https://bickmore.com/bick-4-leather-conditioner-8oz

- Bickmore, Saddle Soap Plus Lanolin  
  https://bickmore.com/saddle-soap-plus-lanolin-tin

- Coach, Product Care  
  https://www.coach.com/support/product-care

- Louis Vuitton, Leather Goods Product Care  
  https://us.louisvuitton.com/eng-us/faq/services/leather-goods-product-care

- Cuyana, How should I care for my Cuyana leather?  
  https://support.cuyana.com/hc/en-us/articles/6328085671956-How-should-I-care-for-my-Cuyana-leather
