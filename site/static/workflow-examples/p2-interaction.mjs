const methods = {
  baseline: '原图基线',
  mean3: '三点均值',
  median3: '三点中值',
  gated: '门控中值',
};
const areas = { flat: '暗墙', detail: '木纹与边缘' };
const wallGate = 1;
const textureMargin = 0.5;
const defaultThreshold = 16;
const format = value => value.toFixed(2);

export function filterProfile(values, method, threshold = defaultThreshold) {
  return values.map((center, index) => {
    const left = values[Math.max(0, index - 1)];
    const right = values[Math.min(index + 1, values.length - 1)];
    const middle = [left, center, right].sort((a, b) => a - b)[1];
    switch (method) {
      case 'mean3': return Math.round((left + center + right) / 3);
      case 'median3': return middle;
      case 'gated': return Math.abs(left - right) <= 3 && Math.abs(center - middle) >= threshold ? middle : center;
      default: return center;
    }
  });
}

function measure(profiles, method, threshold) {
  const groups = { flat: { sum: 0, n: 0 }, detail: { sum: 0, n: 0 } };
  for (const { region, noisy, reference } of profiles) {
    filterProfile(noisy, method, threshold).forEach((value, index) => {
      groups[region].sum += Math.abs(value - reference[index]);
      groups[region].n += 1;
    });
  }
  const flat = groups.flat.sum / groups.flat.n;
  const detail = groups.detail.sum / groups.detail.n;
  return { flat, detail };
}

export function evaluateProfiles(profiles, methodIds = Object.keys(methods), threshold = defaultThreshold) {
  const baseline = measure(profiles, 'baseline', threshold);
  const detailGate = baseline.detail + textureMargin;
  const rows = methodIds.map(id => {
    const metrics = measure(profiles, id, threshold);
    return { id, ...metrics, passes: metrics.flat <= wallGate && metrics.detail <= detailGate };
  });
  return { rows, detailGate };
}

export function profilePlot({ region, noisy, reference }, output, candidate) {
  const min = Math.floor((Math.min(...noisy, ...reference, ...output) - 5) / 10) * 10;
  const max = Math.ceil((Math.max(...noisy, ...reference, ...output) + 5) / 10) * 10;
  const x = index => 41 + 305 * index / (noisy.length - 1);
  const y = value => 129 - 110 * (value - min) / (max - min);
  const points = values => values.map((value, index) => x(index) + ',' + y(value)).join(' ');
  const grid = [min, (min + max) / 2, max].map(value => `
    <path d="M41 ${y(value)} H346" stroke="#d6e2d9"/>
    <text x="34" y="${y(value) + 3}" text-anchor="end">${value}</text>`).join('');
  const ticks = noisy.map((_, index) => `<text x="${x(index)}" y="145" text-anchor="middle">${index + 1}</text>`).join('');
  const changed = output.flatMap((value, index) => value !== noisy[index]
    ? `<circle cx="${x(index)}" cy="${y(value)}" r="2.8" fill="#16714e" stroke="#fff" stroke-width="1"/>` : []).join('');
  return `<svg viewBox="0 0 360 165" role="img" aria-label="${areas[region]}像素剖面，包含干净参考、原始输入和${methods[candidate]}">
    <g fill="#536b61" font-size="9.5" font-family="system-ui, sans-serif">
      <text x="6" y="12">灰度级</text>${grid}${ticks}
      <text x="346" y="159" text-anchor="end">像素位置</text>
    </g>
    <path d="M41 19 V129 H346" fill="none" stroke="#889d92" stroke-width="1"/>
    <polyline points="${points(reference)}" fill="none" stroke="#244862" stroke-width="2" stroke-dasharray="5 3" stroke-linejoin="round"/>
    <polyline points="${points(noisy)}" fill="none" stroke="#b46037" stroke-width="2" opacity=".85" stroke-linejoin="round"/>
    <polyline points="${points(output)}" fill="none" stroke="#16714e" stroke-width="2.6" stroke-linejoin="round"/>
    ${changed}
  </svg>`;
}

