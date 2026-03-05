# 🚗 汽车工程智能问答 Demo

一个展示 **NLU → Skill → NLG** 三层流水线架构的汽车成本分析演示系统。

## ✨ 功能特性

- **15款虚拟车型** (10 EV + 5 ICE) 完整成本数据
- **14种查询意图**: 成本对比、排名、一体化压铸仿真、供应商分析等
- **多轮对话**: 支持上下文引用 ("刚才提到的三台车")
- **LLM 集成** (可选): 接入 OpenAI / Claude / DeepSeek 获得深度洞察
- **零服务器**: 纯前端运行，数据内嵌 JSON

## 🚀 快速部署到 GitHub Pages

```bash
# 1. Fork 或 clone 本仓库
git clone https://github.com/YOUR_USERNAME/auto-engineering-qa.git
cd auto-engineering-qa

# 2. 安装依赖
npm install

# 3. 构建
npm run build

# 4. 部署 dist 目录到 GitHub Pages
# 方法 A: 使用 gh-pages 包
npm install -g gh-pages
gh-pages -d dist

# 方法 B: 手动设置
# Settings → Pages → Source: Deploy from a branch → gh-pages / root
```

## 📦 直接使用构建产物

`dist/` 目录已包含完整的可部署文件，可以直接用任何静态服务器托管：

```bash
# 本地预览
npx serve dist

# 或直接打开 dist/index.html
```

## 🔧 开发

```bash
npm install
npm run dev    # 开发服务器 (热重载)
npm run build  # 生产构建
```

## 🔐 LLM 配置

点击页面右上角的 LLM 设置按钮：
1. 选择供应商 (OpenAI / Claude / DeepSeek)
2. 输入 API Key
3. Key 仅存于浏览器 sessionStorage，关闭页面即消失

不配置 LLM 也可使用全部查询功能（使用规则引擎 + 模板生成）。

## 📊 架构

```
用户提问
  ↓
[NLU 意图理解] ── LLM 或规则引擎
  ↓
[Skill 数据检索] ── 确定性代码，零幻觉
  ↓
[NLG 洞察生成] ── LLM 或模板引擎
  ↓
返回分析结果
```

**核心原则**: LLM 负责理解与表达，Ontology + Skill 负责事实与计算，防止幻觉。
