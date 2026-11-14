const bilateralPaper = 'https://users.cs.duke.edu/~tomasi/papers/tomasi/tomasiIccv98.pdf';
const quantizationGuide = 'https://onnxruntime.ai/docs/performance/quantization';

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function bilateral(values, center, range) {
  const weights = values.map((value, index) => {
    const distance = (index - center) / 1.25;
    const difference = (value - values[center]) / range;
    return Math.exp(-(distance ** 2 + difference ** 2) / 2);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const normalized = weights.map(weight => weight / total);
  const value = values.reduce((sum, sample, index) => sum + sample * normalized[index], 0);
  return { value, normalized };
}

function mountPaper(root) {
  root.innerHTML = `
    <p class="demo-intro">切换公式、代码和测试，观察灰度尺度如何改变跨边缘的权重。</p>
    <div class="demo-buttons" role="group" aria-label="查看公式、代码或测试">
      <button type="button" data-mode="formula" aria-pressed="true">公式</button>
      <button type="button" data-mode="code" aria-pressed="false">代码</button>
      <button type="button" data-mode="tests" aria-pressed="false">测试</button>
    </div>
    <div class="demo-detail" data-paper-view>
      <div data-panel="formula">
        <p class="demo-math">输出 = Σ(邻居灰度 × 邻居权重) / Σ(邻居权重)</p>
        <p>权重由两个高斯因子相乘。一个看位置离中心有多远，另一个看灰度与中心差多少。下方取一行五个像素，两个因子都保留。</p>
      </div>
      <div data-panel="code" hidden>
        <pre class="demo-code"><code>for (const [i, gray] of pixels.entries()) {
  const d = (i - center) / spatialSigma;
  const r = (gray - pixels[center]) / rangeSigma;
  const w = Math.exp(-(d ** 2 + r ** 2) / 2);
  numerator += w * gray;
  denominator += w;
}
return numerator / denominator;</code></pre>
        <p>把位置差和灰度差各除以自己的尺度，再计算权重。最终要除以权重总和，否则常量输入也会变暗或变亮。</p>
      </div>
      <div data-panel="tests" hidden>
        <p>先验证常量区域。输入全是 96，输出应仍是 96。再换成台阶边缘，把灰度尺度调小，看看跨边缘像素的权重如何变化。</p>
        <p data-paper-test-result></p>
      </div>
    </div>
    <div class="demo-controls">
      <label>输入样例
        <select data-pixels>
          <option value="edge">台阶边缘</option><option value="flat">常量区域</option><option value="noise">平坦区域轻微起伏</option>
        </select></label>
      <label>灰度尺度 σᵣ <output data-paper-range-output></output>
        <input data-paper-range type="range" min="5" max="160" value="30" step="1"></label>
    </div>
    <div class="demo-pixel-row" data-pixel-row aria-label="五个输入像素和各自归一化权重"></div>
    <p class="demo-result" data-paper-result aria-live="polite"></p>
    <p class="demo-caption">示意依据 Tomasi 和 Manduchi 的原论文第 2 节式 (5)–(6)。页面把二维灰度滤波化成一维窗口。可对照论文图 1 的边缘示例。<a href="${bilateralPaper}">Bilateral Filtering for Gray and Color Images（ICCV 1998，原论文）</a></p>`;

  const inputs = {
    edge: [53, 59, 62, 190, 196],
    flat: [96, 96, 96, 96, 96],
    noise: [93, 101, 96, 103, 90],
  };
  const select = root.querySelector('[data-pixels]');
  const slider = root.querySelector('[data-paper-range]');
  function render() {
    const values = inputs[select.value];
    const range = Number(slider.value);
    const { value, normalized } = bilateral(values, 2, range);
    const uniform = bilateral(inputs.flat, 2, range).value;
    const edge = bilateral(inputs.edge, 2, range);
    const weightAcross = edge.normalized[3] + edge.normalized[4];
    root.querySelector('[data-paper-range-output]').textContent = range;
    root.querySelector('[data-pixel-row]').innerHTML = values.map((sample, index) => `
      <div class="demo-pixel${index === 2 ? ' demo-pixel-center' : ''}">
        <span class="demo-swatch" style="--swatch:rgb(${sample},${sample},${sample})"></span>
        <strong>${sample}</strong><small>${index === 2 ? '中心 · ' : ''}${formatNumber(100 * normalized[index], 1)}%</small>
      </div>`).join('');
    root.querySelector('[data-paper-result]').textContent = `中心像素 ${values[2]} → ${formatNumber(value)}。百分比是每个像素对输出的归一化权重。`;
    root.querySelector('[data-paper-test-result]').textContent = `常量测试输出 ${formatNumber(uniform)}，与预期的 96 一致。台阶测试中，跨边缘两个像素合计权重为 ${formatNumber(100 * weightAcross, 3)}%。`;
  }
  const buttons = root.querySelectorAll('[data-mode]');
  buttons.forEach(button => button.addEventListener('click', () => {
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    root.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== button.dataset.mode; });
  }));
  select.addEventListener('change', render);
  slider.addEventListener('input', render);
  render();
}

