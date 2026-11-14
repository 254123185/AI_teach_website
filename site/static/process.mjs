const scenarios = {
  missing: {
    label: '数据路径缺失', log: 'FileNotFoundError: /data/runs/noise/train.csv',
    action: '核对数据路径', observation: '配置指向 /data/runs/noise，运行机没有挂载该目录。',
    result: '等待数据挂载。挂载后先做一次文件读取检查，再决定是否重跑。',
  },
  memory: {
    label: '显存不足', log: 'CUDA out of memory: tried to allocate 1.20 GiB',
    action: '核对显存记录', observation: '失败前显存逼近上限，日志同时记录 batch size 从 4 改到了 8。',
    result: '先用原 batch size 做短程对照。当前记录支持检查显存和配置，仍需对照确认原因。',
  },
  unknown: {
    label: '日志不完整', log: 'worker exited with code 1',
    action: '寻找 worker 日志', observation: '只留下主进程的退出码，worker 日志没有归档。',
    result: '暂停并索要 worker 日志或复现条件，已有信息不足以选择修复。',
  },
};

function agentSteps(key, mode) {
  const scenario = scenarios[key];
  const start = [
    ['接到任务', '目标是查明这次训练为什么停。先做只读检查。', 'task: diagnose training stop'],
    ['读训练日志', '找到最后一条报错，保留它的原文。', scenario.log],
  ];
  if (mode === 'workflow') return [
    ...start, ['查配置路径', '这条固定流程总是先核对数据路径。', key === 'missing' ? scenario.observation : '配置中的数据目录可以读取。'],
    ['查显存记录', '接着按脚本查看显存记录。遇到路径问题也会执行这一检查。', key === 'memory' ? scenario.observation : '已归档的记录没有显存不足的提示。'],
    ['交付检查清单', scenario.result, '报告保留两项检查与尚未确认的条件'],
  ];
  return [
    ...start, ['选择下一步', `根据这条日志，选择「${scenario.action}」。`, scenario.action],
    [scenario.action, scenario.observation, '只读工具返回观察'],
    ['写下结论', scenario.result, '保留证据与下一步'],
  ];
}

const harnessSteps = [
  ['提交训练', '发送任务和幂等键。调度器登记任务，但网络在响应返回前断开。', 'request key: noise-exp-17 → run #042'],
  ['连接中断', '客户端尚未收到 run ID。仅凭请求报错，无法判断训练是否开始。', 'response: lost'],
  ['用原键重试', '恢复后使用同一个键提交相同请求。调度器返回既有任务。', 'noise-exp-17 → run #042'],
  ['继续读进度', '从上次确认的事件位置继续读取。客户端按事件编号忽略重复交付。', 'event cursor 8 → 9 → 10'],
  ['验收产物', '用评测结果和产物路径判断是否完成。检查点还能用于恢复未完成的计算。', 'run #042 / metrics.json / checkpoint'],
];

const searchSteps = [
  ['固定评价', '先锁定基线、开发集、保留集和评价器。保留集只在最后打开。', '预算：最多跑 3 个候选'],
  ['建立基线', '记录开发集基线 78 分。A、B、C 三个候选使用同样的输入和评价。', 'baseline dev: 78'],
  ['筛选候选', '开发集上 A 82、B 85、C 83。按预先约定选 B 做独立验证。', 'dev: A 82 / B 85 / C 83'],
  ['打开保留集', '保留集是没参与选择的一组输入。基线 79 分，B 只有 77 分。', 'holdout: baseline 79 / B 77'],
  ['留下结论', '开发集的领先没有延续到保留集。这轮保留基线，并记录下一次要查的退化场景。', '结论：暂未验证候选收益'],
];

export function mountProcess(root, id) {
  const agent = id === 'A9';
  root.className = 'process';
  root.innerHTML = `
    ${agent ? `<div class="process-config"><label>训练故障<select data-scenario>${Object.entries(scenarios).map(([value, scenario]) => `<option value="${value}">${scenario.label}</option>`).join('')}</select></label>
    <label>执行方式<select data-mode><option value="agent">Agent 按线索选步骤</option><option value="workflow">Workflow 按固定顺序</option></select></label></div>` : ''}
    <ol class="process-steps" aria-label="演示步骤"></ol>
    <div class="process-readout" role="status"><strong></strong><p></p><small></small></div>
    <div class="process-controls"><button type="button" class="button primary" data-play>播放</button><button type="button" class="button" data-prev>上一步</button><button type="button" class="button" data-next>下一步</button><button type="button" class="button" data-reset>重置</button></div>`;
  const stepList = root.querySelector('.process-steps');
  const label = root.querySelector('.process-readout strong');
  const description = root.querySelector('.process-readout p');
  const observed = root.querySelector('.process-readout small');
  const play = root.querySelector('[data-play]');
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  const scenario = root.querySelector('[data-scenario]');
  const mode = root.querySelector('[data-mode]');
  let steps;
  let index = 0;
  let timer;

  function render() {
    stepList.replaceChildren(...steps.map(([name], position) => {
      const node = document.createElement('li');
      node.textContent = `${position + 1} · ${name}`;
      if (position === index) node.setAttribute('aria-current', 'step');
      if (position < index) node.className = 'done';
      return node;
    }));
    const [name, detail, evidence] = steps[index];
    label.textContent = `${index + 1} / ${steps.length} · ${name}`;
    description.textContent = detail;
    observed.textContent = evidence;
    play.textContent = timer ? '暂停' : index === steps.length - 1 ? '重播' : '播放';
    prev.disabled = index === 0;
    next.disabled = index === steps.length - 1;
  }
  function pause() {
    clearInterval(timer);
    timer = undefined;
  }
  function restart() {
    pause();
    steps = agent ? agentSteps(scenario.value, mode.value) : id === 'A11' ? harnessSteps : searchSteps;
    index = 0;
    render();
  }
  function move(amount) {
    pause();
    index = Math.min(steps.length - 1, Math.max(0, index + amount));
    render();
  }

  scenario?.addEventListener('change', restart);
  mode?.addEventListener('change', restart);
  root.querySelector('[data-reset]').addEventListener('click', restart);
  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && timer) { pause(); render(); }
  });
  play.addEventListener('click', () => {
    if (timer) {
      pause();
    } else {
      if (index === steps.length - 1) index = 0;
      timer = setInterval(() => {
        index += 1;
        if (index === steps.length - 1) pause();
        render();
      }, 2050);
    }
    render();
  });
  restart();
}
