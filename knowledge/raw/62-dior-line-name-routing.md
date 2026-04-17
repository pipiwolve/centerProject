# Dior 系列名分流卡：Lady Dior、Saddle、Dior Book Tote 不能直接当成单一材质

## 资料定位

这是一张处理 `只说 Dior 系列名` 的分流卡。目标不是给护理步骤，而是先把 line name 路由到正确材质族群，再进入场景卡。

## 检索标签

- 品牌：Dior、迪奥
- 系列：Lady Dior、Saddle、Book Tote、Dior Book Tote
- 典型问法：`Lady Dior 怎么护理`、`Saddle 刮了怎么办`、`Book Tote 脏了`

## 判别要点

1. Dior 的同一经典线会跨多种材质，不能把 `系列名 = 固定材质`。
2. 若 query 里同时出现 `Cannage`、`grained calfskin`、`suede`、`Oblique embroidery`、`Macrocannage` 等词，材质词优先级高于系列名。
3. 若症状已经是结构、五金、背带、磁扣或深层污渍，系列名卡只做第一跳，不做最终答复。

## 系列路由

### Lady Dior

- 默认先查：`61-dior-material-and-care-service-map.md`
- 常见首选路由：小羊皮 / delicate structured leather
- 二次分流词：
  - `suede` -> 翻毛皮
  - `embroidered` -> 刺绣 / textile
  - `Cannage lambskin` -> 小羊皮

### Saddle

- 默认先查：`61-dior-material-and-care-service-map.md`
- 不要默认成单一皮革。
- 官方可见组合包括：
  - `grained calfskin`
  - `Dior Oblique jacquard`
  - `smooth calfskin`
  - `suede goatskin`
- 因此 `Saddle 脏了` 这类问法必须先补材质判别。

### Dior Book Tote

- 默认先查：`61-dior-material-and-care-service-map.md`
- 首选路由通常是：刺绣 / jacquard / textile
- 二次分流词：
  - `Oblique embroidery` -> textile
  - `Plan de Paris embroidery with calfskin` -> 复合材质
  - `Macrocannage calfskin` -> 有表面效果的成革

## 生产端建议

- 用户只说系列名时，先召回本卡和 `61`，不要直接召回单一材质清洁方案。
- 用户如果同时给出症状，应在完成系列到材质的映射后继续跳转到场景卡、工具矩阵或送修阈值卡。

## 关联文件

- `61-dior-material-and-care-service-map.md`
- `39-luxury-brand-material-term-map.md`
- `60-brand-material-routing-index.md`

## 参考依据

- Dior, Lady Dior bags  
  https://www.dior.com/en_us/fashion/womens-fashion/bags/lady-dior

- Dior, Small Lady Dior Bag Black Cannage Lambskin  
  https://www.dior.com/en_us/fashion/products/M0618ONGE_M900

- Dior, Designer Saddle Bags  
  https://www.dior.com/en_us/womens-fashion/bags/saddle

- Dior, Saddle Bag Black Grained Calfskin  
  https://www.dior.com/en_us/fashion/products/1ADPO093YKK_H00N

- Dior, Dior Book Tote  
  https://www.dior.com/en_us/fashion/womens-fashion/bags/dior-book-tote