const markup = `
  <style>
    .p2-experiment { min-width: 0; padding: clamp(.7rem, 3vw, 1.25rem); border: 1px solid #c5d8cc; border-radius: .85rem; background: #f5f9f5; }
    .p2-experiment h3 { margin: 0 0 .45rem; }
    .p2-experiment .p2-muted { font-size: .9rem; color: #475f53; }
    .p2-experiment .p2-controls { display: flex; flex-wrap: wrap; gap: .65rem 1rem; margin: .85rem 0; }
    .p2-experiment label { display: flex; flex-direction: column; gap: .2rem; flex: 1 1 150px; min-width: 0; font-size: .92rem; }
    .p2-experiment label > span { font-weight: 650; }
    .p2-experiment select { width: 100%; min-width: 0; font: inherit; color: inherit; border: 1px solid #8da99a; border-radius: .35rem; padding: .38rem .5rem; background: white; }
    .p2-experiment input { width: 100%; margin: .38rem 0; }
    .p2-experiment .p2-plot { margin: .75rem 0; padding: .65rem; background: white; border: 1px solid #d2e1d7; border-radius: .65rem; }
    .p2-experiment .p2-plot svg { display: block; width: 100%; max-width: 620px; margin-inline: auto; }
    .p2-experiment .p2-legend { display: flex; flex-wrap: wrap; gap: .35rem .8rem; font-size: .85rem; }
    .p2-experiment .p2-legend i { display: inline-block; vertical-align: middle; width: 1rem; border-top: 3px solid var(--swatch); margin-right: .3rem; }
    .p2-experiment .p2-legend .p2-dashed { border-top-style: dashed; }
    .p2-experiment .p2-sample { margin-top: .42rem; }
    .p2-experiment .p2-samples { margin-top: .5rem; }
    .p2-experiment .p2-samples summary { cursor: pointer; font-size: .87rem; }
    .p2-experiment .p2-samples p { margin-top: .25rem; overflow-wrap: anywhere; font-size: .84rem; }
    .p2-experiment .p2-numbers { overflow-x: auto; }
    .p2-experiment table { border-collapse: collapse; width: 100%; font-size: .89rem; }
    .p2-experiment th, .p2-experiment td { padding: .48rem .52rem; text-align: start; border-bottom: 1px solid #d2e1d7; }
    .p2-experiment th:first-child { min-width: 5rem; }
    .p2-experiment tbody tr[data-current] { background: #e4efe7; }
    .p2-experiment .p2-good { color: #146044; font-weight: 700; }
    .p2-experiment .p2-no { color: #924521; }
    .p2-experiment .p2-actions { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .75rem; }
    .p2-experiment .p2-status { margin-top: .65rem; }
  </style>
  <h3>候选实验台</h3>
  <p class="p2-muted">改变方案或门控阈值，观察剖面与分区误差。通过开发门槛后可冻结当前设置并复核留出集。</p>
  <div class="p2-controls">
    <label><span>处理方案</span><select data-method>
      <option value="baseline">原图基线</option>
      <option value="mean3">三点均值</option>
      <option value="median3">三点中值</option>
      <option value="gated" selected>门控中值</option>
    </select></label>
    <label><span>像素剖面</span><select data-profile></select></label>
    <label><span>门控触发阈值 · <output data-threshold-value>16</output> 灰度级</span>
      <input type="range" min="8" max="40" value="16" step="1" data-threshold>
    </label>
  </div>
  <figure class="p2-plot">
    <div data-plot></div>
    <figcaption class="p2-legend">
      <span><i class="p2-dashed" style="--swatch:#244862"></i>干净参考</span>
      <span><i style="--swatch:#b46037"></i>原始输入</span>
      <span><i style="--swatch:#16714e"></i>候选输出 · 圆点为已改像素</span>
    </figcaption>
    <p class="p2-muted p2-sample" data-sample></p>
    <details class="p2-samples"><summary>查看图中灰度值</summary>
      <p data-sample-reference></p><p data-sample-input></p><p data-sample-output></p>
    </details>
  </figure>
  <div class="p2-numbers" tabindex="0" role="region" aria-label="候选方案实算结果">
    <p class="p2-muted" data-gates></p>
    <table aria-label="按区域计算的平均绝对误差"><thead>
      <tr><th scope="col">方案</th><th scope="col">暗墙 MAE</th><th scope="col">木纹与边缘 MAE</th><th scope="col">判定</th></tr>
    </thead><tbody></tbody></table>
  </div>
  <div class="p2-actions">
    <button class="button primary" type="button" data-freeze>冻结方案并复核</button>
    <button class="button" type="button" data-download hidden>导出本轮 JSON</button>
    <button class="button" type="button" data-reset>重新开始</button>
  </div>
  <p class="p2-status" role="status"></p>`;

