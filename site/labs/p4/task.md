# 把现有算法交给 AI，生成能发给同事的 A/B Demo

团队已给出暗部抬升算子 tone_curve.py、三组灰度样例和验收条件。请让 Agent 组装浏览器双击可打开的 demo.html。评审希望从同一输入并排看原值和输出，决定是否值得进入真图测试。

实现 render_demo(samples)，返回自包含的 UTF-8 HTML。三组样例从 samples.json 读取。HTML 提供 id 为 sample 的样例选择、id 为 strength 的 0–100 整数滑块、id 为 before 和 after 的同尺度灰度带，以及 id 为 summary 的平均灰度变化。切换样例或强度后，灰度带和统计同时更新。

保留参考算子和样例。可用 Python 预计算 101 档输出，也可在 JavaScript 中按参考算子逐像素计算。不使用外部脚本或网络请求。强度为 0 时结果等于输入，像素 255 始终保持 255。灰度带下标注原始数值与输出值，便于人工核对。

运行 python -m unittest -v 和 python solution.py，在浏览器双击 demo.html，切换全部样例并核对强度 0 与 100 两端。高强度下检查低照阶梯前两格的顺序是否翻转。交付一页 Demo 和复现命令，并说明第一轮真图评审应排除哪些设置。