const candidates = [
  { title: '固定基线', note: '原预处理和固定阈值', cost: 0, dev: 0.720, test: 0.710 },
  { title: '轻去噪', note: '去掉零散纹理响应', cost: 1, dev: 0.764, test: 0.755 },
  { title: '亮度归一化', note: '减少曝光差异', cost: 2, dev: 0.802, test: 0.790 },
  { title: '局部自适应阈值', note: '允许暗区和亮区分别判定', cost: 2, dev: 0.817, test: 0.781 },
  { title: '局部阈值 + 强去噪', note: '组合当前开发集上分数最高的改动', cost: 3, dev: 0.851, test: 0.706 },
  { title: '边缘保留预处理', note: '约束纹理区域的平滑幅度', cost: 2, dev: 0.829, test: 0.806 },
];

function mountExperiments(root) {
  root.innerHTML = `
    <p class="demo-intro">调整预算。锁定候选后，对照基线查看独立集结果。</p>
    <div class="demo-controls">
      <label>开发预算 <output data-budget-output></output>
        <input data-budget type="range" min="0" max="10" value="5" step="1"></label>
      <button class="demo-action" data-run-test type="button">锁定候选并查看独立验证</button>
      <button data-reset-experiment type="button" hidden>重新开始</button>
    </div>
    <div class="demo-table-wrap"><table class="demo-table">
      <caption>按表中顺序运行候选。下一项超出剩余预算时结束。</caption>
      <thead><tr><th scope="col">候选</th><th scope="col">预算单位</th><th scope="col">开发 F1</th><th scope="col">独立 F1</th></tr></thead>
      <tbody data-candidate-table></tbody>
    </table></div>
    <p class="demo-result" data-experiment-result aria-live="polite"></p>
    <p class="demo-caption">所有分数和成本均为教学设定。F1 将查准率与查全率合成一个分数，本例用它筛选候选。真实项目里，沙盒重开也应使用新的保留数据，避免再次根据同一独立集调整。</p>`;

  const slider = root.querySelector('[data-budget]');
  const runButton = root.querySelector('[data-run-test]');
  const resetButton = root.querySelector('[data-reset-experiment]');
  const baseline = candidates[0];
  let locked = false;

  function render() {
    const budget = Number(slider.value);
    let spent = 0;
    const tried = [];
    let selected = baseline;
    for (const candidate of candidates) {
      if (spent + candidate.cost > budget) break;
      tried.push(candidate);
      spent += candidate.cost;
      if (candidate.dev > selected.dev) selected = candidate;
    }
    root.querySelector('[data-budget-output]').textContent = `${budget} 单位，已用 ${spent}`;
    root.querySelector('[data-candidate-table]').innerHTML = candidates.map(candidate => {
      const eligible = tried.includes(candidate);
      const visible = locked && (candidate === selected || candidate === baseline);
      return `
        <tr${candidate === selected ? ' class="demo-row-selected"' : ''}>
          <th scope="row">${candidate.title}<small>${candidate.note}${candidate === selected ? ' · 当前候选' : ''}</small></th>
          <td>${candidate.cost}</td><td>${eligible ? formatNumber(candidate.dev, 3) : '未运行'}</td>
          <td>${visible ? formatNumber(candidate.test, 3) : '保留'}</td>
        </tr>`;
    }).join('');
    slider.disabled = locked;
    runButton.disabled = locked;
    resetButton.hidden = !locked;
    const conclusion = locked
      ? `独立集上，「${selected.title}」得分 ${formatNumber(selected.test, 3)}，基线 ${formatNumber(baseline.test, 3)}。${selected.test > baseline.test ? '这组样例上有收益。' : '这组样例上没有观察到收益。'}`
      : `目前按开发分数选择「${selected.title}」。试试 5 和 8 单位预算，分别锁定后再打开独立结果。`;
    root.querySelector('[data-experiment-result]').textContent = conclusion;
  }
  slider.addEventListener('input', render);
  runButton.addEventListener('click', () => { locked = true; render(); resetButton.focus(); });
  resetButton.addEventListener('click', () => { locked = false; render(); slider.focus(); });
  render();
}