export async function mountWorkflow(root) {
  let fixtures;
  try {
    const response = await fetch(root.dataset.fixture);
    if (!response.ok) throw new Error('Fixture fetch failed');
    fixtures = await response.json();
  } catch {
    root.textContent = '剖面数据加载失败。可刷新重试，或下载任务包复算参考表。';
    return;
  }

  root.classList.add('p2-experiment');
  root.innerHTML = markup;
  const method = root.querySelector('[data-method]');
  const profile = root.querySelector('[data-profile]');
  const threshold = root.querySelector('[data-threshold]');
  const thresholdValue = root.querySelector('[data-threshold-value]');
  const freeze = root.querySelector('[data-freeze]');
  const download = root.querySelector('[data-download]');
  const reset = root.querySelector('[data-reset]');
  const plot = root.querySelector('[data-plot]');
  const sample = root.querySelector('[data-sample]');
  const sampleReference = root.querySelector('[data-sample-reference]');
  const sampleInputValues = root.querySelector('[data-sample-input]');
  const sampleOutput = root.querySelector('[data-sample-output]');
  const gates = root.querySelector('[data-gates]');
  const status = root.querySelector('[role="status"]');
  const body = root.querySelector('tbody');
  let locked = false;
  let report;

  function swapProfiles() {
    const profiles = locked ? fixtures.holdout : fixtures.dev;
    const counts = { flat: 0, detail: 0 };
    profile.replaceChildren(...profiles.map(({ region }, index) => {
      counts[region] += 1;
      return new Option(areas[region] + ' ' + counts[region], String(index));
    }));
  }

  function render() {
    const candidate = method.value;
    const cutoff = Number(threshold.value);
    const split = locked ? 'holdout' : 'dev';
    const profiles = fixtures[split];
    const ids = locked ? ['baseline', candidate] : Object.keys(methods);
    const { rows, detailGate } = evaluateProfiles(profiles, ids, cutoff);
    const chosen = rows.find(row => row.id === candidate);
    const sampleInput = profiles[Number(profile.value)];
    const output = filterProfile(sampleInput.noisy, candidate, cutoff);

    thresholdValue.value = String(cutoff);
    threshold.disabled = locked || candidate !== 'gated';
    method.disabled = locked;
    freeze.disabled = locked || candidate === 'baseline' || !chosen.passes;
    download.hidden = !locked;

    plot.innerHTML = profilePlot(sampleInput, output, candidate);
    const pixelError = output.map((value, index) => Math.abs(value - sampleInput.reference[index]));
    const changedCount = output.filter((value, index) => value !== sampleInput.noisy[index]).length;
    sample.textContent = '该剖面改动 ' + changedCount + ' / ' + output.length + ' 个像素，绝对误差最大值为 ' + Math.max(...pixelError) + '。';
    sampleReference.textContent = '干净参考　' + sampleInput.reference.join('、');
    sampleInputValues.textContent = '原始输入　' + sampleInput.noisy.join('、');
    sampleOutput.textContent = '候选输出　' + output.join('、');
    gates.textContent = (locked ? '留出集' : '开发集') + ' · ' + profiles.length + ' 条剖面。暗墙 ≤ 1.00，木纹与边缘 ≤ ' + format(detailGate) + '。以未舍入值判定。';
    body.innerHTML = rows.map(({ id, flat, detail, passes }) => {
      const fails = [flat > wallGate ? '暗墙' : '', detail > detailGate ? '细节' : ''].filter(Boolean).join('、');
      const verdict = id === 'baseline' ? '参照' : passes ? '过线' : fails + '超线';
      const variant = id === 'baseline' ? '' : passes ? 'p2-good' : 'p2-no';
      return `<tr${id === candidate ? ' data-current' : ''}>
        <th scope="row">${methods[id]}</th><td>${format(flat)}</td><td>${format(detail)}</td><td class="${variant}">${verdict}</td></tr>`;
    }).join('');

    if (locked) {
      status.textContent = chosen.passes ? '留出复核通过，可排入二维实拍验证。' : '留出复核未通过，记录失败条件，保留基线。';
      report = {
        fixture: '八条一维合成灰度剖面',
        selected: candidate,
        gatedThreshold: candidate === 'gated' ? cutoff : null,
        gates: { flat: wallGate, detailAboveBaseline: textureMargin },
        dev: evaluateProfiles(fixtures.dev, Object.keys(methods), cutoff),
        holdout: { rows, detailGate },
        advanceToRealImageValidation: chosen.passes,
      };
    } else if (candidate === 'baseline') {
      status.textContent = '选择一项候选，再决定是否冻结。';
    } else {
      status.textContent = chosen.passes
        ? '当前候选通过两个开发门槛，可冻结后查看留出结果。'
        : '当前候选有指标超线。切换剖面检查孤点与纹理的变化。';
    }
  }

  freeze.addEventListener('click', () => {
    if (freeze.disabled) return;
    locked = true;
    swapProfiles();
    render();
    profile.focus();
  });
  reset.addEventListener('click', () => {
    locked = false;
    report = undefined;
    method.value = 'gated';
    threshold.value = String(defaultThreshold);
    swapProfiles();
    profile.value = '1';
    render();
    method.focus();
  });
  download.addEventListener('click', () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2) + '\n'], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: objectUrl, download: 'p2-comparison.json' });
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  });
  method.addEventListener('change', render);
  profile.addEventListener('change', render);
  threshold.addEventListener('input', render);
  swapProfiles();
  profile.value = '1';
  render();
}
