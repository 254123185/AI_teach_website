const P1 = {
  task: '先复现双边滤波的核心计算。五像素窗口只输出中心像素，先确认归一化和边缘权重。',
  prompt: '读取 formula.md、fixtures.json 和 solution.py。实现 bilateral，返回中心值及归一化权重。保留验收测试，运行后报告改动和限制。',
  read: '$ cat fixtures.json\n{"constant":[96,96,96,96,96],"edge":[53,59,62,190,196]}\n\n$ python -m unittest -v\nERROR  NotImplementedError: 实现双边滤波与归一化',
  readNote: 'AI 先读输入约定和失败项，把定位范围缩到中心像素的加权平均。',
  artifact: 'solution.py',
  diff: '-     raise NotImplementedError("实现双边滤波与归一化")\n+     weights = [exp(-0.5 * (((i-center)/spatial_sigma)**2\n+               + ((v-values[center])/range_sigma)**2))\n+               for i, v in enumerate(values)]\n+     normalized = [w / sum(weights) for w in weights]\n+     return sum(v*w for v, w in zip(values, normalized)), normalized',
  changeNote: 'AI 将位置差、灰度差和归一化分别落实到代码。节选展示核心公式。',
  runLabel: '运行常量和台阶检查',
  command: 'python -m unittest -v',
  report: '常量输入保持 96。灰度尺度收窄后，跨边缘像素影响变小。本轮覆盖五像素窗口，二维边界仍待验证。',
  decision: ['批准五像素原型', '宣布已复现论文全部结果'],
  feedback: ['可以批准这段原型。二维处理和论文里的完整实验另行验收。', '本轮只检查一维窗口的两个性质，复现论文还需要二维输入和原始实验条件。'],
  run() {
    const flat = [96, 96, 96, 96, 96];
    const edge = [53, 59, 62, 190, 196];
    const weights = (values, sigma) => values.map((value, index) =>
      Math.exp(-0.5 * (((index - 2) / 1.25) ** 2 + ((value - values[2]) / sigma) ** 2)));
    const sum = (values) => values.reduce((total, value) => total + value, 0);
    const flatWeights = weights(flat, 30);
    const weighted = sum(flat.map((value, index) => value * flatWeights[index]));
    const crossing = (sigma) => {
      const values = weights(edge, sigma);
      return (100 * sum(values.slice(3)) / sum(values)).toFixed(3);
    };
    return [
      `常量输入 96 · 省略归一化：${weighted.toFixed(2)} · 含归一化：${(weighted / sum(flatWeights)).toFixed(2)}`,
      `跨边缘权重 · 灰度尺度 100：${crossing(100)}% · 灰度尺度 30：${crossing(30)}%`,
    ].join('\n');
  },
};

