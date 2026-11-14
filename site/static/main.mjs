const storageKey = 'ai-rnd-training.v1.completed';
function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return new Set(Array.isArray(saved) ? saved.filter(id => /^[ABC]\d+$/.test(id)) : []);
  } catch {
    return new Set();
  }
}

const completed = readProgress();
for (const badge of document.querySelectorAll('[data-course-state]')) {
  if (completed.has(badge.dataset.courseState)) {
    badge.textContent = '✓';
    badge.setAttribute('aria-label', '已学');
  }
}
for (const mark of document.querySelectorAll('[data-complete]')) {
  const id = mark.dataset.complete;
  const status = document.querySelector('[data-save-message]');
  function render() {
    mark.setAttribute('aria-pressed', String(completed.has(id)));
    mark.textContent = completed.has(id) ? '✓ 已学 · 撤销' : '标记已学';
  }
  mark.hidden = false;
  render();
  mark.addEventListener('click', () => {
    const updated = new Set(completed);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...updated]));
      completed.clear();
      updated.forEach(value => completed.add(value));
      status.textContent = completed.has(id) ? '已保存到当前浏览器。' : '已撤销学习标记。';
      render();
    } catch {
      status.textContent = '浏览器限制了本地存储，进度未保存。';
    }
  });
}

const search = document.querySelector('[data-course-search]');
if (search) {
  const groups = [...document.querySelectorAll('[data-course-group]')];
  const count = document.querySelector('[data-course-count]');
  const empty = document.querySelector('[data-empty]');
  search.addEventListener('input', () => {
    const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let total = 0;
    for (const group of groups) {
      let visible = 0;
      for (const card of group.querySelectorAll('[data-course-card]')) {
        const text = (card.textContent + ' ' + (card.dataset.keywords ?? '')).toLocaleLowerCase();
        card.hidden = !terms.every(term => text.includes(term));
        if (!card.hidden) visible += 1;
      }
      group.hidden = visible === 0;
      total += visible;
    }
    count.textContent = `${total} 门课程`;
    empty.hidden = total > 0;
  });
}

const processes = document.querySelectorAll('[data-process]');
if (processes.length) {
  const { mountProcess } = await import('./process.mjs');
  for (const root of processes) mountProcess(root, root.dataset.process);
}
const casePrompt = document.querySelector('.case-prompt');
if (casePrompt) {
  const { mountCasePrompt } = await import('./case-guide.mjs');
  mountCasePrompt(casePrompt);
}
const workflowSwitch = document.querySelector('[data-workflow-switch]');
if (workflowSwitch) {
  const buttons = [...workflowSwitch.querySelectorAll('button')];
  const panels = document.querySelectorAll('[data-workflow-panel]');
  function show(active) {
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.workflowSubset === active));
    for (const panel of panels) panel.hidden = panel.dataset.workflowPanel !== active;
  }
  for (const button of buttons) button.addEventListener('click', () => show(button.dataset.workflowSubset));
  show('dev');
  workflowSwitch.hidden = false;
}
