const candidates = [
  {
    id: 'regional', name: '局部强度 · FFDNet', paper: 'FFDNet · §IV-C、图 5',
    source: 'https://arxiv.org/html/1710.04026v2#S4.F5', required: ['hook'],
    mechanism: '同一个 FFDNet 分别读入逐位置的噪声标准差图和一张常量图。本算例沿用这个对照思路，把能调的量换成强档占比。',
    check: '读图 5(b) 与 (c) 的图注，确认 (c) 的常量取自 (b) 的噪声图均值。接着看 §IV-D 中欠降噪和过度平滑各在何时出现。',
    experiment: '两路输出固定。A 全图用 50% 强档，B 按区域调强档占比。再用 B 的平均占比做一组常量对照，检查同样的平均占比分配到不同位置会怎样。',
    stop: '木纹细线明显变淡、灯芯被压暗，或边界冒出亮边，都值得暂停。保留对应位置的两路输出，方便排查。',
    decision: '先试分区权重。用正式 A/B 判断是否过线，再用同均值对照检查权重放置位置的影响。',
  },
  {
    id: 'transition', name: '融合边界 · Mertens', paper: 'Exposure Fusion · §3.2、图 4',
    source: 'https://www.tommertens.com/old-academic/papers/exposure_fusion_reduced.pdf#page=5',
    mechanism: '论文给对齐的多曝光图逐位置加权。权重陡变会留接缝，模糊权重又可能带来光晕。',
    check: '先看图 4(b) 的接缝，再到 (c) 的相同位置找光晕。§3.2 说明了曝光亮度差和权重变化为什么会一起造成这些问题。',
    experiment: '保留两路输出和各区内部权重，单独改变过渡宽度。用同一块裁剪看接缝、光晕和穿过边界的细纹。',
    stop: '拉宽过渡后若出现光晕或真边缘变糊，记下位置，退回上一档宽度。',
    decision: '把图 4 的反例放进分区融合的验收。多尺度合成要等接口允许更换合成器时再比较。',
  },
  {
    id: 'calibrated', name: '标定噪声再训练 · CBDNet', paper: 'CBDNet · §3.1、§3.4',
    source: 'https://arxiv.org/pdf/1807.04686#page=5', required: ['raw', 'paired', 'train'],
    mechanism: '作者按信号强弱和相机处理流程生成训练噪声，并把合成图与实拍噪声图对一起用于训练。',
    check: '查 §3.4 为什么在合成批次之外加入真实图对。回到 §3.1 的式 (2)–(3)，标出相机响应、去马赛克和 JPEG 分别在哪一步进入。',
    experiment: '可以调整上游时，固定模型、训练步数和验证集，只给 B 增加按相机标定生成的样本。暗墙、木纹和灯芯用未参与拟合的实拍图对验证。',
    stop: '留出实拍的纹理或灯边退化时，先检查标定误差和合成时的相机流程。',
    decision: '待上游接口、配对样本和训练窗口都具备，再比较这条训练路线。',
  },
  {
    id: 'blindspot', name: '单噪声图自监督 · Noise2Void', paper: 'Noise2Void · §3.1、§4.4、图 6',
    source: 'https://arxiv.org/pdf/1811.10980#page=8', required: ['train'],
    mechanism: '训练时遮住中心像素，让模型用周围像素预测它。方法依赖噪声的条件独立与零均值，图 6 显示了部分结构噪声会留下来。',
    check: '看图 6 的 (a) 和 (c)，找去噪后仍在的棋盘纹。回到 §3.1，核对式 (3) 的条件独立和式 (4) 的零均值假设。',
    experiment: '同一相机设置下拍几帧平坦暗墙，用残差检查行、列方向的相关性。条件基本满足时再做小规模训练，另留带细纹和孤立亮点的样本比较。',
    stop: '发现稳定行纹，先查相机残差。若模型抹掉暗弱纹理或真实小亮点，同样要停下来复查。',
    decision: '主案例没有训练窗口。若下一轮可以训练，先用多帧暗墙检查盲点预测的噪声假设。',
  },
];

const resourceLabels = {
  hook: '可调融合权重',
  raw: 'RAW 噪声标定',
  paired: '实拍噪声／干净图对',
  train: '小规模训练窗口',
  stripe: '新样本有稳定条纹',
};

