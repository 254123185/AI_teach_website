const candidates = [
  {
    id: 'regional', name: '分区融合', paper: 'FFDNet · §IV-C、图 5',
    source: 'https://arxiv.org/pdf/1710.04026#page=9', required: ['hook'],
    mechanism: '真值空间噪声图与均值噪声图，分别输入同一网络。论文用的是合成空间变化高斯噪声。可以借用空间控制思路，在现有弱、强输出之间做区域融合。',
    experiment: '用同一张输入及现成弱、强输出。A 用当前全局融合权重，B 只换成分区权重。冻结原模型和两路输出。分区先用人工标注。',
    stop: '暗墙更干净时，木纹低对比细线不能明显消失，掩码边界不能产生亮边或接缝。保留一张有真实小亮点的图查误杀。',
  },
  {
    id: 'calibrated', name: '标定噪声再训练', paper: 'CBDNet · §3.1、§3.4',
    source: 'https://arxiv.org/pdf/1807.04686#page=4', required: ['raw', 'paired', 'train'],
    mechanism: '作者用信号相关噪声和 ISP 合成输入，训练还加入真实噪声图与近似干净图。团队可借用数据配方，针对自己的摄像头测标定参数。',
    experiment: '固定模型、训练步数和验证集。A 使用既有数据，B 加入由标定噪声生成的样本。用未参与拟合的暗墙、木纹、灯边真图配对验证。',
    stop: '若留出的真实相机上纹理或灯边退化，先查标定拟合和 ISP 不匹配。',
  },
  {
    id: 'blindspot', name: '单噪声图自监督', paper: 'Noise2Void · §3.1、图 6',
    source: 'https://arxiv.org/pdf/1811.10980#page=8', required: ['train'],
    mechanism: '该方法用同张噪声图的邻域预测被遮住的中心。给定信号，噪声条件独立且均值为零是论文假设。图 6 展示了结构噪声仍会保留。',
    experiment: '从同设置的几帧平坦暗墙里估算残差的行、列自相关，另外保留真实孤立亮点。条件基本满足后才投入小规模盲点训练，与既有策略同输入对照。',
    stop: '残差有稳定行纹时暂停训练开销。即使没有明显相关性，仍须检查暗弱纹理和孤立亮点是否误抹。',
  },
];

const resourceLabels = {
  hook: '可调融合权重',
  raw: 'RAW 噪声标定',
  paired: '实拍噪声／干净图对',
  train: '小规模训练窗口',
  stripe: '暗墙残差有稳定条纹',
};

function assess(candidate, resources) {
  const missing = candidate.required.filter(resource => !resources[resource]);
  if (missing.length) return { label: '暂缓', reason: `缺少${missing.map(resource => resourceLabels[resource]).join('、')}。`, state: 'blocked' };
  if (candidate.id === 'blindspot') {
    return resources.stripe
      ? { label: '需先查假设', reason: '稳定条纹提示可能存在相关噪声，先查残差相关性。', state: 'check' }
      : { label: '需先查假设', reason: '未见明显行纹仍不足以建立条件独立。先用多帧平坦区域估算残差。', state: 'check' };
  }
  return candidate.id === 'regional'
    ? { label: '可开首轮对照', reason: '已有融合入口和同输入输出，可先做单变量试验。', state: 'ready' }
    : { label: '可开数据支线', reason: '标定、图对与训练窗口已就绪，可与短对照并行验证。', state: 'ready' };
}

