# GRE Prep — 自适应 GRE General Test 备考工具

这是从原 IELTS 项目学习引擎派生出的 **GRE 专用分支**。IELTS 主项目保留在 `main`，GRE 版本位于 `gre-prep`，两套数据互不影响。

## 当前 GRE 结构

项目按 ETS 当前短版 GRE General Test 设计：

| Measure | Section | Questions | Time |
| --- | --- | ---: | ---: |
| Analytical Writing | Analyze an Issue | 1 | 30 min |
| Verbal Reasoning | Section 1 | 12 | 18 min |
| Verbal Reasoning | Section 2 | 15 | 23 min |
| Quantitative Reasoning | Section 1 | 12 | 21 min |
| Quantitative Reasoning | Section 2 | 15 | 26 min |

总考试时间约 **1 小时 58 分钟**。Verbal 与 Quant 的第二节难度取决于第一节整体表现。

官方说明：
- https://www.ets.org/gre/test-takers/general-test/prepare/test-structure.html
- https://www.ets.org/gre/test-takers/general-test/prepare/content/verbal-reasoning.html
- https://www.ets.org/gre/test-takers/general-test/prepare/content/quantitative-reasoning.html
- https://www.ets.org/gre/test-takers/general-test/prepare/content/analytical-writing.html

## 项目模块

### 1. GRE 词汇

- 三层高频词汇 starter deck；
- 英文 → 中文识别；
- 展示近义词；
- 自动英语发音；
- `Tab` 重读；
- `1–4` 键盘选项；
- `Enter` 下一题；
- 答错后必须在后续题目中 **再答对 2 次**；
- 两次重新证明至少间隔 3 道其他题；
- 跨天复习：**1 → 2 → 6 → 31 → 60 → 120 天**。

> 词汇表是项目独立整理的 GRE-oriented starter deck，不是 ETS 官方词表。

### 2. Verbal Reasoning

覆盖当前 GRE 的三类 Verbal 题型：

- Reading Comprehension
- Text Completion
- Sentence Equivalence

当前题库为 **原创仿题**，不复制 ETS 真题。ETS 明确限制在第三方网站转载 GRE 受版权保护材料，因此本项目只链接官方资源，不嵌入官方真题。

### 3. Quantitative Reasoning

覆盖：

- Quantitative Comparison
- Multiple Choice — Select One
- Multiple Choice — Select One or More
- Numeric Entry
- 后续可继续扩展 Data Interpretation sets

当前题库同样为原创训练题。

### 4. Analytical Writing

- Analyze an Issue；
- 30 分钟计时；
- 本地自动保存草稿；
- 实时 word count；
- 原创训练题。

### 5. 错题本

统一记录：

- 词汇错词；
- Verbal 错题；
- Quant 错题。

历史错误次数会持续保留，可单独进入错题复习。

### 6. 动态学习计划

目标天数可设为 **7–180 天**。

计划优先级：

**历史欠复习 → 今日到期复习 → 今日新词 → Verbal → Quant**

词汇新学量会按照：

**剩余未学词 ÷ 剩余天数**

动态计算；如果有大量历史欠复习，会自动降低当天新词压力。

### 7. 本地记忆

所有数据保存在浏览器 `localStorage`：

- 词汇复习阶段；
- 正误次数；
- Verbal / Quant 题型表现；
- 错题本；
- 写作草稿；
- 计划起始日期与目标天数；
- 发音语速。

支持 JSON 导入 / 导出备份。

## 键盘

- `1–6`：选择题选项
- `Tab`：重新朗读当前词汇
- `Enter`：下一题；多选题作答阶段用于提交答案

## 文件

```text
index.html        # GRE 主界面
gre-styles.css    # GRE UI
gre-data.js       # GRE 词汇 + 原创 Verbal/Quant/AWA starter bank
gre-app.js        # 计划、记忆、答题、统计、错题本、TTS
```

原 IELTS 文件仍保留在分支历史/仓库中，但 GRE 页面只加载 `gre-data.js` 与 `gre-app.js`。

## 版权边界

- 本项目没有嵌入 POWERPREP 或 ETS 官方题目；
- “GRE”是 ETS 的注册商标；本项目与 ETS 无隶属或官方合作关系；
- 官方备考材料请从 ETS 网站获取。

## 后续扩展

建议按顺序继续：

1. 扩 GRE 词汇到 1000–3000 词，并为每个词增加 GRE 高频义、反义/近义和例句；
2. 扩 Verbal 原创题库并增加按题型难度自适应；
3. 扩 Quant 到完整 ETS Math Review 四大领域；
4. 增加 12/15 题的完整 Section Simulator；
5. 增加 V/Q 目标分数和正确题数估算面板。