const frameWidth = 720;
const frameHeight = 390;
const regions = {
  full: { x: 0, y: 0, width: 720, height: 390, note: '看整体前，先比较另外两个区域。整体误差会把暗墙噪声和窗框纹理混在一起。' },
  dark: { x: 30, y: 90, width: 172, height: 160, note: '这块暗墙原本几乎没有纹理。这里的残差适合观察噪声是否减弱。' },
  texture: { x: 494, y: 134, width: 153, height: 138, note: '木板有细密纹理。候选的局部误差变大。切换到参考图，把分割线拖到木板上，看看纹理变了多少。' },
};

function createRaster(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d', { willReadFrequently: true });
}

function imageSamples() {
  const referenceContext = createRaster(frameWidth, frameHeight);
  const gradient = referenceContext.createLinearGradient(0, 0, frameWidth, frameHeight);
  gradient.addColorStop(0, '#1c2330');
  gradient.addColorStop(1, '#48535b');
  referenceContext.fillStyle = gradient;
  referenceContext.fillRect(0, 0, frameWidth, frameHeight);
  referenceContext.fillStyle = '#0e1621';
  referenceContext.fillRect(220, 49, 230, 267);
  referenceContext.fillStyle = '#a0bdc5';
  referenceContext.fillRect(232, 61, 206, 241);
  referenceContext.fillStyle = '#6b8694';
  referenceContext.beginPath();
  referenceContext.moveTo(232, 240);
  referenceContext.lineTo(300, 145);
  referenceContext.lineTo(393, 236);
  referenceContext.lineTo(437, 197);
  referenceContext.lineTo(437, 298);
  referenceContext.lineTo(232, 298);
  referenceContext.fill();
  referenceContext.fillStyle = '#ced4b7';
  referenceContext.beginPath();
  referenceContext.arc(391, 113, 20, 0, 2 * Math.PI);
  referenceContext.fill();
  referenceContext.fillStyle = '#17252f';
  referenceContext.fillRect(330, 60, 10, 245);
  referenceContext.fillRect(232, 190, 206, 10);
  referenceContext.fillStyle = '#292a2e';
  referenceContext.fillRect(0, 321, frameWidth, 69);
  referenceContext.fillStyle = '#1a2026';
  referenceContext.fillRect(479, 108, 183, 215);
  referenceContext.fillStyle = '#79503b';
  referenceContext.fillRect(486, 115, 169, 202);
  for (let y = 118; y < 316; y += 3) {
    referenceContext.strokeStyle = y % 2 ? '#aa7453' : '#614232';
    referenceContext.beginPath();
    referenceContext.moveTo(489, y);
    referenceContext.bezierCurveTo(543, y - 9, 603, y + 8, 652, y - 2);
    referenceContext.stroke();
  }
  const reference = referenceContext.getImageData(0, 0, frameWidth, frameHeight);
  const baseline = referenceContext.createImageData(frameWidth, frameHeight);
  const candidate = referenceContext.createImageData(frameWidth, frameHeight);
  const woodMean = [122, 82, 61];
  let seed = 352;
  for (let y = 0; y < frameHeight; y++) {
    for (let x = 0; x < frameWidth; x++) {
      const index = 4 * (y * frameWidth + x);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = ((seed >>> 16) / 65535 - 0.5) * 27;
      const wood = x >= 486 && x < 655 && y >= 115 && y < 317;
      for (let channel = 0; channel < 3; channel++) {
        const sample = reference.data[index + channel];
        const mean = woodMean[channel];
        baseline.data[index + channel] = sample + noise;
        candidate.data[index + channel] = (wood ? mean + 0.23 * (sample - mean) : sample) + 0.24 * noise;
      }
      baseline.data[index + 3] = candidate.data[index + 3] = 255;
    }
  }
  return { reference, baseline, candidate };
}

