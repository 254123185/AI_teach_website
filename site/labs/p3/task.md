# 定位图像误差集中在哪个区域

包内三张 8×2 的 PGM 灰度网格为同一场景的参考、基线和候选。左四列是暗墙，右四列是纹理。用文本编辑器可查看像素值。

实现 `mae(reference, image, roi)`。输入图像为矩形二维列表，ROI 为 `(x,y,width,height)`。逐点计算亮度绝对误差的均值，拒绝尺寸不匹配或越界 ROI。每点权重相同。

执行 `python -m unittest -v` 和 `python solution.py`，在 `roi-report.json` 比较两处误差。用一句话描述看到的取舍，并提出下一步对照。本站图像演示使用另一份尺寸更大的合成样例。