const P2 = {
  task: '缺陷检测需要调预处理和阈值。总预算 8 单位，保留集在锁定方案前不可读取。',
  prompt: '读取 candidates.csv 和开发集评分。按运行顺序累计成本，在预算内输出开发 F1 最高的候选及逐次记录。保存 result.json，保留集由我放行。',
  read: '$ cat candidates.csv\nid,cost,dev_f1\nbaseline,0,0.720\nlight,1,0.764\nnormalize,2,0.802\nlocal,2,0.817\nstrong,3,0.851\nedge,2,0.829',
  readNote: 'AI 只能看到候选开销和开发分数。保留集成绩由单独的验证步骤提供。',
  artifact: 'solution.py',
  diff: '-     raise NotImplementedError("仅用开发记录筛选并冻结候选")\n+     spent, tried = 0, []\n+     for row in candidates:\n+         cost = int(row["cost"])\n+         if spent + cost > budget:\n+             break\n+         spent += cost\n+         tried.append(row)\n+     selected = max(tried, key=lambda row: float(row["dev_f1"]))',
  changeNote: 'AI 将候选筛选封装成独立函数，只传入开发评分和预算。锁定后再把选中项传给独立验证。',
  runLabel: '锁定候选并查看保留集',
  command: 'python solution.py 8',
  resultName: 'result.json',
  report: '开发 F1 从 0.720 升到 0.851，保留 F1 从 0.710 降到 0.706。建议保留基线并检查哪些样本被过度平滑。',
  decision: ['因开发分数高而采用候选', '保留基线并记录退化样本'],
  correct: 1,
  feedback: ['开发集的提升没有延续。此处应保留基线。', '保留基线。下一轮应先查失败样本，最终评价用新的保留数据。'],
  run() {
    const candidates = [
      ['baseline', 0, 0.720, 0.710],
      ['light', 1, 0.764, 0.755],
      ['normalize', 2, 0.802, 0.790],
      ['local', 2, 0.817, 0.781],
      ['strong', 3, 0.851, 0.706],
      ['edge', 2, 0.829, 0.806],
    ];
    let spent = 0;
    const tried = [];
    let selected = candidates[0];
    for (const row of candidates) {
      if (spent + row[1] > 8) break;
      spent += row[1];
      tried.push(row[0]);
      if (row[2] > selected[2]) selected = row;
    }
    return JSON.stringify({
      selected: selected[0], spent, tried,
      holdout_f1: selected[3], baseline_f1: candidates[0][3], adopt: selected[3] > candidates[0][3],
    }, null, 2);
  },
};

const P3 = {
  task: '一版更强的降噪让暗墙更干净。需要检查木纹有没有被一并抹掉。',
  prompt: '读取已对齐的 baseline.pgm、candidate.pgm 和 reference.pgm。分别测暗墙和木板相对参考图的 MAE，输出 roi-report.json。区分观察、测量与原因假设。',
  read: '$ head -n 4 reference.pgm\nP2\n8 2\n255\n30 30 30 30  70 100 70 100\n\n从 task.md 确认 ROI：暗墙 (0,0,4,2)，木纹 (4,0,4,2)',
  readNote: 'AI 检查文件的版本关系、图像尺寸和区域。只有三幅图使用相同坐标时才做像素比较。',
  artifact: 'solution.py',
  diff: '-     raise NotImplementedError("计算相同 ROI 的逐像素 MAE")\n+     x, y, width, height = roi\n+     total = sum(abs(reference[row][col] - image[row][col])\n+                 for row in range(y, y + height)\n+                 for col in range(x, x + width))\n+     return total / (width * height)',
  changeNote: '工具对两版图使用相同坐标。AI 补齐区域内逐像素误差的计算，检查越界条件后写报告。',
  runLabel: '复算两处分区误差',
  command: 'python solution.py',
  resultName: 'roi-report.json',
  report: '教学样本里暗墙 MAE 降低，木纹 MAE 升高。只改降噪强度做一组对照，用同样的区域复算。',
  decision: ['按暗墙结果批准候选', '保留两处结果，补一项对照'],
  correct: 1,
  feedback: ['暗墙的改善不足以覆盖木纹退化，发布前需要再查细节损失。', '用同一输入只调整降噪强度，能够检查误差是否随该参数变化。'],
  run() {
    const values = [
      ['wall', [30, 30, 30, 30, 30, 30, 30, 30], [36, 24, 36, 24, 24, 36, 24, 36], [31, 29, 31, 29, 29, 31, 29, 31]],
      ['texture', [70, 100, 70, 100, 100, 70, 100, 70], [76, 94, 76, 94, 94, 76, 94, 76], [82, 88, 82, 88, 88, 82, 88, 82]],
    ];
    const mae = (reference, samples) => reference.reduce((sum, value, index) =>
      sum + Math.abs(value - samples[index]), 0) / reference.length;
    return JSON.stringify({
      baseline: Object.fromEntries(values.map(([label, reference, baseline]) => [label, mae(reference, baseline)])),
      candidate: Object.fromEntries(values.map(([label, reference, , candidate]) => [label, mae(reference, candidate)])),
    }, null, 2);
  },
};