function luma(data, offset) {
  return 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
}

function measure(reference, result, region) {
  let squaredError = 0;
  let absoluteError = 0;
  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      const offset = 4 * (y * frameWidth + x);
      const residual = luma(result.data, offset) - luma(reference.data, offset);
      squaredError += residual ** 2;
      absoluteError += Math.abs(residual);
    }
  }
  const count = region.width * region.height;
  const mse = squaredError / count;
  return { mae: absoluteError / count, psnr: mse === 0 ? Infinity : 10 * Math.log10(255 ** 2 / mse) };
}

function mountImage(root) {
  root.innerHTML = `
    <p class="demo-intro">拖动分割线对比降噪效果。切换暗墙和木板两处测量区域。</p>
    <figure class="demo-image-figure">
      <div class="demo-image-stage" data-image-stage>
        <canvas data-image-compare width="${frameWidth}" height="${frameHeight}" role="img" aria-label="合成夜景图像，包含暗墙、窗框和带纹理木板">画面包含暗墙、窗框和带纹理木板。下方表格给出每个选定区域的误差。</canvas>
        <span class="demo-image-label demo-image-label-left" data-left-label>基线</span><span class="demo-image-label demo-image-label-right">候选</span>
        <span class="demo-image-divider" aria-hidden="true"></span>
        <input data-image-split class="demo-image-split" type="range" min="0" max="100" value="50" aria-label="图像对比分割位置">
      </div>
      <figcaption>拖动画面中的白线。也可用 Tab 选中画面后按方向键。</figcaption>
    </figure>
    <div class="demo-controls">
      <label>测量区域（ROI）
        <select data-region><option value="full">整幅画面</option><option value="dark" selected>暗墙</option><option value="texture">木板纹理</option></select>
      </label>
      <label class="demo-check"><input type="checkbox" data-reference> 左侧显示参考图</label>
    </div>
    <div class="demo-table-wrap"><table class="demo-table">
      <caption data-measure-caption></caption>
      <thead><tr><th scope="col">版本</th><th scope="col">亮度 MAE（灰度级）</th><th scope="col">亮度 PSNR（dB）</th></tr></thead>
      <tbody data-image-metrics></tbody>
    </table></div>
    <p class="demo-result" data-image-result aria-live="polite"></p>
    <p class="demo-caption">画面和退化均为教学构造。基线加固定种子的噪声，候选减轻噪声并压低木板纹理。测量取对齐的 8 位像素，用 Rec. 709 系数计算编码亮度 Y′，再与同一区域的干净参考比较。MAE 衡量平均绝对差，PSNR 衡量相对于最大灰度的误差。缺少对齐参考时，先停止使用这两个全参考指标。</p>`;

  const samples = imageSamples();
  const contexts = {};
  for (const [key, sample] of Object.entries(samples)) {
    contexts[key] = createRaster(frameWidth, frameHeight);
    contexts[key].putImageData(sample, 0, 0);
  }
  const canvas = root.querySelector('[data-image-compare]');
  const context = canvas.getContext('2d');
  const split = root.querySelector('[data-image-split]');
  const stage = root.querySelector('[data-image-stage]');
  const select = root.querySelector('[data-region]');
  const reference = root.querySelector('[data-reference]');

  function paint() {
    const position = Math.round(frameWidth * Number(split.value) / 100);
    const left = reference.checked ? contexts.reference : contexts.baseline;
    context.drawImage(contexts.candidate.canvas, 0, 0);
    if (position > 0) context.drawImage(left.canvas, 0, 0, position, frameHeight, 0, 0, position, frameHeight);
    if (select.value !== 'full') {
      const { x, y, width, height } = regions[select.value];
      context.strokeStyle = '#fef7e5';
      context.lineWidth = 3;
      context.setLineDash([8, 5]);
      context.strokeRect(x, y, width, height);
      context.setLineDash([]);
    }
    stage.style.setProperty('--split', `${split.value}%`);
    split.setAttribute('aria-valuetext', `左侧 ${split.value}%，右侧 ${100 - split.value}%`);
    root.querySelector('[data-left-label]').textContent = reference.checked ? '参考' : '基线';
  }

  function showMeasurements() {
    const region = regions[select.value];
    const versions = [['基线', samples.baseline], ['候选', samples.candidate]];
    root.querySelector('[data-measure-caption]').textContent = `测量位置 (${region.x}, ${region.y})，大小 ${region.width} × ${region.height} 像素，两版使用同一参考。`;
    root.querySelector('[data-image-metrics]').innerHTML = versions.map(([label, image]) => {
      const { mae, psnr } = measure(samples.reference, image, region);
      return `<tr><th scope="row">${label}</th><td>${formatNumber(mae)}</td><td>${Number.isFinite(psnr) ? formatNumber(psnr) : '∞'}</td></tr>`;
    }).join('');
    root.querySelector('[data-image-result]').textContent = region.note;
  }

  function movePointer(event) {
    const { left, width } = stage.getBoundingClientRect();
    split.value = String(Math.round(100 * (event.clientX - left) / width));
    paint();
  }
  split.addEventListener('input', paint);
  split.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    split.focus({ preventScroll: true });
    split.setPointerCapture(event.pointerId);
    movePointer(event);
  });
  split.addEventListener('pointermove', event => {
    if (split.hasPointerCapture(event.pointerId)) movePointer(event);
  });
  select.addEventListener('change', () => { paint(); showMeasurements(); });
  reference.addEventListener('change', paint);
  paint();
  showMeasurements();
}

