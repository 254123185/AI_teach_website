# 本地 Agent 任务

需要 Python 3.10 或更新版本。项目只用标准库，数据随包提供。

1. 解压 ZIP，在包含 `task.md` 的文件夹打开终端。
2. 有 OpenCode 时运行 `opencode`，输入「先读 task.md 和测试，按验收要求完成，运行验收并汇报改动」。使用其他编码 Agent 时，打开同一文件夹并给出相同指令。
3. 交付后自己执行 `python -m unittest -v`，再按 `task.md` 运行报告命令。检查代码改动和结果。初始代码含待实现函数，验收开始时会失败。

在模型服务端运行的 Agent 会按其配置发送上下文。这个任务包用教学数据，可直接用于演示。

[OpenCode CLI 文档](https://opencode.ai/docs/cli/)
