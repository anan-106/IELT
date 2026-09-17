# GRE-CN 数据来源说明

GRE 分支会使用 `LER0ever/GRE-CN` 仓库中的 **CSV 词汇数据** 来扩充本地词库，并在浏览器中缓存。源仓库：

- https://github.com/LER0ever/GRE-CN

## 当前接入的数据

1. `L-GRE-再要你命3000.csv`
   - 用途：作为大词表主体；读取英文词、中文释义和英文释义/近义表达。
2. `L-GRE-MagooshFlashcard.csv`
   - 用途：补充英文定义、例句，并作为优先级信号之一。
3. `L-GRE-机经词汇-霍V6.CSV`
   - 用途：补充音标、释义、section/题号信息；命中的词标记为高优先级。
4. `L-GRE-同义词乱序-霍V6.csv`
   - 用途：补充 GRE 相关高频词和释义。

## 项目内的优先级

- Level 1：霍V6 命中 / 当前 starter 中的高优先级词。
- Level 2：Magoosh 命中但未进入 Level 1 的词。
- Level 3：其余再要你命3000词表词。

该分级只是本项目的学习调度规则，不代表 ETS 官方词频或官方词表。

## 缓存与离线

`gre-cn-import.js` 首次联网时抓取上述 CSV、解析并合并，结果保存在浏览器 `localStorage`。之后页面优先读取缓存，所以离线时仍可继续学习；联网时会尝试刷新缓存。

## 许可与版权

`GRE-CN` README 说明：CSV / TXT / 代码以 BSD-3-Clause 许可发布；PDF 和 Office 文档除非另有说明，以 CC-BY-NC-ND 共享。源仓库根 LICENSE 为 BSD 3-Clause，版权声明为：

> Copyright (c) 2018, L.E.R

本 GRE 分支只自动接入 CSV 数据，不把源仓库的 PDF/Office 资料改编进公开题库。对源数据的使用保留来源标识与署名；各原始教材、词表和第三方内容的权利仍归其相应权利人。

BSD-3-Clause 条款请见源仓库：

- https://github.com/LER0ever/GRE-CN/blob/master/LICENSE

## 阅读材料

源仓库还包含 `L-GRE-老肖新GRE阅读真题大合集.pdf` 及答案 CSV。由于该 PDF 属于不同许可/版权类别，本项目目前不复制或改编其正文；如需要，可在个人学习环境中单独参考源仓库文件。
