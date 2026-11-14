import { filterProfile } from './p2-interaction.mjs';

const methods = new Map([
  ['baseline', '原图基线'],
  ['mean3', '三点均值'],
  ['median3', '三点中值'],
  ['gated', '门控中值'],
]);
const highlight = {
  id: 'bright-point',
  title: '灯边 · 窄点光源反例',
  region: 'highlight',
  reference: [38, 39, 41, 96, 41, 39, 38, 38, 38],
  noisy: [38, 40, 41, 96, 40, 38, 38, 39, 38],
};

function strip(node, pixels) {
  node.replaceChildren(...pixels.map(value => {
    const swatch = document.createElement('span');
    swatch.textContent = String(value);
    swatch.style.setProperty('--level', value);
    swatch.style.setProperty('--label-ink', value < 118 ? '#fff' : '#151d17');
    return swatch;
  }));
}

const averageError = (values, reference) =>
  reference.reduce((sum, value, index) => sum + Math.abs(value - values[index]), 0) / reference.length;

function plot(svg, reference, noisy, after) {
  const floor = Math.max(0, Math.min(...reference, ...noisy, ...after) - 8);
  const ceiling = Math.min(255, Math.max(...reference, ...noisy, ...after) + 8);
  const y = (value) => 132 - 112 * (value - floor) / (ceiling - floor);
  const line = (values) => values.map((value, index) => `${44 + index * 532 / (values.length - 1)},${y(value).toFixed(2)}`).join(' ');
  svg.querySelector('[data-plot-floor]').textContent = floor;
  svg.querySelector('[data-plot-ceiling]').textContent = ceiling;
  svg.querySelector('[data-plot-reference]').setAttribute('points', line(reference));
  svg.querySelector('[data-plot-noisy]').setAttribute('points', line(noisy));
  svg.querySelector('[data-plot-after]').setAttribute('points', line(after));
}