function assess(candidate, resources) {
  if (candidate.id === 'transition') {
    return resources.hook
      ? { label: '用来检查过渡带', reason: '沿边界取一块固定裁剪，对比接缝和光晕。', state: 'check' }
      : { label: '先读失败图', reason: '没有权重接口时，仍可用图 4 确定过渡带该查什么。', state: 'blocked' };
  }
  const missing = candidate.required.filter(resource => !resources[resource]);
  if (missing.length) return { label: '暂缓', reason: `缺少${missing.map(resource => resourceLabels[resource]).join('、')}。`, state: 'blocked' };
  if (candidate.id === 'blindspot') {
    return resources.stripe
      ? { label: '先查残差', reason: '稳定条纹提示噪声可能相关，用多帧暗墙样本核对。', state: 'check' }
      : { label: '先查残差', reason: '条纹条件尚未给出，仍需要用多帧平坦区域检查相关性。', state: 'check' };
  }
  return candidate.id === 'regional'
    ? { label: '可以先试', reason: '已有融合接口，两路结果可以直接用于同输入对照。', state: 'ready' }
    : { label: '可评估训练方案', reason: '假设资源已补齐，接着确认上游是否允许改动。', state: 'check' };
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
  .p1-study [data-p1-download-status]:empty { display:none; }
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
  <h3>同一个 FFDNet，换一张噪声图</h3>
  <div class="p1-chart" aria-label="合成实验的 PSNR 对照">
    <div class="p1-datum"><span>真值空间噪声图 (b)</span><strong>30.08 dB</strong><span class="p1-bar-track" aria-hidden="true"><span class="p1-bar" style="--value:85.943%"></span></span></div>
    <div class="p1-datum"><span>均值构成的均匀噪声图 (c)</span><strong>27.45 dB</strong><span class="p1-bar-track" aria-hidden="true"><span class="p1-bar alt" style="--value:78.429%"></span></span></div>
    <div class="p1-chart-scale" aria-hidden="true">条形从 0 dB 起，标尺上限 35 dB。</div>
  </div>
  <figcaption>原图 5 的合成输入有已知噪声图。实拍时要另外估计噪声。<a href="https://arxiv.org/html/1710.04026v2#S4.F5">打开原论文图 5</a></figcaption>
  <div class="p1-transfer">
    <p><strong>本算例如何借用</strong>　固定两路降噪输出，只按位置改变强档占比。</p>
    <div class="p1-map" aria-label="B 组分区融合权重示意">
      <span class="p1-zone"><strong>暗墙</strong><br>较多强输出</span>
      <span class="p1-zone"><strong>木纹</strong><br>偏向弱输出</span>
      <span class="p1-zone"><strong>灯芯</strong><br>偏向弱输出</span>
    </div>
    <small>正文的 A 组全图取 50% 强档，B 组按区调整，在交界附近平滑过渡。</small>
  </div>
</figure>
<fieldset>
  <legend>用假设条件试筛论文路线</legend>
  <p>默认带入主案例的条件，只开放融合权重。勾选其他条件可以试着改变选型，再点一条路线看原文依据和拟做的对照。</p>
  <div class="p1-toggles">${Object.entries(resourceLabels).map(([id, label]) => `<label class="p1-toggle"><input type="checkbox" name="${id}" ${id === 'hook' ? 'checked' : ''}>${label}</label>`).join('')}</div>
</fieldset>
<div class="p1-candidates" role="group" aria-label="候选路线">
  ${candidates.map(({id, name}) => `<button type="button" class="p1-candidate" data-p1-candidate="${id}" aria-controls="p1-workflow-details" aria-pressed="false"><strong>${name}</strong><span class="p1-badge"></span><span class="p1-reason"></span></button>`).join('')}
</div>
<div id="p1-workflow-details" class="p1-details">
  <div class="p1-copy" aria-live="polite"></div>
  <button type="button" class="button secondary p1-download">下载所选路线的对照单（Markdown）</button>
  <p class="p1-reason" data-p1-download-status role="status"></p>
</div>`;
  const controls = root.querySelectorAll('input[type="checkbox"]');
  const buttons = root.querySelectorAll('[data-p1-candidate]');
  const details = root.querySelector('.p1-copy');
  const downloadStatus = root.querySelector('[data-p1-download-status]');
  let selected = candidates[0];

  function resources() {
    return Object.fromEntries(Array.from(controls, ({ name, checked }) => [name, checked]));
  }

  function update() {
    downloadStatus.textContent = '';
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
      <p><strong>论文里的做法</strong>　${selected.mechanism}</p>
      <p><strong>读原文时核对</strong>　${selected.check}</p>
      <p><strong>拟做的对照</strong>　${selected.experiment}</p>
      <p><strong>停止条件</strong>　${selected.stop}</p>
      <p><strong>主案例当时的取舍</strong>　${selected.decision}</p>
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
      `# 低照度图像降噪对照单 · ${selected.name}`, '',
      `本次演示所选条件：${checked}`, `试筛结果：${result.label}。${result.reason}`, '',
      `论文位置：[${selected.paper}](${selected.source})`, `证据：${selected.mechanism}`, `读原文时核对：${selected.check}`, '',
      `拟做的对照：${selected.experiment}`, `停止条件：${selected.stop}`, `主案例当时的取舍：${selected.decision}`, '',
      '实测结果：待填', '',
    ].join('\n');
    const href = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = `low-light-denoise-${selected.id}.md`;
    link.click();
    downloadStatus.textContent = `已请求下载 ${link.download}，文件包含所选条件和试筛结果。`;
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
  update();
}
