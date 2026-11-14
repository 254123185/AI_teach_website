# 带着数据缺口委托 AI 生成回归集

问题是夜景降噪评审缺少暗平面、细纹理和高光截断三类对照数据。请让 Agent 把 scenarios.json 中的规格变成可重复运行的生成器，交付参考图、退化图和清单。真实拍摄数据另行保留。

实现 make_pair(width, height, scenario, seed)，返回两个等长的一维像素列表（行优先），先参考、后退化。参考像素在 (x,y) 处定义如下：

- dark 固定为 32。
- texture 用 72 + 32 * ((x + y) % 2) 生成棋盘纹理。
- highlight 用 min(255, 188 + 4*x) 生成从暗到亮的坡度。

每张退化图新建 random.Random(seed)，按像素顺序采样 randint(-noise, noise)。noise 为 0 时直接取 0。算上配置的 offset 后截断至 [0,255]。每项只使用规格里的参考类型、噪声、偏移与 seed。

运行 python -m unittest -v，再用 python solution.py 输出 dataset/。检查 manifest.json 中暗平面和细纹理各两条、高光组一条，同 seed 结果可重现且高光组有饱和像素。向组员说明这批数据覆盖了哪些故障、还缺什么真实场景。