function downloadReview(report) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2) + '\n'], {type:'application/json'}));
  const page = document.createElement('a');
  page.href = url;
  page.download = `denoise-review-${report.caseId}.json`;
  page.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export async function mountWorkflow(root) {
  const response = await fetch(root.dataset.fixture);
  if (!response.ok) throw new Error('Could not load demo fixture');
  const fixture = await response.json();
  const examples = [
    { ...fixture.dev.find(sample => sample.region === 'flat'), id: 'flat-wall', title: '暗墙 · 亮孤点' },
    { ...fixture.dev.find(sample => sample.region === 'detail'), id: 'wood-grain', title: '木纹 · 边缘与细条' },
    highlight,
  ];
  root.classList.add('review-studio');
  root.innerHTML = `<div class="study-board">
    <div class="study-controls">
      <label>评审位置<select data-review-case></select></label>
      <label>B · 候选算子<select data-review-method></select></label>
    </div>
    <figure class="study-chart">
      <svg viewBox="0 0 600 160" role="img" aria-label="参考、输入和候选的灰度剖面对比">
        <path d="M44 20H576M44 76H576M44 132H576" stroke="#d8e3db" fill="none"/>
        <g font-size="15" fill="#355443">
          <text x="5" y="23" data-plot-ceiling></text>
          <text x="5" y="137" data-plot-floor></text>
          <text x="44" y="155">剖面起点</text><text x="576" y="155" text-anchor="end">剖面终点</text>
        </g>
        <polyline data-plot-reference class="study-plot-ref"/>
        <polyline data-plot-noisy class="study-plot-in"/>
        <polyline data-plot-after class="study-plot-out"/>
      </svg>
      <figcaption class="study-legend"><span class="legend-ref">干净参考</span><span class="legend-in">A · 原始输入</span><span class="legend-out">B · 候选输出</span></figcaption>
    </figure>
    <div class="study-strip-group">
      <p>A · 原始输入</p><div class="study-strip" data-review-strip="a" aria-label="原始像素"></div>
      <p>B · 候选输出</p><div class="study-strip" data-review-strip="b" aria-label="候选像素"></div>
    </div>
    <div class="study-inspector"><label>检查像素 <input type="range" min="0" value="0" data-review-point></label></div>
    <p class="study-status" data-review-pixel></p>
    <dl class="study-metrics">
      <div><dt>A · 当前剖面 MAE</dt><dd data-review-mae="a"></dd></div>
      <div><dt>B · 当前剖面 MAE</dt><dd data-review-mae="b"></dd></div>
      <div><dt data-review-gate-label>局部检查</dt><dd data-review-gate></dd></div>
    </dl>
    <p class="study-note" data-review-reading></p>
    <div class="study-downloads">
      <button type="button" class="button" data-review-download>下载当前评审快照</button>
    </div>
  </div>`;

  const from = (selector) => root.querySelector(selector);
  const scene = from('[data-review-case]');
  const method = from('[data-review-method]');
  const point = from('[data-review-point]');
  const chart = from('.study-chart svg');
  const beforeStrip = from('[data-review-strip="a"]');
  const afterStrip = from('[data-review-strip="b"]');
  let selected;
  let result;
  const inspect = () => {
    const index = Number(point.value);
    from('[data-review-pixel]').textContent = `位置 ${index + 1} · 参考 ${selected.reference[index]} · A ${selected.noisy[index]} → B ${result.after[index]}`;
    for (const line of [beforeStrip, afterStrip]) {
      Array.from(line.children).forEach((cell, cellIndex) => cell.classList.toggle('study-active-pixel', cellIndex === index));
    }
  };
  function render(resetInspector) {
    selected = examples.find(example => example.id === scene.value);
    const { reference, noisy, region } = selected;
    const after = filterProfile(noisy, method.value);
    const baselineMae = averageError(noisy, reference);
    const candidateMae = averageError(after, reference);
    const peakIndex = reference.indexOf(Math.max(...reference));
    const peakDrop = reference[peakIndex] - after[peakIndex];
    const peakLimit = 4;
    const threshold = region === 'flat' ? 1 : baselineMae + 0.5;
    const passed = region === 'highlight' ? peakDrop <= peakLimit : candidateMae <= threshold;
    let note = '局部通过。把这条剖面和判据一并放进评审记录，再拿实拍图核对。';
    let gateLabel = region === 'flat' ? '平坦区 MAE ≤ 1' : '细节 MAE ≤ A + 0.5';
    if (region === 'highlight') {
      gateLabel = `灯芯峰值损失 ≤ ${peakLimit}`;
      note = passed
        ? `峰值 ${reference[peakIndex]} → ${after[peakIndex]}。保住这一点只是反例检查通过，下一步还要核对亮灯附近的真实采样。`
        : `峰值 ${reference[peakIndex]} → ${after[peakIndex]}，灯芯被当成孤点压掉。保留这个反例，要求改门控或补高光保护后再评。`;
    } else if (!passed) {
      note = region === 'flat'
        ? '平坦区误差仍高于门槛。把失败位置交给 AI 补成可重复测试，再改候选。'
        : '候选损伤细节。对照剖面中的峰谷，看输出是否把重复细条变成了平坦区。';
    }
    result = {
      caseId: selected.id,
      scope: '仅当前教学剖面，结论不代表真实图像或上线验收',
      candidate: method.value,
      operatorConfig: { window: 3, boundary: 'repeat-edge', gatedNeighborDifferenceMax: 3, gatedCenterThreshold: 16 },
      reference,
      input: noisy,
      after,
      baselineMae,
      candidateMae,
      gate: gateLabel,
      passed,
      nextAction: note,
      ...(region === 'highlight' ? { peakDrop, peakLimit } : { threshold }),
    };
    point.max = String(reference.length - 1);
    if (resetInspector) point.value = String(region === 'highlight' ? peakIndex : Math.floor(reference.length / 2));
    strip(beforeStrip, noisy);
    strip(afterStrip, after);
    plot(chart, reference, noisy, after);
    from('[data-review-mae="a"]').textContent = baselineMae.toFixed(2);
    from('[data-review-mae="b"]').textContent = candidateMae.toFixed(2);
    from('[data-review-gate-label]').textContent = gateLabel;
    const gate = from('[data-review-gate]');
    gate.textContent = passed ? '通过单项检查' : '保留为失败样本';
    gate.dataset.result = passed ? 'pass' : 'fail';
    from('[data-review-reading]').textContent = note;
    inspect();
  }

  scene.replaceChildren(...examples.map(example => new Option(example.title, example.id)));
  method.replaceChildren(...Array.from(methods, ([id, title]) => new Option(title, id)));
  method.value = 'gated';
  scene.addEventListener('change', () => render(true));
  method.addEventListener('change', () => render(false));
  point.addEventListener('input', inspect);
  from('[data-review-download]').addEventListener('click', () => downloadReview(result));
  render(true);
}
