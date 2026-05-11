# 易經陽宅風水 Yijing Yangzhai Fengshui

![Hero Image](assets/hero.png)

基於倪海廈老師易經陽宅學說的 AI 風水分析技能。

> 本專案為非官方、非商業的學習與工具化整理，僅作傳統文化與自我反思參考；不代表原作者、倪海廈老師或相關權利方背書。

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

## 核心理念

> **重「神」不重「形」**：強調「名位相等」與「長幼有序」，而非風水擺件。

本技能著重於：
- **位置**與**格局**的分析
- 家庭成員臥室方位
- 廚房、廁所等特殊空間
- 辦公室老闆座位

## 功能

- 🏠 **住宅風水分析**：根據家庭成員組成與臥室方位，推導卦象
- 🍳 **房間風水判斷**：廚房、廁所、客廳的吉凶分析
- 🏢 **辦公室風水**：老闆座位方位分析
- 📖 **六十四卦解讀**：結合陽宅風水語境的卦象詮釋

## 使用方式

### 作為 AI Skill 使用

1. 將此資料夾複製到 Skills 目錄：
   - **Claude Code**: `.agent/skills/`
   - **Antigravity**: `~/.gemini/antigravity/skills/`

2. 在對話中使用觸發詞：
   - 「幫我看風水」
   - 「分析我家的方位」
   - 「辦公室風水」

### 使用計算工具

```bash
# 單一卦象查詢
python scripts/fengshui_calc.py --person 震 --position 乾
# 輸出: {"hexagram_number": 34, "hexagram_name": "雷天大壯", ...}

# 完整分析
python scripts/fengshui_calc.py --analyze \
  --family '{"父親": "東", "長子": "西北", "母親": "西南"}' \
  --rooms '{"廚房": "西北", "廁所": "中央"}'
```

### 使用網頁介面

提供視覺化平面圖建構器，可拖拉房間、家庭成員與重要物品，並支援多樓層、保存/導入配置與多選整組拖移：

**[👉 點此直接進行線上體驗 (Demo)](https://jimmy0826crowly.github.io/yijing-fengshui/)**

或者本地運行：

```bash
cd web
npx -y serve .
# 打開 http://localhost:3000
```

**功能：**
- 🖱️ 點擊或拖拉房間到畫布
- 🏠 建立與切換多個樓層
- 🎹 放置睡床、書桌、餐桌、神桌、鏡子、魚缸、爐灶等重要物品
- 📐 拖拉邊角縮放房間
- 🔄 拖拉黃點旋轉房間
- 🧩 Shift/Ctrl/Command 點擊多選，整組拖移不打亂局部布局
- 👨‍👩‍👧‍👦 將家人放入臥室（會跟著房間移動）
- 💾 將布局保存為 JSON，日後可導入繼續修改
- 📋 一鍵生成 AI 分析 Prompt

## 專案結構

```
yijing-fengshui/
├── index.html            # Demo 入口，跳轉至 web/index.html
├── SKILL.md              # AI 技能指引
├── README.md             # 本文件
├── LICENSE               # CC BY-NC-SA 4.0
├── scripts/
│   └── fengshui_calc.py  # 卦象計算工具
├── web/                  # 視覺化平面圖建構器
└── references/
    ├── 64gua.md          # 六十四卦詳解
    ├── bagua-wanwu.md    # 八卦萬物類象
    ├── yangzhai-theory.md# 陽宅風水理論
    ├── room-fengshui.md  # 房間風水規則
    └── office-fengshui.md# 辦公室風水
```

## 八卦方位對應

| 卦 | 方位 | 家庭成員 | 五行 |
|----|------|----------|------|
| 乾 | 西北 | 父親 | 金 |
| 坤 | 西南 | 母親 | 土 |
| 震 | 東 | 長子 | 木 |
| 巽 | 東南 | 長女 | 木 |
| 坎 | 北 | 中男 | 水 |
| 離 | 南 | 中女 | 火 |
| 艮 | 東北 | 少男 | 土 |
| 兌 | 西 | 少女 | 金 |

## 參考來源

- 倪海廈老師陽宅學說
- 《易經》六十四卦

## Credits / Attribution

- 原始專案：[`Wolke/yijing-fengshui`](https://github.com/Wolke/yijing-fengshui)
- 本 fork：[`Jimmy0826Crowly/yijing-fengshui`](https://github.com/Jimmy0826Crowly/yijing-fengshui)
- 本 fork 在原始專案基礎上修改了視覺化平面圖建構器，包括多樓層、重要物品、保存/導入配置、Demo 入口與多選整組拖移等功能。
- 本專案依原授權以 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 釋出：保留署名、限非商業使用，衍生作品需採用相同授權。
- 若原作者或相關權利方認為署名、引用或內容使用有不妥之處，歡迎提出 issue 或聯繫本 fork 維護者修正。

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
