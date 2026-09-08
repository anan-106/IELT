# IELT Memory — 雅思阅读 538 + Academic 自适应记忆工具

个人雅思阅读词汇学习工具：以新版 538 为核心，加入 Academic 学术阅读扩展，并让所有卡片共用同一套错词强化与间隔复习系统。

## 新版 538 数据结构

“538”并不是 538 个独立主词，而是 **376 个主考点词 + 162 个额外同义替换学习目标 = 538**：

| 类别 | 主考点词 | 额外同义替换 | 合计 | 建议掌握程度 |
| --- | ---: | ---: | ---: | --- |
| 第 1 类 | 20 | 34 | 54 | 滚瓜烂熟 |
| 第 2 类 | 100 | 71 | 171 | 熟记 10 遍以上 |
| 第 3 类 | 256 | 57 | 313 | 熟记 5 遍以上 |
| **总计** | **376** | **162** | **538** | — |

项目数据层会运行强制审计：

- 主词 ID 必须严格连续为 `1..376`；
- 三组主词数量必须严格为 `20 / 100 / 256`；
- 每个主词必须有单词、中文学习义和同义替换数据；
- 原仓库尾部的 `apply to`、`similar` 不再作为第 377 / 378 张主词卡；
- 新版表中能够确认的排版问题采用 **source 原貌 + learner-normalized 学习字段** 双层保存，不静默改写来源。

例如：新版公开文本中 `compensate`、`extinct`、`designate` 的词性存在明显排版异常；`primary` 的替换栏出现 `principle`。项目会保留这些 source 信息，但学习测验使用规范字段。新版 `abandon` 行中的 `derelict` 也已经补回旧仓库遗漏数据。

## Academic 扩展词库

当前加入 **NAWL 1.2 Top 200** 作为第一阶段 Academic deck：

- 数据源：New Academic Word List (NAWL) 1.2；
- 使用官方 frequency ranking / headword / PoS；
- 中文释义由本项目自行整理；
- 与新版 538 主词自动去重；
- Academic 卡使用 **英文 → 中文义项识别** 题型；
- 默认新词学习顺序仍然是 **先完成 376 个新版 538 主词，再进入 Academic**，但可以在“词库 → Academic”随时单独练习。

NAWL 1.2 官方完整词表为 957 个词。本项目先加入排名前 200，用于控制每日学习负担；后续可沿同一数据结构继续扩展到完整 NAWL，而无需改记忆算法。

## 当前功能

- **今日学习队列**：优先安排到期词，再加入每日新词。
- **错词即时重现**：答错后默认隔 3 张卡再次出现。
- **自适应间隔复习**：每个词独立维护 Difficulty、Stability、Retrievability。
- **四档反馈**：忘了 / 困难 / 记住 / 太简单。
- **新版 538 同义替换训练**：完整保留教材表的同义替换字段，不对未验证的颜色/子类型做人为猜分。
- **Academic 题型**：NAWL 英文词 → 中文学术义识别。
- **词库筛选**：全部 / 新版 538 / 第 1、2、3 类 / Academic。
- **英美拼写别名**：例如 recognise/recognize、harbour/harbor、odour/odor 等。
- **学习统计**：今日复习、正确率、稳定掌握、薄弱词、近 7 天学习量。
- **旧版进度迁移**：继续兼容 `538-progress`。
- **本地保存与 JSON 备份**：学习状态只保存在浏览器 localStorage。
- **英式发音**：浏览器 Speech Synthesis，无需额外音频。

## 文件结构

```text
IELT/
├── index.html                 # 页面与数据脚本加载顺序
├── styles.css                 # UI 样式
├── app.js                     # 原 v3 记忆系统 + 多词库最小接入
├── data.js                    # 原始 538 数据与例句，兼容层
├── academic-data.js           # NAWL 1.2 Top 200 扩展数据
├── data-v2.js                 # 376 主词审计、校注、去重与统一数据模型
├── THIRD_PARTY_NOTICES.md     # Academic 数据来源与许可证说明
└── README.md
```

## 数据字段

新版 538 卡片主要字段：

- `sourceWord` / `sourcePos` / `sourceSynonyms`：来源表字段；
- `word` / `pos` / `quizSynonyms`：用于学习与测验的规范字段；
- `aliases`：英美拼写、旧版形式等；
- `sourceNote`：来源与学习层存在差异时的校注；
- `verification`：当前核对状态。

Academic 卡片使用相同的 `cardId` / `deckId` / `quizMode` 接口，因此可以直接进入现有 D/S/R 调度器。

## 使用

直接打开 `index.html` 即可使用。项目为纯前端，无服务器依赖。

如果部署到 GitHub Pages，学习记录仍只存在用户自己的浏览器中，不会提交到 GitHub 仓库。

## License

项目代码沿用原仓库 MIT License。

NAWL 1.2 词表数据由 Browne、Culligan、Phillips 发布，采用 **CC BY-SA 4.0**；详见 `THIRD_PARTY_NOTICES.md`。教材相关 538 数据仅用于个人学习与研究，请尊重原教材及数据来源的相关权利。
