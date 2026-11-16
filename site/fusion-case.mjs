import { filterProfile, profilePlot } from './static/workflow-examples/p2-interaction.mjs';

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
  return `<figure class="story-figure paper-reading"><figcaption><strong>Barbara 测试图的桌布局部</strong>
<p>从 (a) 找到桌布上的细条，再看其他三格保留了哪些条纹。各格取自论文原图中相同的位置，放大倍率一致。</p></figcaption>
<div class="paper-crop-grid">${texturePanels.map(panel => `<div><div class="paper-crop" style="--crop-ratio:${cropWidth}/${cropHeight};--source-width:${100 * width / cropWidth}%;--crop-x:${-100 * panel.x / cropWidth}%;--crop-y:${-100 * panel.y / cropHeight}%"><img src="${h(src)}" width="${width}" height="${height}" alt="${h(panel.label + '的桌布局部')}" loading="lazy"></div><strong>${panel.label}</strong><p>${panel.reading}</p></div>`).join('')}</div>
<p class="story-source"><a href="${h(paper.url)}">Zhang 等，图 6</a> · <a href="${h(paper.licenseUrl)}">文章许可 CC BY 4.0</a></p></figure>`;
}

export function researchRecord(selection, h) {
  const { criteria, queries, candidates, toolActions } = selection;
  const points = (items) => items.map(item => `<li>${h(item)}</li>`).join('');
  return `<div class="fusion-research">
<h3>先看能不能接进项目，再看论文指标</h3>
<ol class="deep-flow">${criteria.map(item => `<li><strong>${h(item.name)}</strong><p>${h(item.question)}</p></li>`).join('')}</ol>
<h3>AI 整理的原文证据卡</h3>
<ul class="paper-notes">${candidates.map(item => `<li><h4><a href="${h(item.source)}">${h(item.name)}</a></h4><p>${h(item.decision)}</p><details><summary>${h(item.locator)}</summary><p>${h(item.evidence)}</p><p>${h(item.interfaceFit)} ${h(item.resources)}</p><p>${h(item.risks)}</p></details></li>`).join('')}</ul>
<details class="artifact-reference"><summary>检索词与原文核对记录</summary><ul>${points(queries)}</ul><ol>${points(toolActions)}</ol></details></div>`;
}

export function denoiseOpening(base) {
  const path = base + fusionPath;
  return `<figure class="opening-images"><div class="opening-grid">
<a href="${path}weak.png"><img src="${path}weak.png" width="128" height="80" alt="弱降噪输出，墙面仍有颗粒，木百叶纹路清楚"><span>弱降噪</span></a>
<a href="${path}strong.png"><img src="${path}strong.png" width="128" height="80" alt="强降噪输出，墙面较平整，木百叶纹路变淡"><span>强降噪</span></a>
</div><figcaption>同一张合成图。左侧是暗墙，中间是木百叶，右侧是灯芯。两张图采用相同的灰度标尺。</figcaption></figure>`;
}

export function pairedSample(base) {
  const path = base + fusionPath;
  return `<figure class="opening-images"><div class="opening-grid">
<a href="${path}reference.png"><img src="${path}reference.png" width="128" height="80" loading="lazy" alt="预先绘制的干净参考，有暗墙、木百叶和灯芯"><span>干净参考</span></a>
<a href="${path}noisy.png"><img src="${path}noisy.png" width="128" height="80" loading="lazy" alt="同坐标含噪图，暗墙的亮暗起伏明显"><span>同坐标含噪输入</span></a>
</div><figcaption>生成器先画参考，再从同一坐标生成含噪图。左图保留用于评分。暗墙的灰度起伏可追到加噪，木百叶的纹理和灯芯早在参考图里就有。</figcaption></figure>`;
}

export function caseHandoff(handoff, h) {
  return `<section class="artifact-reference case-handoff"><h3>${h(handoff.title)}</h3>
<p>${h(handoff.intro)}</p>
<figure class="deep-code"><figcaption>${h(handoff.artifactTitle)}</figcaption><pre><code>${h(handoff.artifact)}</code></pre></figure>
<dl class="case-contract"><div><dt>工程师怎么验</dt><dd>${h(handoff.check)}</dd></div><div><dt>少做哪些重复工作</dt><dd>${h(handoff.saved)}</dd></div></dl></section>`;
}

