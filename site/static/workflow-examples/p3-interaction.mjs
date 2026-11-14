const scenarios = {
  'dark-flat': { label: '暗墙 · 平坦区噪声', knob: '噪声上限', format: '±', levels: [0, 4, 8, 12, 16] },
  'fine-texture': { label: '木纹 · 细纹理受扰', knob: '噪声上限', format: '±', levels: [0, 4, 8, 12, 16] },
  'highlight-clipping': { label: '灯边 · 高光截断', knob: '加亮偏移', format: '+', levels: [0, 8, 16, 32, 40, 64] },
};

function createPair(width, height, scenario, strength, noise) {
  const reference = Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    if (scenario.reference === 'texture') return 72 + 32 * ((x + y) % 2);
    if (scenario.reference === 'highlight') return Math.min(255, 188 + 4 * x);
    return 32;
  });
  const input = reference.map((value, index) => Math.max(0, Math.min(255, value + (
    scenario.reference === 'highlight' ? strength : (noise?.[index] ?? 0)
  ))));
  return { reference, input };
}

const encodePgm = (width, height, pixels) => {
  const rows = Array.from({ length: height }, (_, y) => pixels.slice(y * width, (y + 1) * width).join(' '));
  return `P2\n${width} ${height}\n255\n${rows.join('\n')}\n`;
};

