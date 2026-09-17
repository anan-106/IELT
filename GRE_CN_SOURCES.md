# GRE-CN 数据来源与交叉优先级

GRE 分支使用 `LER0ever/GRE-CN` 仓库中的 CSV 词汇数据。源仓库：

- https://github.com/LER0ever/GRE-CN

## 主词库

**`L-GRE-再要你命3000.csv` 是唯一完整主词库。**

项目不会把 Magoosh、霍V6、佛脚里独有的词额外塞进主学习队列。它们只用来给“大三千”中的同名词增加交叉命中信号、补充释义/例句/音标/题位信息。

## 交叉数据源

1. `L-GRE-MagooshFlashcard.csv`
   - 命中：优先级 +2；
   - 补充英文定义与例句。
2. `L-GRE-机经词汇-霍V6.CSV`
   - 命中：优先级 +3；
   - 补充音标、中文释义、section/题号；
   - 同一词出现多个不同题位时，额外 +0~2 分。
3. `L-GRE-佛脚词表.csv`
   - 命中：优先级 +2；
   - 用于短期高频词交叉验证。
4. `L-GRE-同义词乱序-霍V6.csv`
   - 只作为补充释义/词义网络资料；不单独增加主词卡，也不作为第四个计分源。

## 优先级公式

每个大三千词固定有基础 1 分：

`priorityScore = 1 + Magoosh(2) + 霍V6(3) + 佛脚(2) + 霍V6重复题位奖励(0~2)`

等级：

- **S**：8 分及以上——通常是大三千 + Magoosh + 霍V6 + 佛脚共同命中；
- **A**：5–7 分——至少两套重要补充来源交叉命中，或霍V6再叠加其他来源；
- **B**：3–4 分——至少命中一套补充词表；
- **C**：1–2 分——主要是大三千自身覆盖。

新词默认按：**分数降序 → 交叉命中来源数 → 霍V6题位数** 排序，所以 S/A 会优先进入每日计划。

> 该分数是“跨主流词表/机经词表的交叉命中优先级”，不是 ETS 官方词频，也不是基于完整 GRE 真题语料统计出的真实出现概率。

## 缓存与离线

- `gre-cn-import.js` 负责同步大三千、Magoosh、霍V6等 CSV；
- `gre-priority.js` 同步佛脚 CSV，并计算 S/A/B/C 优先级；
- 数据缓存在浏览器 `localStorage`，同步完成后离线仍可继续学习。

## 许可与版权

`GRE-CN` README 说明：CSV / TXT / 代码以 BSD-3-Clause 许可发布；PDF 和 Office 文档除非另有说明，以 CC-BY-NC-ND 共享。源仓库根 LICENSE：

> Copyright (c) 2018, L.E.R

本 GRE 分支自动接入 CSV 数据，不把源仓库的 PDF/Office 文档改编进公开题库。各原始教材、词表和第三方内容的权利仍归相应权利人。

BSD-3-Clause 条款：

- https://github.com/LER0ever/GRE-CN/blob/master/LICENSE
