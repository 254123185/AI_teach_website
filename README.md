# AI 辅助研发训练手册

供算法研发同事自学的中文静态网站。首页先介绍推荐的外部公开课程。站内另有新员工入门导读、32 门课程，以及低照度分区降噪案例的正文与 4 个配套专题。演示直接在浏览器里运行。

```sh
npm run build
npm run preview
```

本地需要 Node.js 22+ 和 Python 3.10+。构建检查课程覆盖、先修关系、图像和站内链接，并将 `site/labs/` 内的任务打包成 ZIP。打开终端打印的链接，使用与 GitHub 项目站点相同的子路径预览。

GitHub Actions 使用 `site/experiment-snapshot/` 中的低照度结果，并核对清单中的 SHA-256。本地编辑教材时也可以把 `TRAINING_FUSION_SNAPSHOT` 指向这个目录，复用同一组像素、读数和 Demo。

课程大纲见 `site/content/curriculum.json`。LLM 两课的详细讲解与配图清单见 `site/content/llm-foundations.json` 和 `site/content/llm-selection.json`。团队工作流及产物示例见 `site/content/workflows/`。课程进度保存在当前浏览器。

基础课按 [开发规格](SPEC.md) 推进。每批先写教学目标、交付位置和验收方式，再改页面。

GitHub 仓库的 Settings → Pages 将 Source 设为 GitHub Actions。推送 `main` 后工作流构建并发布 `dist/`。