export function profileEvidence(development) {
  const cases = [
    [development[0], 'gated', '暗墙第 4 点', '在平坦邻域里，门控中值把 73 改为 42，回到参考附近。'],
    [development[1], 'median3', '木纹第 6 点', '普通中值把输入的 104 压到 95，低于参考。门控阈值为 16 时，这个峰会留下。'],
  ];
  return `<figure class="story-figure profile-evidence"><figcaption><strong>同一种局部起伏，处理之前先看它出现在哪里</strong><p>横轴是剖面里的像素位置，纵轴为灰度级。蓝色虚线是参考，橙线是输入，绿点标出候选改动。两图灰度范围各自标在纵轴上。</p></figcaption>
<div class="foundation-compare">${cases.map(([profile, method, label, note]) => `<div><h4>${label}</h4>${profilePlot(profile, filterProfile(profile.noisy, method), method)}<p>${note}</p></div>`).join('')}</div></figure>`;
}

export function blindSpotCheck() {
  return `<figure class="story-figure fusion-diagram"><figcaption><strong>灯芯移动时，先核对它落在权重图的哪里</strong><p>待验证的反例。下图说明下一轮该怎么取样，暂无对应实验读数。</p></figcaption>
<ol class="deep-flow"><li><strong>旧位置</strong><p>灯芯在右侧灯区，强档权重 0.08。</p></li><li><strong>换样本</strong><p>灯芯移到左侧，以原权重图运行时会落进 0.85 的强档区。</p></li><li><strong>复核</strong><p>记下灯芯新坐标、两版亮度和遗失的细节。有干净参考再量亮度损失。</p></li></ol></figure>`;
}

export function controlReview(base, result) {
  return `<figure class="story-figure fusion-diagram"><figcaption><strong>三种权重，回答两个问题</strong></figcaption>
<dl class="comparison-key"><div><dt>固定 50% 与分区融合</dt><dd>和预定的全图权重相比，分区融合能否同时满足四处的画质要求？</dd></div>
<div><dt>固定 ${result.diagnostics.mean_matched.strong_weight}% 与分区融合</dt><dd>全图平均权重相同时，暗墙和木纹的差异还有多少？</dd></div></dl>
<p><a href="${base + fusionPath}demo.html#matched">查看暗墙的同均值对照</a></p></figure>`;
}

export function fusionFlow() {
  return `<figure class="story-figure fusion-diagram"><figcaption><strong>两种控制量各用在什么位置</strong></figcaption>
<div class="fusion-branches"><div class="fusion-branch"><h3>FFDNet 图 5</h3><ol class="fusion-flow"><li><strong>带噪图和噪声图</strong></li><li><strong>FFDNet 推理</strong></li><li><strong>降噪图</strong></li></ol></div>
<div class="fusion-branch"><h3>低照度合成样本</h3><ol class="fusion-flow"><li><strong>同一输入，分别做弱降噪和强降噪</strong></li><li><strong>用权重图混合两张输出</strong></li><li><strong>融合图</strong></li></ol></div></div>
<p>噪声图是模型的输入，记录各处的噪声水平。融合权重图记录各处强降噪输出的占比，用于混合两路输出。</p></figure>`;
}

export function revisionRecord(record, h) {
  return `<details id="revision" class="artifact-reference editorial-history"><summary>案例编写与修订记录</summary><p>${h(record.scope)}</p>
<ol class="revision-list">${record.rows.map(row => `<li><h3>${h(row.label)}</h3><p>${h(row.evidence)}</p><p>${h(row.result)}</p></li>`).join('')}</ol>
<p><a href="https://github.com/254123185/AI_teach_website/compare/94fc28f...8eb61f9">查看当时的仓库修订 ↗</a> · <a href="#research">核对候选表</a> · <a href="#experiment">核对补上的比较</a></p>
<p class="note">${h(record.limits)}</p></details>`;
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

export function inspectFusionRegions(base) {
  const demo = base + fusionPath + 'demo.html';
  return `<ul class="fusion-proof-links" aria-label="打开对应的评审证据">
  <li><a href="${demo}#wood">木纹是否保住</a></li>
  <li><a href="${demo}#wall">暗墙残噪是否下降</a></li>
  <li><a href="${demo}#lamp">灯芯是否变暗</a></li>
  <li>过渡带是否出现接缝 <a href="${demo}#seam1">看左侧</a> · <a href="${demo}#seam2">看右侧</a></li>
</ul>`;
}