const activationSets = {
  normal: [-0.55, -0.29, -0.12, 0.07, 0.18, 0.35, 0.55, 0.72],
  bright: [-0.34, -0.14, 0.23, 0.42, 0.76, 1.08, 1.52, 1.78],
};

function quantize(value, limit) {
  const scale = limit / 127;
  return Math.min(127, Math.max(-127, Math.round(value / scale))) * scale;
}

function mountQuantization(root) {
  root.innerHTML = `
    <p class="demo-intro">切换输入和量化方案，对照饱和数与输出误差。</p>
    <div class="demo-controls">
      <label>输入场景
        <select data-activation-set><option value="normal">常规输入</option><option value="bright" selected>高亮输入</option></select>
      </label>
      <label>部署方案
        <select data-precision><option value="default">全 INT8，校准范围 ±1</option><option value="wide">全 INT8，校准范围 ±2</option><option value="mixed">激活保留 FP32，其余 INT8</option></select>
      </label>
    </div>
    <figure class="demo-quant-figure">
      <div class="demo-quant-bars" data-quant-bars role="img" aria-label="同一模型浮点与部署方案的输出对比"></div>
      <figcaption>每组是一项输入的模型输出，共八项。深色柱为 FP32，浅色柱为当前部署方案，纵轴范围固定为 0 至 1.6。</figcaption>
    </figure>
    <div class="demo-table-wrap"><table class="demo-table">
      <caption>精度现场计算，时间为教学假设。</caption>
      <thead><tr><th scope="col">激活饱和数</th><th scope="col">输出最大误差</th><th scope="col">假设耗时</th></tr></thead>
      <tbody data-quant-table></tbody>
    </table></div>
    <details class="demo-detail"><summary>查看每个输入的中间量与输出</summary>
      <div class="demo-table-wrap"><table class="demo-table">
        <thead><tr><th scope="col">样本</th><th scope="col">浮点激活</th><th scope="col">部署激活</th><th scope="col">浮点输出</th><th scope="col">部署输出</th><th scope="col">绝对误差</th></tr></thead>
        <tbody data-quant-details></tbody>
      </table></div>
    </details>
    <p class="demo-result" data-quant-result aria-live="polite"></p>
    <p class="demo-caption">构造激活经简单线性层映射到输出，用来展示对称 INT8 量化。假设 FP32 耗时 6.0 ms，两种全 INT8 均为 3.1 ms，混合精度为 4.5 ms。真实项目需要在目标设备上核对算子支持、转换开销和整条链路的时延。<a href="${quantizationGuide}">ONNX Runtime 量化与误差排查</a></p>`;

  const scenario = root.querySelector('[data-activation-set]');
  const precision = root.querySelector('[data-precision]');
  function render() {
    const choice = precision.value;
    const limit = choice === 'wide' ? 2 : 1;
    const time = choice === 'mixed' ? 4.5 : 3.1;
    const values = activationSets[scenario.value];
    const rows = values.map(raw => {
      const deployed = choice === 'mixed' ? raw : quantize(raw, limit);
      const floating = 0.46 + 0.61 * raw;
      const output = 0.46 + quantize(0.61, 0.7) * deployed;
      return { raw, deployed, floating, output, error: Math.abs(output - floating) };
    });
    const saturated = choice === 'mixed' ? 0 : values.filter(value => Math.abs(value) > limit).length;
    const maxError = Math.max(...rows.map(row => row.error));
    root.querySelector('[data-quant-bars]').innerHTML = rows.map(({ floating, output }, index) => `
      <div class="demo-quant-sample" aria-hidden="true">
        <div class="demo-quant-pair">
          <span class="demo-quant-bar demo-quant-float" style="--bar-height:${100 * floating / 1.6}%"></span>
          <span class="demo-quant-bar demo-quant-deployed" style="--bar-height:${100 * output / 1.6}%"></span>
        </div><span>${index + 1}</span>
      </div>`).join('');
    root.querySelector('[data-quant-table]').innerHTML = `<tr><td>${saturated} / ${values.length}</td><td>${formatNumber(maxError, 4)}</td><td>${formatNumber(time, 1)} ms</td></tr>`;
    root.querySelector('[data-quant-details]').innerHTML = rows.map((row, index) => `
      <tr><th scope="row">${index + 1}</th><td>${formatNumber(row.raw, 3)}</td><td>${formatNumber(row.deployed, 3)}</td><td>${formatNumber(row.floating, 3)}</td><td>${formatNumber(row.output, 3)}</td><td>${formatNumber(row.error, 4)}</td></tr>`).join('');
    const conclusion = saturated > 0
      ? `${saturated} 项越过校准范围，被压到可表示的最大值或最小值。换成 ±2，比较最右侧几组柱形。`
      : '所选场景没有越过表示范围。仍有舍入误差。把场景切到常规输入，比较扩大范围对那组数值的影响。';
    root.querySelector('[data-quant-result]').textContent = conclusion;
  }
  scenario.addEventListener('change', render);
  precision.addEventListener('change', render);
  render();
}

const projectDemos = {
  P1: mountPaper,
  P2: mountExperiments,
  P3: mountImage,
  P4: mountQuantization,
};

export function mountProject(root, id) {
  const mount = projectDemos[id];
  if (!mount) return;
  root.classList.add('project-demo');
  mount(root);
}
