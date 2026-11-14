const paperCrop = { width: 1250, height: 839, cropWidth: 99, cropHeight: 87 };
const texturePanels = [
  { x: 7, y: 146, label: '(a) 干净参考', reading: '先找到桌布上同向排列的细条。' },
  { x: 460, y: 146, label: '(b) 加噪输入', reading: '颗粒盖在细条上，二者同时存在。' },
  { x: 912, y: 146, label: '(c) NPGTV', reading: '从同一位置看，仍能辨认织物走向。' },
  { x: 460, y: 685, label: '(e) 经典 TV', reading: '一些条纹随噪声一起被抹掉。' },
];

export function paperTextureRead(base, paper, h) {
  const { width, height, cropWidth, cropHeight } = paperCrop;
  const src = base + 'assets/' + paper.src;
  return `<figure class="story-figure paper-reading"><figcaption><strong>跟读论文局部 · 同一块桌布，四种输入或输出</strong>
<p>用 (a) 确认信号原本在哪，再对照 (b)、(c)、(e)。四格从原图同坐标裁剪并按同一尺度放大。</p></figcaption>
<div class="paper-crop-grid">${texturePanels.map(panel => `<div><div class="paper-crop" style="--crop-ratio:${cropWidth}/${cropHeight};--source-width:${100 * width / cropWidth}%;--crop-x:${-100 * panel.x / cropWidth}%;--crop-y:${-100 * panel.y / cropHeight}%"><img src="${h(src)}" width="${width}" height="${height}" alt="${h(panel.label + '的桌布局部')}" loading="lazy"></div><strong>${panel.label}</strong><p>${panel.reading}</p></div>`).join('')}</div>
<p class="story-source"><a href="${h(paper.url)}">来源与图号 ↗</a> · <a href="${h(paper.licenseUrl)}">CC BY 4.0</a> · 本站只做局部裁剪显示。</p></figure>`;
}

export function researchRecord(selection, h) {
  const { task, inputs, queries, criteria, candidates, recommendation, implementation, boundary, toolActions } = selection;
  const points = (items) => items.map(item => `<li>${h(item)}</li>`).join('');
  return `<div class="fusion-research">
<h3>这次 AI 是怎么选的</h3><p>${h(task)}</p>
<ol class="fusion-flow"><li><strong>项目限制进来</strong><ul>${points(inputs)}</ul></li><li><strong>AI 检索和比较</strong><ul>${criteria.map(item => `<li><b>${h(item.name)}</b>　${h(item.question)}</li>`).join('')}</ul></li><li><strong>选中可验证的方向</strong><p>${h(recommendation)}</p></li></ol>
<p class="artifact-scroll-hint">横向滑动可查看候选的证据、资源和取舍。</p>
<div class="selection-table" role="region" aria-label="AI 候选比较" tabindex="0"><table><caption>实际调研得到的候选比较</caption><thead><tr><th scope="col">候选和原文</th><th scope="col">论文证据</th><th scope="col">接口和资源</th><th scope="col">风险与取舍</th></tr></thead>
<tbody>${candidates.map(item => `<tr><th scope="row"><a href="${h(item.source)}">${h(item.name)} ↗</a><small>${h(item.locator)}</small></th><td>${h(item.evidence)}</td><td>${h(item.interfaceFit)}<br>${h(item.resources)}</td><td>${h(item.risks)}<br><b>${h(item.decision)}</b></td></tr>`).join('')}</tbody></table></div>
<p>${h(implementation)}</p><p class="note">${h(boundary)}</p>
<details class="artifact-reference"><summary>查看本次检索式与核对记录</summary><ul>${points(queries)}</ul><ol>${points(toolActions)}</ol></details></div>`;
}

export function fusionFlow() {
  return `<figure class="story-figure fusion-diagram"><figcaption><strong>方案迁移的两条路径</strong></figcaption>
<div class="fusion-branches"><div class="fusion-branch"><h3>论文路径</h3><ol class="fusion-flow"><li><strong>带噪图 + 噪声强度图</strong></li><li><strong>FFDNet 模型推理</strong></li><li><strong>论文输出</strong><p>图 5 比较模型输入条件。</p></li></ol></div>
<div class="fusion-branch"><h3>本次已运行的教学路径</h3><ol class="fusion-flow"><li><strong>同输入的弱、强输出</strong><p>两路结果冻结。</p></li><li><strong>推理后融合</strong><p>固定权重和分区权重从同一输入比较。</p></li><li><strong>同坐标评估</strong><p>暗墙、木纹、灯芯和接缝写入报告。</p></li></ol></div></div>
<p>教学路径里的弱、强两路由固定滤波器产生，权重图由已知场景区域生成。下一轮才用真实图像和设备验证。</p></figure>`;
}