export function mountWorkflow(root) {
  root.classList.add('p1-study');
  root.innerHTML = `
<style>
  .p1-study { --p1-border:#cdd8ca; --p1-green:#244d3a; --p1-paper:#fffefa; --p1-quiet:#4c6356; display:grid; gap:.8rem; margin:.8rem 0 1.4rem; }
  .p1-study fieldset,.p1-study .p1-details,.p1-study .p1-evidence { border:1px solid var(--p1-border); border-radius:.85rem; background:var(--p1-paper); padding:.8rem 1rem; min-width:0; margin:0; }
  .p1-study legend { font-weight:700; padding:0 .3rem; }
  .p1-study .p1-toggles,.p1-study .p1-candidates { display:grid; gap:.55rem; grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr)); }
  .p1-study .p1-toggle { display:flex; gap:.45rem; align-items:center; padding:.28rem 0; }
  .p1-study input { width:1rem; height:1rem; flex:none; accent-color:var(--p1-green); }
  .p1-study .p1-candidate { cursor:pointer; background:var(--p1-paper); min-width:0; border:1px solid var(--p1-border); border-radius:.7rem; padding:.7rem; text-align:start; overflow-wrap:anywhere; color:inherit; font:inherit; }
  .p1-study .p1-candidate[aria-pressed=true] { border-color:var(--p1-green); box-shadow:inset 0 0 0 1px var(--p1-green); background:#ecf3e8; }
  .p1-study .p1-badge { display:block; color:var(--p1-quiet); margin:.25rem 0; font-size:.88rem; font-weight:650; }
  .p1-study .p1-badge[data-state=check] { color:#854513; }
  .p1-study .p1-badge[data-state=ready] { color:#216143; }
  .p1-study .p1-reason { display:block; line-height:1.55; color:var(--p1-quiet); font-size:.9rem; }
  .p1-study .p1-details h3,.p1-study .p1-evidence h3 { margin:.15rem 0 .55rem; }
  .p1-study .p1-details p { margin:.45rem 0; }
  .p1-study .p1-chart { display:grid; gap:.48rem; margin:.65rem 0; }
  .p1-study .p1-datum { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.15rem .45rem; align-items:center; }
  .p1-study .p1-bar-track { grid-column:1/-1; border-radius:999px; background:#e6ede4; height:.7rem; overflow:hidden; }
  .p1-study .p1-bar { display:block; width:var(--value); height:100%; background:#436e55; border-radius:999px; }
  .p1-study .p1-bar.alt { background:#b45d34; }
  .p1-study .p1-evidence figcaption,.p1-study .p1-chart-scale { color:var(--p1-quiet); font-size:.85rem; }
  .p1-study .p1-download { margin-top:.6rem; }
  .p1-study .p1-transfer { display:grid; gap:.55rem; margin:.75rem 0 0; padding:.75rem; border-radius:.7rem; background:#edf3e9; }
  .p1-study .p1-transfer p { margin:0; }
  .p1-study .p1-map { display:grid; gap:.35rem; grid-template-columns:repeat(3,minmax(0,1fr)); }
  .p1-study .p1-zone { padding:.35rem .4rem; text-align:center; border:1px solid #c7d6c4; border-radius:.45rem; color:var(--p1-green); font-size:.85rem; }
  .p1-study .p1-zone:first-child { background:#d5ead8; }
  .p1-study .p1-zone:nth-child(2) { background:#f3edd8; }
  .p1-study .p1-zone:last-child { background:#f4e5d7; }
  .p1-study .p1-transfer small { color:var(--p1-quiet); }
</style>
<figure class="p1-evidence">
  <h3>FFDNet 图 5：同一模型，两种噪声图</h3>
  <div class="p1-chart" aria-label="合成实验的 PSNR 对照">
    <div class="p1-datum"><span>真值空间噪声图 (b)</span><strong>30.08 dB</strong><span class="p1-bar-track" aria-hidden="true"><span class="p1-bar" style="--value:85.943%"></span></span></div>
    <div class="p1-datum"><span>均值构成的均匀噪声图 (c)</span><strong>27.45 dB</strong><span class="p1-bar-track" aria-hidden="true"><span class="p1-bar alt" style="--value:78.429%"></span></span></div>
    <div class="p1-chart-scale" aria-hidden="true">条形从 0 dB 起，标尺上限 35 dB。</div>
  </div>
  <figcaption>同一张人工加噪图，噪声幅度随位置变化。真值噪声图在实际项目中通常需要估计。<a href="https://arxiv.org/pdf/1710.04026#page=9">打开原论文图 5</a></figcaption>
  <div class="p1-transfer">
    <p><strong>移到现有管线</strong>　同一输入 → 固定弱、强降噪输出 → 按区给强输出分配融合比例</p>
    <div class="p1-map" aria-label="B 组分区融合权重示意">
      <span class="p1-zone"><strong>暗墙</strong><br>较多强输出</span>
      <span class="p1-zone"><strong>木纹</strong><br>偏向弱输出</span>
      <span class="p1-zone"><strong>灯罩</strong><br>边缘平滑过渡</span>
    </div>
    <small>A 组全图共用一个融合比例。上图是 B 组要验证的控制图，实际比例待测。</small>
  </div>
</figure>
<fieldset>
  <legend>本轮已有的条件</legend>
  <div class="p1-toggles">${Object.entries(resourceLabels).map(([id, label]) => `<label class="p1-toggle"><input type="checkbox" name="${id}" ${id === 'hook' || id === 'stripe' ? 'checked' : ''}>${label}</label>`).join('')}</div>
</fieldset>
<div class="p1-candidates" role="group" aria-label="候选路线">
  ${candidates.map(({id, name}) => `<button type="button" class="p1-candidate" data-p1-candidate="${id}" aria-controls="p1-workflow-details" aria-pressed="false"><strong>${name}</strong><span class="p1-badge"></span><span class="p1-reason"></span></button>`).join('')}
</div>
<div id="p1-workflow-details" class="p1-details">
  <div class="p1-copy" aria-live="polite"></div>
  <button type="button" class="button secondary p1-download">下载这条路线的对照单</button>
</div>`;
  const controls = root.querySelectorAll('input[type="checkbox"]');
  const buttons = root.querySelectorAll('[data-p1-candidate]');
  const details = root.querySelector('.p1-copy');
  let selected = candidates[0];

  function resources() {
    return Object.fromEntries(Array.from(controls, ({ name, checked }) => [name, checked]));
  }

  function update() {
    const conditions = resources();
    for (const [index, candidate] of candidates.entries()) {
      const option = assess(candidate, conditions);
      const button = buttons[index];
      button.setAttribute('aria-pressed', String(candidate === selected));
      const badge = button.querySelector('.p1-badge');
      badge.textContent = option.label;
      badge.dataset.state = option.state;
      button.querySelector('.p1-reason').textContent = option.reason;
    }
    const result = assess(selected, conditions);
    details.innerHTML = `
      <h3>${selected.name} · ${result.label}</h3>
      <p>${result.reason}</p>
      <p><strong>来自论文</strong>　${selected.mechanism}</p>
      <p><strong>拟做的对照</strong>　${selected.experiment}</p>
      <p><strong>停止条件</strong>　${selected.stop}</p>
      <p><a href="${selected.source}">${selected.paper} ↗</a></p>`;
  }

  for (const control of controls) control.addEventListener('change', update);
  for (const [index, button] of buttons.entries()) button.addEventListener('click', () => {
    selected = candidates[index];
    update();
  });
  root.querySelector('.p1-download').addEventListener('click', () => {
    const conditions = resources();
    const result = assess(selected, conditions);
    const checked = Object.entries(conditions).filter(([, yes]) => yes).map(([key]) => resourceLabels[key]).join('、') || '暂无';
    const content = [
      `# 夜景降噪对照单 · ${selected.name}`, '',
      `当前已有：${checked}`, `状态：${result.label}。${result.reason}`, '',
      `论文位置：[${selected.paper}](${selected.source})`, `证据：${selected.mechanism}`, '',
      `拟做的对照：${selected.experiment}`, `停止条件：${selected.stop}`, '',
      '实测结果：待填', '',
    ].join('\n');
    const href = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = `night-denoise-${selected.id}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
  update();
}
