import assert from 'node:assert/strict';

export const publicCourseDirectory = 'courses/public/';
export const publicCourseLabel = '公开课程推荐';
export const publicCourseUrl = id => `${publicCourseDirectory}${id}/`;

const filled = value => typeof value === 'string' && value.trim().length > 0;
const strings = (items, minimum) => Array.isArray(items) && items.length >= minimum && items.every(filled);

export function validatePublicCourses(items, groups, courseMap) {
  assert(items.length > 0 && new Set(items.map(item => item.id)).size === items.length, 'Missing or duplicate public courses');
  for (const item of items) {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id), `Invalid public course ID: ${item.id}`);
    assert(strings([item.title, item.provider, item.language, item.level, item.summary, item.audience, item.access], 7), `Incomplete introduction: ${item.id}`);
    assert(strings(item.overview, 2) && strings(item.start, 2), `Missing reading guidance: ${item.id}`);
    assert(item.outline.length >= 3 && item.outline.every(entry => filled(entry.title) && filled(entry.text)), `Incomplete outline: ${item.id}`);
    assert(item.links.length && item.links.every(link => filled(link.title) && /^https:\/\//.test(link.url)), `Missing public source: ${item.id}`);
    assert(strings(item.courses, 1) && item.courses.every(id => courseMap.has(id)), `Invalid related course: ${item.id}`);
  }
  assert(groups.length > 0 && new Set(groups.map(group => group.id)).size === groups.length, 'Missing or duplicate public course groups');
  for (const group of groups) {
    assert(/^[a-z]+(?:-[a-z]+)*$/.test(group.id) && filled(group.title) && filled(group.audience) && group.items.length > 0, `Invalid public course group: ${group.id}`);
    assert(group.items.every(item => strings([item.id, item.fit, item.requirements], 3)), `Incomplete fit description: ${group.id}`);
  }
  const groupedIds = groups.flatMap(group => group.items.map(item => item.id));
  assert.deepEqual(groupedIds.toSorted(), items.map(item => item.id).toSorted(), 'Every public course must appear in exactly one fit group');
}

export function publicCoursesEntry(count, groups, h) {
  return `<section class="public-courses-entry" aria-labelledby="public-courses-heading"><div>
<h2 id="public-courses-heading">${publicCourseLabel}</h2>
<p>先按学习目的选方向。完整表格可以比较 ${count} 门课的语言、内容和跟做条件。</p></div>
<a class="button primary" href="${publicCourseDirectory}">查看公开课程适配表 <span aria-hidden="true">↗</span></a>
<table class="public-fit-summary" aria-label="公开课程的学习方向"><thead><tr><th scope="col">学习方向</th><th scope="col">适合谁</th></tr></thead>
<tbody>${groups.map(group => `<tr><th scope="row"><a href="${publicCourseDirectory}#fit-${h(group.id)}">${h(group.title)}</a></th><td>${h(group.audience)}</td></tr>`).join('')}</tbody></table></section>`;
}

export function publicCoursesIndex(items, groups, h) {
  const courses = new Map(items.map(item => [item.id, item]));
  return `<div class="wrap"><header class="page-intro public-courses-intro"><h1>${publicCourseLabel}</h1>
<p class="intro">按你想完成的学习任务选课。点课程名看大纲、选读建议和原课入口。</p></header>
<nav class="tabs public-fit-nav" aria-label="按学习目标查看公开课程">${groups.map(group => `<a href="#fit-${h(group.id)}">${h(group.title)}</a>`).join('')}</nav>
<p class="public-fit-scroll-hint" id="public-fit-scroll-hint">在窄屏上可以横向滑动，看语言和跟做条件。</p>
<div class="public-fit-wrap" role="region" aria-labelledby="public-fit-caption" aria-describedby="public-fit-scroll-hint" tabindex="0"><table class="public-fit-table">
<caption id="public-fit-caption">${items.length} 门公开课适配表</caption>
<colgroup><col class="public-fit-course"><col class="public-fit-use"><col class="public-fit-language"><col class="public-fit-requirements"></colgroup>
<thead><tr><th scope="col">课程</th><th scope="col">适合谁、学什么</th><th scope="col">语言</th><th scope="col">跟做条件</th></tr></thead>
${groups.map(group => `<tbody><tr class="public-fit-group" id="fit-${h(group.id)}"><th scope="rowgroup" colspan="4">${h(group.title)}</th></tr>
${group.items.map(entry => {
    const item = courses.get(entry.id);
    return `<tr><th scope="row"><a href="${h(item.id)}/">${h(item.title)}</a><small>${h(item.provider)}</small></th><td>${h(entry.fit)}</td><td>${h(item.language)}</td><td>${h(entry.requirements)}</td></tr>`;
  }).join('')}</tbody>`).join('')}
</table></div></div>`;
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
