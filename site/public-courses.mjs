import assert from 'node:assert/strict';

export const publicCourseDirectory = 'courses/public/';
export const publicCourseLabel = '公开课程推荐';
export const publicCourseUrl = id => `${publicCourseDirectory}${id}/`;

const filled = value => typeof value === 'string' && value.trim().length > 0;
const strings = (items, minimum) => Array.isArray(items) && items.length >= minimum && items.every(filled);

export function validatePublicCourses(items, courseMap) {
  assert(items.length > 0 && new Set(items.map(item => item.id)).size === items.length, 'Missing or duplicate public courses');
  for (const item of items) {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id), `Invalid public course ID: ${item.id}`);
    assert(strings([item.title, item.provider, item.language, item.level, item.summary, item.audience, item.access], 7), `Incomplete introduction: ${item.id}`);
    assert(strings(item.overview, 2) && strings(item.start, 2), `Missing reading guidance: ${item.id}`);
    assert(item.outline.length >= 3 && item.outline.every(entry => filled(entry.title) && filled(entry.text)), `Incomplete outline: ${item.id}`);
    assert(item.links.length && item.links.every(link => filled(link.title) && /^https:\/\//.test(link.url)), `Missing public source: ${item.id}`);
    assert(strings(item.courses, 1) && item.courses.every(id => courseMap.has(id)), `Invalid related course: ${item.id}`);
  }
}

export function publicCoursesEntry(count) {
  return `<section class="public-courses-entry" aria-labelledby="public-courses-heading"><div>
<h2 id="public-courses-heading">${publicCourseLabel}</h2>
<p>从大模型通识、提示词与知识库，到工具调用、Agent 和评测。先了解每门课讲什么，再按经验和可用环境选课。</p></div>
<a class="button primary" href="${publicCourseDirectory}">浏览 ${count} 门公开课程 <span aria-hidden="true">↗</span></a></section>`;
}

export function publicCoursesIndex(items, h) {
  return `<div class="wrap"><header class="page-intro public-courses-intro"><h1>${publicCourseLabel}</h1>
<p class="intro">面向新员工的 ${items.length} 门外部课程。每张卡片都可以打开独立介绍，查看课程大纲、建议先读的章节和跟做条件。</p></header>
<ul class="public-course-list">${items.map(item => `<li><a class="public-course-card" href="${h(item.id)}/">
<span class="public-course-meta">${h(item.provider)} · ${h(item.language)} · ${h(item.level)}</span>
<h2>${h(item.title)}</h2><p>${h(item.summary)}</p><span class="text-link">查看课程介绍 <span aria-hidden="true">↗</span></span></a></li>`).join('')}</ul></div>`;
}

export function publicCourseDetail(item, h, courseChip) {
  return `<div class="wrap public-course-page"><div class="breadcrumbs"><a href="../">${publicCourseLabel}</a><span aria-hidden="true">/</span><span>${h(item.title)}</span></div>
<div class="reading-layout"><article><header class="lesson-header"><p class="eyebrow">${h(item.provider)} · ${h(item.language)} · ${h(item.level)}</p><h1>${h(item.title)}</h1>
<p class="intro">${h(item.summary)}</p><div class="actions"><a class="button primary" href="#materials">原课入口与学习条件 <span aria-hidden="true">↓</span></a><a class="button secondary" href="#outline">查看课程大纲 <span aria-hidden="true">↓</span></a></div></header>
<section id="audience"><h2>适合谁</h2><p>${h(item.audience)}</p></section>
<section id="overview"><h2>学完能做什么</h2>${item.overview.map(line => `<p>${h(line)}</p>`).join('')}</section>
<section id="outline"><h2>课程大纲</h2><dl class="public-course-outline">${item.outline.map(entry => `<div><dt>${h(entry.title)}</dt><dd>${h(entry.text)}</dd></div>`).join('')}</dl></section>
<section id="start"><h2>从哪里开始</h2><ol class="text-list">${item.start.map(step => `<li>${h(step)}</li>`).join('')}</ol></section>
<section id="materials"><h2>原课与学习条件</h2><p>${h(item.access)}</p><ul class="source-list">${item.links.map(link => `<li><a href="${h(link.url)}">${h(link.title)} <span aria-hidden="true">↗</span></a></li>`).join('')}</ul></section>
<section id="related"><h2>关联的本站课程</h2><div class="prerequisites">${item.courses.map(id => courseChip(id, '../../../')).join(' ')}</div></section>
<p class="public-course-back"><a href="../">回到公开课程推荐</a></p></article>
<aside class="reading-aside"><nav aria-label="本页目录"><strong>课程介绍</strong><a href="#audience">适合谁</a><a href="#overview">学完能做什么</a><a href="#outline">课程大纲</a><a href="#start">从哪里开始</a><a href="#materials">原课与学习条件</a><a href="#related">关联的本站课程</a></nav></aside></div></div>`;
}
