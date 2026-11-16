import assert from 'node:assert/strict';

const filled = (value) => typeof value === 'string' && value.trim().length > 0;
const identifier = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateDeepLesson(id, lesson) {
  const { intro, sections, task, sources } = lesson;
  assert(filled(intro) && Array.isArray(sections) && sections.length >= 5, `Incomplete lesson ${id}`);
  assert(sections.filter(section => section.figure).length >= 2 && sections.some(section => section.example), `Missing flows or example in ${id}`);
  assert(new Set(sections.map(section => section.id)).size === sections.length, `Duplicate chapter in ${id}`);
  for (const section of sections) {
    assert(identifier.test(section.id) && filled(section.title) && section.paragraphs.length >= 2 && section.paragraphs.every(filled), `Incomplete chapter in ${id}`);
    if (section.figure) {
      const { caption, nodes } = section.figure;
      assert(filled(caption) && nodes.length >= 2 && nodes.every(node => filled(node.title) && filled(node.text)), `Incomplete flow in ${id}/${section.id}`);
    }
    if (section.visual) {
      const { src, alt, caption } = section.visual;
      assert(/^lesson-art\/[a-z0-9-]+\.svg$/.test(src) && filled(alt) && filled(caption), `Incomplete visual in ${id}/${section.id}`);
    }
    if (section.example) assert(filled(section.example.title) && filled(section.example.text), `Incomplete example in ${id}/${section.id}`);
    if (section.code) assert(filled(section.code.title) && filled(section.code.text), `Incomplete code in ${id}/${section.id}`);
    if (section.table) {
      const { caption, headers, rows } = section.table;
      assert(filled(caption) && headers.length >= 2 && headers.every(filled) && rows.length && rows.every(row => row.length === headers.length && row.every(filled)), `Incomplete table in ${id}/${section.id}`);
    }
  }
  assert(task && [task.input, task.prompt, task.deliverable].every(filled) && task.check.length >= 2 && task.check.every(filled), `Incomplete task in ${id}`);
  assert(sources.length && sources.every(source => filled(source.title) && /^https:\/\//.test(source.url)), `Missing sources in ${id}`);
}

export function evidenceTable(table, h) {
  return `<div class="selection-table" role="region" aria-label="${h(table.caption)}" tabindex="0"><table><caption>${h(table.caption)}</caption>
<thead><tr>${table.headers.map(cell => `<th scope="col">${h(cell)}</th>`).join('')}</tr></thead>
<tbody>${table.rows.map(([label, ...cells]) => `<tr><th scope="row">${h(label)}</th>${cells.map(cell => `<td>${h(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function lessonFlow(figure, h) {
  return `<figure class="deep-figure"><figcaption>${h(figure.caption)}</figcaption><ol class="deep-flow">
${figure.nodes.map(node => `<li><strong>${h(node.title)}</strong><p>${h(node.text)}</p></li>`).join('')}</ol></figure>`;
}

export function taskMarkdown(id, title, task) {
  const { input, prompt, deliverable, check } = task;
  return [
    `# ${id} · ${title}`,
    '先阅读输入中的交接说明，再把约定的材料交给本地 Agent。拿到产物后逐条核对验收。',
    `## 输入\n\n${input}`,
    `## 交给 Agent\n\n${prompt}`,
    `## 交付\n\n${deliverable}`,
    `## 人工验收\n\n${check.map(item => '- ' + item).join('\n')}`,
  ].join('\n\n') + '\n';
}

export function deepContent(lesson, base, h, extras = {}) {
  return `<nav id="concept" class="llm-contents" aria-label="章节目录"><h2>章节目录</h2><ol>
${lesson.sections.map(chapter => `<li><a href="#${h(chapter.id)}">${h(chapter.title)}</a></li>`).join('')}</ol><a href="#practice">本地任务</a></nav>
${lesson.sections.map(chapter => `<section id="${h(chapter.id)}" class="deep-chapter"><h2>${h(chapter.title)}</h2>
${chapter.paragraphs.map(paragraph => `<p>${h(paragraph)}</p>`).join('')}
${chapter.visual ? `<figure class="research-figure lesson-visual"><a href="${base}assets/${h(chapter.visual.src)}"><img src="${base}assets/${h(chapter.visual.src)}" alt="${h(chapter.visual.alt)}" loading="lazy"></a><figcaption>${h(chapter.visual.caption)}</figcaption></figure>` : ''}
${chapter.figure ? lessonFlow(chapter.figure, h) : ''}
${chapter.example ? `<aside class="deep-example"><h3>${h(chapter.example.title)}</h3><p>${h(chapter.example.text)}</p></aside>` : ''}
${chapter.code ? `<figure class="deep-code"><figcaption>${h(chapter.code.title)}</figcaption><pre><code>${h(chapter.code.text)}</code></pre></figure>` : ''}
${chapter.table ? evidenceTable(chapter.table, h) : ''}
${extras[chapter.id] ?? ''}</section>`).join('')}`;
}

export function deepTask(id, task, base, h) {
  return `<section id="practice" class="lab-section deep-task"><h2>本地任务</h2>
<p><a class="button primary" href="${base}downloads/${id.toLowerCase()}.zip" download>下载 ${id} 任务包</a></p>
<details class="case-prompt"><summary>查看任务与验收</summary>
<h3>交给 Agent</h3><pre><code data-copy-source>输入\n${h(task.input)}\n\n任务\n${h(task.prompt)}\n\n交付\n${h(task.deliverable)}</code></pre>
<button type="button" class="button secondary" data-copy-case hidden>复制委托</button><span data-copy-status role="status"></span>
<h3>交付</h3><p>${h(task.deliverable)}</p><h3>人工验收</h3><ul>${task.check.map(item => `<li>${h(item)}</li>`).join('')}</ul></details></section>`;
}
