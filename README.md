# AI 辅助研发训练手册

供算法研发同事自学的中文静态网站。课程数据与案例来自项目设计稿公开版，内容包含 32 门课程、4 个综合案例，演示直接在浏览器里运行。

```sh
npm run build
npm run preview
```

本地需要 Node.js 22+ 和 Python 3.10+。构建检查课程覆盖、先修关系、图像和站内链接，并将 `site/labs/` 内的任务打包成 ZIP。打开终端打印的链接，使用与 GitHub 项目站点相同的子路径预览。

课程大纲见 `site/content/curriculum.json`。LLM 两课的详细讲解与配图清单见 `site/content/llm-foundations.json` 和 `site/content/llm-selection.json`。案例的 AI 回放使用已标注的教学样例。课程进度保存在当前浏览器。

GitHub 仓库的 Settings → Pages 将 Source 设为 GitHub Actions。推送 `main` 后工作流构建并发布 `dist/`。
