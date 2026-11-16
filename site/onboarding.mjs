import assert from 'node:assert/strict';
import { evidenceTable, lessonFlow } from './deep-lesson.mjs';

const learningPaths = [
  { title: '所有新同事', description: '先学会交代任务和核对出处。按这个顺序读，无需编程。', sections: ['model', 'prompt', 'retrieval', 'evaluation'] },
  { title: '研发新同事', description: '读完共同基础后，再看怎样接工具、处理失败并留下可复查的运行记录。', sections: ['tools', 'agent', 'evaluation'] },
];

export function validateOnboarding(guide, courses) {
  const ids = new Set(guide.sections.map(section => section.id));
  assert(guide.title && guide.description && ids.size === guide.sections.length, 'Incomplete onboarding guide');
  for (const path of learningPaths) {
    assert(path.sections.every(id => ids.has(id)), `Invalid onboarding path: ${path.title}`);
  }
  for (const section of guide.sections) {
    assert(/^[a-z][a-z-]*$/.test(section.id) && section.title && section.paragraphs.length >= 2, `Incomplete onboarding section: ${section.id}`);
    assert(section.sources.length && section.sources.every(source => /^https:\/\//.test(source.url) && source.title && source.note), `Missing reference in onboarding: ${section.id}`);
    assert(section.courses.length && section.courses.every(id => courses.has(id)), `Unknown course in onboarding: ${section.id}`);
  }
}

export function onboardingLesson(guide, h, courseChip) {
  const base = '../../';
  const sections = new Map(guide.sections.map(section => [section.id, section]));
  const sectionLink = id => `<a href="#${h(id)}">${h(sections.get(id).title)}</a>`;
  return `<div class="wrap"><div class="breadcrumbs"><a href="../">课程目录</a><span aria-hidden="true">/</span><span>${h(guide.title)}</span></div>
<div class="reading-layout"><article><header class="lesson-header"><h1>${h(guide.title)}</h1><p class="intro">${h(guide.description)}</p><p>下面用一份虚构手册和一台共享测试机演示。正文里的讲解和图可以直接阅读，公开原文及跟做条件列在每节末尾。</p></header>
<nav class="onboarding-paths" aria-label="按岗位开始学习">${learningPaths.map(path => `<section><h2>${h(path.title)}</h2><p>${h(path.description)}</p><ol>${path.sections.map(id => `<li>${sectionLink(id)}</li>`).join('')}</ol></section>`).join('')}</nav>
${guide.sections.map(section => `<section class="deep-chapter" id="${h(section.id)}"><h2>${h(section.title)}</h2>
${section.paragraphs.map(paragraph => `<p>${h(paragraph)}</p>`).join('')}
${section.figure ? lessonFlow(section.figure, h) : ''}${section.table ? evidenceTable(section.table, h) : ''}
${section.trace ? `<figure class="deep-code"><figcaption>同一次模拟查询的两条记录</figcaption><div class="foundation-compare"><div><h3>模型提出的调用</h3><pre><code>${h(section.trace.request)}</code></pre></div><div><h3>工具返回的结果</h3><pre><code>${h(section.trace.response)}</code></pre></div></div></figure>` : ''}
${section.prompt ? `<details class="case-prompt"><summary>查看一份可复制的任务示例</summary><pre><code data-copy-source>${h(section.prompt)}</code></pre><button class="button secondary" type="button" data-copy-case hidden>复制任务示例</button><span data-copy-status role="status"></span></details>` : ''}
${section.demo ? '<p><a href="../a9/#demo">看 A9 分步演示 · 同一个故障如何选下一步</a></p>' : ''}
<div class="onboarding-reading"><h3>公开材料</h3><ul class="source-list">${section.sources.map(source => `<li><a href="${h(source.url)}">${h(source.title)} ↗</a><p>${h(source.note)}</p></li>`).join('')}</ul>
<h3>接着学</h3><div class="prerequisites">${section.courses.map(id => courseChip(id, base)).join(' ')}</div></div></section>`).join('')}
</article><aside class="reading-aside"><nav aria-label="入门内容"><strong>入门内容</strong>${guide.sections.map(section => sectionLink(section.id)).join('')}</nav></aside></div></div>`;
}