const P4 = {
  task: '模型转成 INT8 后高亮样本的输出误差变大。先找发生截断的张量，再决定在哪台设备上补测。',
  prompt: '用相同的 activations.csv 比较 INT8 范围 ±1 和 ±2。只改激活量化范围，保存 quant-report.json。缺少设备日志时请把设备耗时标为待测。',
  read: '$ cat activations.csv\nactivation\n-0.34\n-0.14\n0.23\n0.42\n0.76\n1.08\n1.52\n1.78\n\n现用激活范围：[-1, 1]',
  readNote: 'AI 从样本中找到 3 个超出当前范围的高亮值，先用单变量对照验证截断。',
  artifact: 'solution.py',
  diff: '-     raise NotImplementedError("计算饱和计数和输出误差")\n+     deployed = [quantize(x, limit) for x in values]\n+     weight = quantize(0.61, 0.7)\n+     max_error = max(abs(0.61 * raw - weight * q)\n+                     for raw, q in zip(values, deployed))\n+     saturated = sum(abs(x) > limit for x in values)',
  changeNote: 'AI 固定激活样本和位宽，计算截断次数和浮点输出的最大偏差。耗时留待目标机测量。',
  runLabel: '运行两种范围的误差检查',
  command: 'python solution.py',
  resultName: 'quant-report.json · 节选',
  report: '放宽到 ±2 后，这 8 个值不再饱和。部署前还要核对代表性输入、算子回退、质量和目标端到端时延。',
  decision: ['保留方案并在目标设备测量', '把误差改善当作端侧加速'],
  feedback: ['可进入目标机测量。先记录同批输入、算子支持和端到端时延。', '更低的量化误差只能支持质量判断，设备耗时仍需实测。'],
  run() {
    const values = [-0.34, -0.14, 0.23, 0.42, 0.76, 1.08, 1.52, 1.78];
    const quantize = (value, limit) => {
      const scale = limit / 127;
      const integer = Math.min(127, Math.max(-127, Math.round(value / scale)));
      return integer * scale;
    };
    const weight = quantize(0.61, 0.7);
    const report = [1, 2].map(limit => {
      const error = Math.max(...values.map(value =>
        Math.abs(0.61 * value - weight * quantize(value, limit))));
      const clipped = values.filter(value => Math.abs(value) > limit).length;
      return [limit, { saturated: clipped, max_error: Number(error.toFixed(4)) }];
    });
    return JSON.stringify(Object.fromEntries(report), null, 2);
  },
};

const sessions = { P1, P2, P3, P4 };
const stages = [
  ['01', '工程师', '提交任务'],
  ['02', 'AI · 读取', '检查材料'],
  ['03', 'AI · 编辑', '提出改动'],
  ['04', '工具', '运行检查'],
  ['05', '工程师', '验收结果'],
];

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function appendArtifact(parent, label, text, isDiff = false) {
  const panel = element('div', 'session-artifact');
  const code = element('code');
  if (isDiff) {
    for (const [index, line] of text.split('\n').entries()) {
      if (index > 0) code.append('\n');
      const kind = line.startsWith('+ ') ? 'session-added' : 'session-removed';
      code.append(element('span', kind, line));
    }
  } else {
    code.textContent = text;
  }
  const pre = element('pre');
  pre.append(code);
  panel.append(element('p', 'session-artifact-label', label), pre);
  parent.append(panel);
  return panel;
}

