# 在预算内筛选候选并冻结选择

`candidates.csv` 保存开发分数和成本，`holdout.csv` 保存独立分数。两份分数均为教学设定。

实现 `select(candidates, budget)`，返回 `selected`（候选 ID）、`spent`、`tried`（已试 ID 列表）。按表中顺序检查，下一项放不下时结束。首行是零成本基线，F1 相同保留先出现的项。负预算抛出 ValueError。

实现 `validate(selection, holdout)`，仅查询锁定项和基线。保留 selection 原字段，增加 `holdout_f1`、`baseline_f1`、`adopt`（严格高于基线才为 true）。该函数不能改选。运行 `python -m unittest -v`，再执行 `python solution.py 8`，查看 `result.json` 并解释为什么保留基线。
