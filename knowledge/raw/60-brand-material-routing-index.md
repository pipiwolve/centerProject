# 品牌材质路由索引卡：生产端问答的第一层入口

## 资料定位

这是一张总索引卡，不直接提供护理步骤，而是把品牌和材质命名先路由到正确知识族群。适合当云 RAG 的第一层召回桥梁。

## Louis Vuitton

- core material families -> `51-louis-vuitton-core-material-map.md`
- mens leather families -> `52-louis-vuitton-men-leather-family-map.md`
- quick routing -> `59-louis-vuitton-material-choice-routing.md`

## Coach

- material + product eligibility -> `53-coach-material-and-product-eligibility-map.md`
- fabric cleaner boundary -> `58-coach-fabric-cleaner-boundary-card.md`

## CHANEL

- bags + SLG materials -> `54-chanel-material-and-care-map.md`
- small leather goods routing -> `57-chanel-small-leather-goods-routing.md`

## LOEWE

- material + after-sales map -> `55-loewe-material-and-aftercare-map.md`

## Longchamp

- line + material structure -> `56-longchamp-line-material-map.md`

## Dior

- material + care service map -> `61-dior-material-and-care-service-map.md`
- line-name routing -> `62-dior-line-name-routing.md`

## Saint Laurent

- material + care map -> `63-saint-laurent-material-and-care-map.md`
- line-name routing -> `64-saint-laurent-line-name-routing.md`

## Prada

- material + maintenance map -> `65-prada-material-and-maintenance-map.md`
- line-name routing -> `66-prada-line-name-routing.md`

## Goyard

- material + care map -> `67-goyard-material-and-care-map.md`
- line-name routing -> `68-goyard-line-name-routing.md`

## 产品线名索引

- cross-brand line-name routing -> `72-product-line-name-routing-index.md`

## 什么时候优先召回这张索引卡

- 用户提到的是品牌官方材质名，而不是通用材质词。
- 用户只说系列名、产品线名、或混合材质名。
- 系统需要先判断是 `植鞣革 / 漆皮 / 压纹成革 / coated canvas / 复合材质` 中的哪一类。

## 什么时候不要停在这张卡

- 用户已经描述了清晰症状时，索引卡只做第一层路由。
- 一旦完成材质映射，应继续进入场景卡、工具矩阵或送修阈值卡。

## 推荐下一跳

- 材质不明 -> `35-query-synonym-map.md`
- 产品名/材质名已知 -> 本索引卡
- 只给系列名 / line name -> `72-product-line-name-routing-index.md`
- 症状清晰 -> 对应场景卡
- 功能件异常 -> `43` `45` `49`
- 准备送修 -> `50`
