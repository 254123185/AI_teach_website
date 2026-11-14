# 从 logits 到下一个 Token

任务是实现一个极小词表中的贪心解码。把它交给 Agent，审查数值稳定性，再自己验收。

`fixtures.json` 以词表顺序给出候选 ID、logits 和期望的最高分 ID。实现 `softmax(logits)` 和 `choose(ids, logits)`。先减去最大 logit，避免对 1002 直接取指数。分数并列时选列表里的第一项。拒绝空列表、非有限值和长度不匹配。

运行 `python -m unittest -v`。再运行 `python solution.py`，从打印的 JSON 对比普通 logits 和整体加 1000 后的概率，说明为什么两者相同。

这份数据从输出 logits 开始。任务范围是概率和解码，Transformer 的前向计算见课程图例。
