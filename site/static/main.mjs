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

for (const quiz of document.querySelectorAll('[data-quiz]')) {
  const feedback = quiz.querySelector('[data-quiz-feedback]');
  quiz.addEventListener('change', () => { feedback.hidden = true; });
  quiz.addEventListener('submit', event => {
    event.preventDefault();
    const correct = new FormData(quiz).get('option') === quiz.dataset.answer;
    feedback.hidden = false;
    feedback.dataset.correct = String(correct);
    if (correct) {
      feedback.textContent = '答对了。' + quiz.dataset.explanation;
    } else {
      const option = quiz.querySelectorAll('label span')[Number(quiz.dataset.answer)].textContent;
      feedback.textContent = `参考选项是「${option}」。${quiz.dataset.explanation}`;
    }
  });
}

const processes = document.querySelectorAll('[data-process]');
if (processes.length) {
  const { mountProcess } = await import('./process.mjs');
  for (const root of processes) mountProcess(root, root.dataset.process);
}
const caseFlow = document.querySelector('[data-case-flow]');
if (caseFlow) {
  const { mountCaseFlow, mountCasePrompt } = await import('./case-guide.mjs');
  mountCaseFlow(caseFlow);
  mountCasePrompt(document.querySelector('.case-prompt'));
}
const demos = document.querySelectorAll('[data-project-demo]');
if (demos.length) {
  const { mountProject } = await import('./projects.mjs');
  for (const root of demos) mountProject(root, root.dataset.projectDemo);
}
