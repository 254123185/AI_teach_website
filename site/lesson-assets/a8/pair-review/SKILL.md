---
name: pair-review
description: Prepare a pairing report for baseline and candidate results from one image batch. Use when checking sample IDs before comparison.
---

# 核对两版结果的样本配对

输入是 JSON 文件，包含两个字符串数组 `base` 和 `candidate`。保留 ID 的原样拼写，包括前导零。当前工具处理清单，图像解码与画质比较交给后续步骤。

从任务目录运行 `python pair-review/scripts/pair.py batch1.json`，将标准输出保存为 JSON，并记录退出状态。换批次时把命令行的文件名换成实际清单。输出协议见 [output-format.md](references/output-format.md)。

退出码为 0 时报告配对与两侧缺项，完整配对可以继续。退出码为 1 时把重复 ID 或无效输入带回原清单核对，待修正后重新检查。每次保留原清单。
