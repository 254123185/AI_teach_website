# 低照度图像降噪 · 分区融合实验

此包包含实验源代码、协议和运行快照。双击 `published/demo.html` 查看已交付的局部对照，打开 `published/report.md` 阅读结果。把目录交给 OpenCode 等编码 Agent，从 `task.md` 的评审任务开始。

要核对实现与像素时，可以用 Python 3.10+ 复算。复算无需模型账号、外部库或实拍图。

```
python -m unittest -v
python solution.py --out run
```

`run/manifest.json` 列出复算产物的 SHA-256。要对比其他方法，可保留已交付快照，再用另一个输出目录记录新实验。
