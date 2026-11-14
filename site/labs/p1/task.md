# 把双边滤波公式变成可验证代码

读 `formula.md` 和 `fixtures.json`。在 `solution.py` 实现 `bilateral(values, center, range_sigma, spatial_sigma=1.25)`，返回 `(output, normalized_weights)`。两个尺度必须为正，中心索引必须在范围内。

跑 `python -m unittest -v` 和 `python solution.py`。常量区域维持原灰度，灰度尺度调小后跨边缘邻居的总权重下降。把分子、分母和测试结果对应到代码行。该实现只包含一维窗口。
