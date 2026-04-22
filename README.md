# FinCausalGraph_demo

分层金融因果图静态演示，可直接部署到 **GitHub Pages**。

## 仓库结构

| 路径 | 说明 |
|------|------|
| `index.html` | 入口页（Pages 默认打开） |
| `css/main.css` | 样式 |
| `js/*.js` | 应用脚本（ES Module） |
| `graph_data/*.json` | 图数据（与 `js/data-loader.js` 中相对路径一致） |

本地运行时，`fetch` 依赖 `index.html` 的 URL 作为基准，请用静态服务器打开仓库根目录，例如：

```bash
cd "/Users/zhou/Desktop/Research/事理图谱抽取/FinCausalGraph_demo"
python3 -m http.server 8080
```

浏览器访问：`http://localhost:8080/`（不要只双击打开 `file://`，否则模块与 fetch 常失败）。

## GitHub Pages

1. 将本仓库推送到 GitHub。
2. 仓库 **Settings → Pages**：
   - **Source**：Deploy from branch **main**（或你的默认分支）
   - **Folder**：`/ (root)`
3. 保存后站点地址一般为：`https://<你的用户名>.github.io/FinCausalGraph_demo/`

根目录已包含 `.nojekyll`，避免 Jekyll 忽略部分静态资源。

## 与源项目同步数据

若你在 `demo展示` 中更新了图谱构建脚本产出的 JSON，可将 `graph_data/*.json` 再复制到本仓库对应目录并提交。