async function hash(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function download(text, name, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function draw(canvas, width, height, pixels) {
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  for (const [index, value] of pixels.entries()) image.data.set([value, value, value, 255], 4 * index);
  context.putImageData(image, 0, 0);
}

export async function mountWorkflow(root) {
  const [config, noise] = await Promise.all([
    fetch(root.dataset.fixture),
    fetch(new URL('./p3-noise.json', import.meta.url)),
  ]).then(responses => Promise.all(responses.map(response => {
    if (!response.ok) throw new Error('Could not load data generator fixtures');
    return response.json();
  })));

  const { width, height } = config;
  root.classList.add('sample-studio');
  root.innerHTML = `<div class="study-board">
    <div class="study-controls">
      <label>复现哪类缺口<select data-studio-case></select></label>
      <label>随机种子<select data-studio-seed></select></label>
      <label><span data-studio-knob></span><select data-studio-strength></select></label>
    </div>
    <div class="study-pair">
      <figure><div class="study-pixels"><canvas width="${width}" height="${height}" role="img" aria-label="参考图"></canvas><span aria-hidden="true"></span></div><figcaption>参考 · 保留真值</figcaption></figure>
      <figure><div class="study-pixels"><canvas width="${width}" height="${height}" role="img" aria-label="应用退化后的图"></canvas><span aria-hidden="true"></span></div><figcaption>退化输入 · 交给候选算法</figcaption></figure>
    </div>
    <div class="study-inspector">
      <label>检查列 <input type="range" min="0" max="${width - 1}" value="${Math.floor(width / 2)}" data-studio-x></label>
      <label>检查行 <input type="range" min="0" max="${height - 1}" value="${Math.floor(height / 2)}" data-studio-y></label>
    </div>
    <p class="study-status" data-studio-pixel></p>
    <dl class="study-metrics">
      <div><dt>像素改动数</dt><dd data-studio-changed></dd></div>
      <div><dt>饱和像素数</dt><dd data-studio-saturated></dd></div>
      <div><dt>与参考图的 MAE</dt><dd data-studio-mae></dd></div>
    </dl>
    <p class="study-note" data-studio-reading></p>
    <div class="study-downloads">
      <button type="button" class="button" data-download="reference">下载参考 PGM</button>
      <button type="button" class="button" data-download="input">下载退化 PGM</button>
      <button type="button" class="button" data-download="manifest">下载清单 JSON</button>
    </div>
    <p class="study-note" data-studio-download-status role="status"></p>
  </div>`;

  const find = (selector) => root.querySelector(selector);
  const mode = find('[data-studio-case]');
  const seed = find('[data-studio-seed]');
  const strength = find('[data-studio-strength]');
  const x = find('[data-studio-x]');
  const y = find('[data-studio-y]');
  const [left, right] = root.querySelectorAll('canvas');
  let current;
  const renderPoint = () => {
    const row = Number(y.value);
    const column = Number(x.value);
    const index = row * width + column;
    root.querySelectorAll('.study-pixels > span').forEach(marker => {
      marker.style.setProperty('--point-x', `${column / width * 100}%`);
      marker.style.setProperty('--point-y', `${row / height * 100}%`);
      marker.style.setProperty('--point-w', `${100 / width}%`);
      marker.style.setProperty('--point-h', `${100 / height}%`);
    });
    find('[data-studio-pixel]').textContent = `坐标 (${column}, ${row}) · ${current.reference[index]} → ${current.input[index]} 灰度级`;
  };

  function render() {
    const scenario = config.scenarios.find(item => item.id === mode.value);
    const seedValue = Number(seed.value);
    const level = Number(strength.value);
    const pair = createPair(width, height, scenario, level, noise[seedValue]?.[level]);
    const delta = pair.reference.map((value, index) => Math.abs(value - pair.input[index]));
    const saturated = pair.input.filter(value => value === 255).length;
    current = { ...pair, scenario, seedValue, level, saturated };
    draw(left, width, height, pair.reference);
    draw(right, width, height, pair.input);
    find('[data-studio-changed]').textContent = `${delta.filter(Boolean).length} / ${delta.length}`;
    find('[data-studio-saturated]').textContent = `${saturated} / ${delta.length}`;
    find('[data-studio-mae]').textContent = (delta.reduce((sum, value) => sum + value, 0) / delta.length).toFixed(2);
    const reading = scenario.reference === 'highlight'
      ? '把检查列移到右端。达到 255 的输入像素会丢失参考图中的灰度差，不能靠降噪恢复。'
      : '换种子会换一张噪声图，参考图保持一致。对比两个版本时记下种子和强度，避免把换样本误读为算法改善。';
    find('[data-studio-reading]').textContent = reading;
    renderPoint();
  }

  function selectScenario() {
    const configItem = config.scenarios.find(item => item.id === mode.value);
    const optionData = scenarios[mode.value];
    seed.replaceChildren(...configItem.seeds.map(value => new Option(String(value), String(value))));
    seed.disabled = configItem.seeds.length === 1;
    strength.replaceChildren(...optionData.levels.map(value => new Option(`${optionData.format}${value} 灰度级`, String(value))));
    strength.value = String(configItem.reference === 'highlight' ? configItem.offset : configItem.noise);
    find('[data-studio-knob]').textContent = optionData.knob;
    render();
  }

  mode.replaceChildren(...config.scenarios.map(item => new Option(scenarios[item.id].label, item.id)));
  mode.addEventListener('change', selectScenario);
  for (const control of [seed, strength]) control.addEventListener('change', render);
  for (const control of [x, y]) control.addEventListener('input', renderPoint);
  for (const canvas of [left, right]) canvas.addEventListener('click', event => {
    const rect = canvas.getBoundingClientRect();
    x.value = Math.min(width - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * width)));
    y.value = Math.min(height - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * height)));
    renderPoint();
  });
  root.querySelectorAll('[data-download]').forEach(button => button.addEventListener('click', async () => {
    const { scenario, seedValue, level, reference, input, saturated } = current;
    const fileBase = `${scenario.id}-${seedValue}-${level}`;
    const first = encodePgm(width, height, reference);
    const second = encodePgm(width, height, input);
    if (button.dataset.download === 'reference') return download(first, `${fileBase}-reference.pgm`, 'image/x-portable-graymap');
    if (button.dataset.download === 'input') return download(second, `${fileBase}-input.pgm`, 'image/x-portable-graymap');
    const status = find('[data-studio-download-status]');
    button.disabled = true;
    try {
      const payload = {
        scenario: scenario.id,
        seed: seedValue,
        width,
        height,
        reference_pattern: scenario.reference,
        noise_bound: scenario.reference === 'highlight' ? 0 : level,
        offset: scenario.reference === 'highlight' ? level : 0,
        reference: `${fileBase}-reference.pgm`,
        input: `${fileBase}-input.pgm`,
        reference_sha256: await hash(first),
        input_sha256: await hash(second),
        saturated_pixels: saturated,
      };
      download(JSON.stringify([payload], null, 2) + '\n', `${fileBase}-manifest.json`, 'application/json');
      status.textContent = `已生成 ${fileBase} 清单。`;
    } catch {
      status.textContent = '当前浏览环境无法计算 SHA-256。可从本地任务包生成清单。';
    } finally {
      button.disabled = false;
    }
  }));
  selectScenario();
}
