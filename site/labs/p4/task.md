# 用逐点误差定位量化截断

`activations.csv` 有八个高亮激活。实现 `compare(values, limit)`。对称 INT8 取 −127 至 127，scale=limit/127。用 floor(x/scale+0.5) 取最近整数，夹紧后乘以 scale 得到反量化值。权重同理以范围 ±0.7 量化。

浮点输出为 0.46 + 0.61×x。部署输出用反量化的激活和权重。返回 `saturated`（abs(x)>limit 的项数）、`max_error`（两版输出最大绝对误差）、`deployed`（反量化激活列表）。范围必须为正。

运行 `python -m unittest -v` 和 `python solution.py`。审查 `quant-report.json`，解释 ±1 与 ±2 的区别，列出目标设备仍需测量的项目。该包只计算数值误差。
