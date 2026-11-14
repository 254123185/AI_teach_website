# 权重与输出

对中心 i 和邻居 j，令 d=(j−i)/空间尺度，r=(像素[j]−像素[i])/灰度尺度。权重 w=exp(−(d²+r²)/2)。输出等于 Σ(w×像素)/Σ(w)。

来源：Tomasi 与 Manduchi，[Bilateral Filtering for Gray and Color Images](https://users.cs.duke.edu/~tomasi/papers/tomasi/tomasiIccv98.pdf)，式 (5)–(6)。这里将二维距离简化为一维索引差。
