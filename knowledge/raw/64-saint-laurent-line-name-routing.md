# Saint Laurent 系列名分流卡：Kate、Sac de Jour、Loulou、Le 5 à 7 先判材质再给方案

## 资料定位

这是一张处理 `只报 Saint Laurent 系列名` 的分流卡。目标是让生产端先把 line name 映射到材质和风险层，而不是直接输出“YSL 包怎么清理”的泛化答案。

## 判别要点

1. Saint Laurent 多个经典线同时覆盖 `grain de poudre / grained leather / smooth leather / patent / crocodile-embossed / suede`。
2. Saint Laurent FAQ 已明确不同 leather 需要分别维护，因此 line name 不能替代材质判断。
3. 一旦 query 里同时出现 `lambskin`、`grain de poudre`、`patent`、`crocodile-embossed` 等词，材质词优先。

## 系列路由

### Kate

- 默认先查：`63-saint-laurent-material-and-care-map.md`
- 官方常见材质：
  - grain de poudre embossed leather
  - patent leather
  - crocodile-embossed leather
  - crocodile-embossed patent leather
- 路由重点：先分 `压纹成革 / 漆皮 / 高光压纹`，不要把 Kate 默认成单一 grain de poudre。

### Sac de Jour

- 默认先查：`63-saint-laurent-material-and-care-map.md`
- 官方常见材质：
  - grained leather
  - smooth leather
  - patent leather
  - crocodile-embossed leather
  - suede
- 路由重点：结构包不代表材质稳定，尤其 patent 与 crocodile-embossed 要单独提高风险等级。

### Loulou

- 默认先查：`63-saint-laurent-material-and-care-map.md`
- 官方常见材质：
  - lambskin
  - suede
- 路由重点：若未给材质，先按 delicate leather 高敏感路线保守回答。

### Le 5 a 7

- 默认先查：`63-saint-laurent-material-and-care-map.md`
- 官方 line page 可见材质筛选包括：
  - grained leather
  - suede
  - patent leather
  - smooth leather
  - crocodile embossed leather
  - pony leather
  - raffia
- 路由重点：这是一个明显不能按单一材质回答的系列名。

## 生产端建议

- 若用户只报 `Kate` 或 `Sac de Jour`，先召回本卡和 `63`。
- 若用户同时给出明确症状，再从材质映射进入对应场景卡。
- 若问题已影响开合、背带、结构或表面 finish，继续跳转到送修阈值卡。

## 关联文件

- `63-saint-laurent-material-and-care-map.md`
- `39-luxury-brand-material-term-map.md`
- `60-brand-material-routing-index.md`

## 参考依据

- Saint Laurent, FAQ  
  https://www.ysl.com/en-us/displayname-faq

- Saint Laurent, Kate line page  
  https://www.ysl.com/en-us/ca/new-arrivals/highlights/kate-women

- Saint Laurent, Sac de Jour line page  
  https://www.ysl.com/en-us/ca/new-arrivals/highlights/sac-de-jour-women

- Saint Laurent, Loulou line page  
  https://www.ysl.com/en-us/ca/new-arrivals/highlights/loulou-bag-women

- Saint Laurent, Le 5 a 7 line page  
  https://www.ysl.com/en-us/ca/new-arrivals/highlights/le-5-a-7-women