export function mountCaseSession(root, id) {
  const fixture = sessions[id];
  if (!fixture) return;
  root.classList.add('case-session');
  const nav = element('div', 'session-timeline');
  nav.setAttribute('role', 'group');
  nav.setAttribute('aria-label', '运行步骤');
  const view = element('div', 'session-view');
  view.tabIndex = -1;
  const outputLive = element('span', 'session-live');
  outputLive.setAttribute('role', 'status');
  outputLive.setAttribute('aria-live', 'polite');
  const controls = element('div', 'session-controls');
  const previous = element('button', 'button secondary', '上一步');
  const next = element('button', 'button primary', '下一步');
  const restart = element('button', 'button secondary', '重置');
  for (const button of [previous, next, restart]) button.type = 'button';
  controls.append(previous, next, restart);
  root.append(
    element('p', 'session-context', '示例回放。AI 的读写记录与建议预先编排。验证按钮在浏览器里重跑教学检查。'),
    nav, view, controls, outputLive,
  );

  let current = 0;
  let output = '';
  let decision = null;
  const steps = stages.map(([number, owner, title], index) => {
    const button = element('button', 'session-step');
    button.type = 'button';
    button.append(element('span', 'session-step-owner', `${number} · ${owner}`), element('strong', '', title));
    button.addEventListener('click', () => setStep(index));
    nav.append(button);
    return button;
  });

  previous.addEventListener('click', () => setStep(current - 1));
  next.addEventListener('click', () => setStep(current + 1));
  restart.addEventListener('click', () => {
    output = '';
    decision = null;
    setStep(0);
  });

  function showResult() {
    const toolButton = element('button', 'button primary', output ? '重新运行检查' : fixture.runLabel);
    toolButton.type = 'button';
    toolButton.addEventListener('click', () => {
      output = fixture.run();
      render();
      view.querySelector('.session-artifact:last-child').focus();
      outputLive.textContent = '检查结束，已显示输出。';
    });
    view.append(toolButton);
    appendArtifact(view, '本地对应命令', '$ ' + fixture.command);
    if (output) appendArtifact(view, fixture.resultName || '浏览器检查结果', output).tabIndex = -1;
  }

  function showReview() {
    appendArtifact(view, 'AI 报告 · 示例', fixture.report);
    const choices = element('div', 'session-review-options');
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', '工程师验收决定');
    for (const [index, label] of fixture.decision.entries()) {
      const option = element('button', 'button secondary', label);
      option.type = 'button';
      option.setAttribute('aria-pressed', String(index === decision));
      option.addEventListener('click', () => {
        decision = index;
        render();
        view.querySelectorAll('.session-review-options button')[index].focus();
        outputLive.textContent = fixture.feedback[index];
      });
      choices.append(option);
    }
    view.append(choices);
    if (decision !== null) {
      const isCorrect = decision === (fixture.correct ?? 0);
      view.append(element('p', isCorrect ? 'session-review-answer' : 'session-review-answer session-review-caution', fixture.feedback[decision]));
    }
  }

  function render() {
    const [, owner, title] = stages[current];
    view.replaceChildren(element('h3', 'session-view-title', `${owner} · ${title}`));
    switch (current) {
      case 0:
        view.append(element('p', 'session-detail', fixture.task));
        appendArtifact(view, '交给本地 Agent 的任务', fixture.prompt);
        break;
      case 1:
        view.append(element('p', 'session-detail', fixture.readNote));
        appendArtifact(view, 'AI 的读取记录 · 示例', fixture.read);
        break;
      case 2:
        view.append(element('p', 'session-detail', fixture.changeNote));
        appendArtifact(view, fixture.artifact + ' · 改动节选', fixture.diff, true);
        break;
      case 3:
        view.append(element('p', 'session-detail', '查看工具输出，再决定是否采纳建议。'));
        showResult();
        break;
      case 4:
        showReview();
        break;
    }
    steps.forEach((step, index) => {
      step.setAttribute('aria-pressed', String(index === current));
      step.disabled = index === 4 && !output;
    });
    previous.disabled = current === 0;
    next.disabled = current === 4 || (current === 3 && !output);
  }

  function setStep(index) {
    if (index < 0 || index >= stages.length || (index === 4 && !output)) return;
    current = index;
    render();
    view.focus({ preventScroll: true });
    outputLive.textContent = `第 ${index + 1} 步，${stages[index][2]}。`;
  }
  render();
}
