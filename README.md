# GRE Prep — 自适应 GRE General Test 备考工具

这是从原 IELTS 项目学习引擎派生出的 **GRE 专用分支**。IELTS 主项目保留在 `main`，GRE 版本位于 `gre-prep`，两套数据互不影响。

## GRE 词汇系统

### 主词库

**再要你命3000是唯一完整主词库。**

项目从 `LER0ever/GRE-CN` 的 CSV 数据同步大三千，然后用三套资料做交叉命中：

- Magoosh Flashcards
- 霍V6 机经词汇
- 佛脚词表

这些补充来源不会把自己的独有单词额外塞进主词库，只用于给大三千中的词加权、补充例句/音标/题位。

### GRE 交叉优先级

每个大三千词基础 1 分：

- Magoosh 命中：+2
- 霍V6 命中：+3
- 佛脚命中：+2
- 霍V6 同一词出现在多个不同题位：额外 +0~2

等级：

- **S：8+**
- **A：5–7**
- **B：3–4**
- **C：1–2**

新词默认按：**优先级分数 → 交叉来源数 → 霍V6题位数** 排序，所以 S/A 词会优先进入每日计划。

> 这是“跨主流词表/机经词表的交叉命中优先级”，不是 ETS 官方词频，也不是完整 GRE 真题语料统计。

详细来源与许可见 `GRE_CN_SOURCES.md`。

### 记忆规则

- 英文 → 中文识别；
- 展示近义词与来源；
- 自动英语发音，语速可调；
- `Tab` 重读；
- `1–4` 键盘选项；
- `Enter` 下一题；
- 一旦答错，后面必须分开再答对 2 次；
- 两次重新证明至少间隔 3 道其他题；
- 跨天复习：**1 → 2 → 6 → 31 → 60 → 120 天**。

## 当前 GRE General Test 结构

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

## 其他模块

### Verbal

覆盖：
- Reading Comprehension
- Text Completion
- Sentence Equivalence

当前题库为原创仿题，不复制 ETS 真题。

### Quant

覆盖：
- Quantitative Comparison
- Multiple Choice — Select One
- Multiple Choice — Select One or More
- Numeric Entry
- Data Interpretation 可继续扩展

### Analytical Writing

- Analyze an Issue
- 30 分钟计时
- 本地自动保存草稿
- 实时 word count

### 错题本

统一记录词汇、Verbal、Quant 历史错误，可单独复习。

## 动态学习计划

目标天数可设为 **7–180 天**。

每日优先级：

**历史欠复习 → 今日到期复习 → 今日新词 → Verbal → Quant**

新词量按剩余未学词和剩余天数动态计算；大三千新词本身已经按 S/A/B/C 优先级排好顺序。

## 本地记忆

所有数据保存在浏览器 `localStorage`，支持 JSON 导入/导出备份，包括：

- 词汇复习阶段
- 正误次数
- Verbal / Quant 表现
- 错题本
- 写作草稿
- 计划天数
- 发音语速
- GRE-CN 词汇缓存与佛脚/霍V6优先级缓存

## 主要文件

```text
index.html           # GRE 主界面
gre-styles.css       # UI
gre-data.js          # 原创 Verbal/Quant/AWA starter bank + 网络失败兜底词汇
gre-cn-import.js     # GRE-CN 大三千/Magoosh/霍V6 CSV 同步
gre-priority.js      # 大三千主库过滤 + Magoosh/霍V6/佛脚交叉优先级
gre-app.js           # 计划、记忆、答题、统计、错题本、TTS
GRE_CN_SOURCES.md    # 数据来源、加权规则、许可说明
```

## 版权边界

- GRE-CN 中 CSV/TXT/代码的许可见其仓库 BSD-3-Clause；
- PDF/Office 资料不自动复制进本项目；
- 本项目没有嵌入 POWERPREP 或 ETS 官方试题；
- “GRE”是 ETS 的注册商标，本项目与 ETS 无隶属或官方合作关系。
