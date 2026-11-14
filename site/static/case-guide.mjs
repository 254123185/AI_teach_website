export function mountCaseFlow(root) {
  const steps = [...root.querySelectorAll('[data-case-step]')];
  const panels = [...root.querySelectorAll('[data-case-panel]')];
  const controls = root.querySelector('[data-case-controls]');
  const play = root.querySelector('[data-tour-play]');
  const next = root.querySelector('[data-tour-next]');
  let index = 0;
  let timer;

  function render() {
    steps.forEach((step, position) => {
      const active = index === position;
      step.setAttribute('aria-pressed', String(active));
      panels[position].toggleAttribute('data-inactive', !active);
    });
    play.textContent = timer ? '暂停' : index === steps.length - 1 ? '重播' : '播放';
    next.disabled = index === steps.length - 1;
  }
  function stop() {
    clearInterval(timer);
    timer = undefined;
  }
  function show(position) {
    stop();
    index = position;
    render();
  }

  for (const [position, step] of steps.entries()) {
    step.hidden = false;
    step.addEventListener('click', () => show(position));
  }
  const evidence = root.querySelector('.case-evidence');
  evidence.classList.add('is-interactive');
  evidence.setAttribute('aria-live', 'polite');
  controls.hidden = false;
  next.addEventListener('click', () => show(index + 1));
  root.querySelector('[data-tour-reset]').addEventListener('click', () => show(0));
  play.addEventListener('click', () => {
    if (timer) {
      stop();
    } else {
      if (index === steps.length - 1) index = 0;
      timer = setInterval(() => {
        index += 1;
        if (index === steps.length - 1) stop();
        render();
      }, 3200);
    }
    render();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && timer) { stop(); render(); }
  });
  render();
}

export function mountCasePrompt(root) {
  const copy = root.querySelector('[data-copy-case]');
  const source = root.querySelector('[data-copy-source]');
  const status = root.querySelector('[data-copy-status]');
  if (!navigator.clipboard?.writeText) return;
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(source.textContent);
      status.textContent = '已复制。';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(source);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = '已选中文字，请手动复制。';
    }
  });
}