export function revisionRecord(record, h) {
  return `<section id="revision" class="story-chapter"><h2>AI 交付与人工修订记录</h2><p>${h(record.scope)}</p>
<ol class="revision-list">${record.rows.map(row => `<li><h3>${h(row.label)}</h3><p>${h(row.evidence)}</p><p><b>结果</b>　${h(row.result)}</p></li>`).join('')}</ol>
<p class="note">${h(record.limits)}</p></section>`;
}

const fusionPath = 'experiments/tea-shop/';
const metrics = {
  wall_mae: ['暗墙 MAE', '灰度级'], wall_residual_std: ['暗墙残差标准差', '灰度级'],
  wood_mae: ['木纹 MAE', '灰度级'], wood_contrast_ratio: ['木纹反差保留率', '比值'],
  lamp_mae: ['灯区 MAE', '灰度级'], lamp_peak_loss: ['灯芯峰值损失', '灰度级'],
  seam_excess_step_mae: ['过渡区横向梯度误差', '灰度级'], global_mae: ['全图 MAE', '灰度级'],
};

export function fusionImage(base, name, alt, caption, h) {
  const src = base + fusionPath + name;
  return `<figure class="story-figure fusion-image"><a href="${src}"><img src="${src}" decoding="async" loading="lazy" alt="${h(alt)}"></a><figcaption>${h(caption)} <a href="${src}">放大查看 ↗</a></figcaption></figure>`;
}

export function fusionResults(result, h) {
  const number = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Missing fusion measurement');
    return value.toFixed(3);
  };
  const rows = Object.entries(metrics).map(([id,[label,unit]]) => `<tr><th scope="row">${label}</th><td>${number(result.metrics.global[id])}</td><td>${number(result.metrics.mean_matched[id])}</td><td>${number(result.metrics.spatial[id])}</td><td>${unit}</td></tr>`).join('');
  const gates = result.gates.map(gate => `<tr><th scope="row">${metrics[gate.metric]?.[0] || h(gate.metric)}</th><td>${number(gate.candidate)}</td><td>${h(gate.op)} ${number(gate.limit)}</td><td>${gate.passed ? '通过' : '未过'}</td></tr>`).join('');
  const meanWeight = h(result.diagnostics.mean_matched.strong_weight);
  return `<figure class="story-figure"><figcaption><strong>同一次运行 · ${h(result.experiment_id)}</strong><p>${result.all_gates_pass ? '通过教学门槛' : '有门槛未通过'}</p></figcaption>
<div class="selection-table" role="region" aria-label="固定与分区融合指标" tabindex="0"><table><thead><tr><th scope="col">指标</th><th scope="col">固定 50%</th><th scope="col">同平均权重固定融合</th><th scope="col">分区融合</th><th scope="col">单位</th></tr></thead><tbody>${rows}</tbody></table></div>
<p>中间列把每个像素的强支路权重固定为分区权重图的全图均值 ${meanWeight}%。比较中间列和右列，可以查看同样的平均权重放在不同位置会怎样。下列门槛按实验协议仍使用固定 50% 作为对照。</p>
<div class="selection-table" role="region" aria-label="预设验收门槛" tabindex="0"><table><thead><tr><th scope="col">预设检查</th><th scope="col">分区结果</th><th scope="col">要求</th><th scope="col">判定</th></tr></thead><tbody>${gates}</tbody></table></div>
<p>数值展示三位小数，判定取未舍入值。统计来自同一合成帧上的像素与局部。</p></figure>`;
}

export function fusionLinks(base) {
  const src = base + fusionPath;
  return `<div class="actions fusion-links"><a class="button primary" href="${src}demo.html">打开同一实验的 Demo ↗</a><a class="button secondary" href="${src}report.md" download>下载报告</a><a class="button secondary" href="${src}result.json" download>下载机器可读结果</a><a class="button secondary" href="${base}downloads/p4.zip" download>下载完整复现包</a></div>`;
}
