import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = dirname(fileURLToPath(import.meta.url));
const dist = resolve(site, '../dist');
const sample = process.argv.includes('--sample');
const json = async (name) => JSON.parse((await readFile(join(site, 'content', name), 'utf8')).replace(/^\uFEFF/, ''));
const { modules, sources, version } = await json('curriculum.json');
const { projects } = await json('projects.json');
const caseGuides = await json('case-guides.json');
const lessons = sample ? {} : await json('lessons.json');
const figures = sample ? {} : await json('figures.json');
const courseMap = new Map(modules.map(item => [item.id, item]));
const sourceMap = new Map(sources.map(item => [item.id, item]));
const pageCourseIds = sample ? ['A9'] : modules.map(item => item.id);
const tracks = {
  A: { title: '通用主干', text: '从 LLM 的基本原理，到能调用工具、交接和恢复的 Agent。', sign: '⌘' },
  B: { title: '算法实战', text: '把论文、数据和实验整理成可以交付的研发成果。', sign: '↗' },
  C: { title: '前沿选修', text: '研究自动化、长期记忆与多 Agent 协作，按手头任务选读。', sign: '∿' },
};
const routes = [
  { key: 'apply', name: '日常使用 AI', text: '从模型边界、任务说明和编码协作入手，再学会组织上下文和复用方法。', ids: ['A1','A2','A3','A4','A5','A7','A8','B1'] },
  { key: 'build', name: '做一个领域工具', text: '把已有脚本接到 AI 工作流，学习怎样留下运行记录、验证结果和处理失败。', ids: ['A6','A9','A10','A11','A12','B7','B9'] },
  { key: 'platform', name: '建设团队能力', text: '关心长任务、评测、协作和服务化时，从这里开始。', ids: ['A11','A12','A13','A14','A15','C4'] },
];
const caseTitles = {
  P1: '把论文公式变成可测代码',
  P2: '在固定预算内筛选实验',
  P3: '定位降噪带来的细节损失',
  P4: '定位 INT8 量化误差',
};
const demoCaptions = {
  A9: '切换故障和执行模式，再逐步看日志里哪条线索改变了下一步。示例日志为教学构造。',
  A11: '逐步提交、保存和恢复。看同一个幂等键如何找回第一次已经提交的任务。教学示意。',
  B8: '看同样预算下候选如何用开发集筛选，最后用独立样本验证。分数为教学设定。',
};
const sampleLesson = {
  question: '训练跑到一半停了。AI 先翻日志，接着应该查什么？',
  term: { name: 'Agent', meaning: '能根据工具返回的观察结果，决定下一步调用什么工具的程序。' },
  example: '如果日志报路径不存在，先检查配置里的路径。如果日志提示 GPU 显存耗尽，就对照配置与显存记录。把关键检查写进固定流程，把依赖线索的分支交给 Agent。',
  quiz: { prompt: '日志显示数据路径不存在，下一步该做什么？', options: ['重跑训练', '只读核对配置路径和数据目录', '先调低 batch size'], answer: 1, explanation: '现有线索指向路径。先核对配置和目录，再决定是否改动。' },
  sample: '日志报 FileNotFoundError。核对配置路径后发现数据目录尚未挂载，任务停在等待补齐数据的状态。',
  checklist: ['记录日志原文和工具返回值。', '在停止前说明缺哪份证据。'],
};

const h = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const courseUrl = (id) => `courses/${id.toLowerCase()}/`;
const projectUrl = (id) => `projects/${id.toLowerCase()}/`;
const paragraphs = (items) => items.map(item => `<p>${h(item)}</p>`).join('');
const list = (items, tag = 'ul') => `<${tag} class="text-list">${items.map(item => `<li>${h(item)}</li>`).join('')}</${tag}>`;
const courseChip = (id, base) => {
  const item = courseMap.get(id);
  return pageCourseIds.includes(id) ? `<a class="chip" href="${base + courseUrl(id)}">${id} <span>${h(item.title)}</span></a>`
    : `<span class="chip">${id} <span>${h(item.title)}</span></span>`;
};

function validateData() {
  const expected = [...Object.entries({ A: 15, B: 12, C: 5 }).flatMap(([key, count]) => Array.from({length: count}, (_, index) => key + (index + 1)))];
  assert.deepEqual([...courseMap.keys()], expected);
  assert.deepEqual(projects.map(item => item.id), ['P1', 'P2', 'P3', 'P4']);
  assert.deepEqual(Object.keys(caseGuides).sort(), projects.map(project => project.id));
  const completed = new Set();
  function visit(id, trail = new Set()) {
    assert(courseMap.has(id), `Missing prerequisite ${id}`);
    assert(!trail.has(id), `Circular prerequisite ${id}`);
    if (completed.has(id)) return;
    courseMap.get(id).prerequisites.forEach(prerequisite => visit(prerequisite, new Set([...trail, id])));
    completed.add(id);
  }
  for (const item of modules) {
    visit(item.id);
    for (const reference of item.references) assert(sourceMap.has(reference), `Missing source ${reference}`);
  }
  for (const project of projects) {
    for (const id of project.modules) assert(courseMap.has(id), `Missing module ${id}`);
    const guide = caseGuides[project.id];
    for (const key of ['task','handoff','deliverable','verification','before','withAI','limit','prompt']) {
      assert(typeof guide[key] === 'string' && guide[key].trim(), `Missing ${key} in ${project.id}`);
    }
    assert(guide.steps.length === 4 && guide.steps.some(step => step.role === 'AI') && guide.steps.some(step => step.role === '验证'), `Incomplete workflow in ${project.id}`);
    for (const step of guide.steps) {
      assert(['工程师','AI','验证'].includes(step.role) && step.title && step.detail && step.evidence, `Invalid workflow step in ${project.id}`);
    }
  }
  if (sample) return;
  assert.deepEqual(Object.keys(lessons).sort(), expected.sort());
  for (const [id, lesson] of Object.entries(lessons)) {
    const { question, example, term, quiz, sample: reference, checklist } = lesson;
    assert([question, example, term?.name, term?.meaning, quiz?.prompt, quiz?.explanation, reference].every(value => typeof value === 'string' && value.trim()), `Missing teaching content ${id}`);
    assert(quiz.options.length === 3 && new Set(quiz.options).size === 3 && Number.isInteger(quiz.answer) && quiz.answer >= 0 && quiz.answer < 3, `Invalid quiz ${id}`);
    assert(Array.isArray(checklist) && checklist.length > 0, `Missing checklist ${id}`);
  }
  for (const [id, entries] of Object.entries(figures)) {
    assert(courseMap.has(id) && entries.length, `Invalid research figure entry ${id}`);
    for (const entry of entries) {
      assert(/^figures\/[\w.-]+\.(svg|png|webp|jpe?g)$/.test(entry.src), `Invalid figure path ${id}`);
      assert(entry.alt && entry.caption && entry.sourceTitle && /^https:\/\//.test(entry.sourceUrl) && entry.license, `Missing figure attribution ${id}`);
    }
  }
}

function shell(base, title, active, main) {
  const links = [['home','', '首页'], ['paths','paths/', '学习路线'], ['courses','courses/', '课程目录'], ['projects','projects/', '实战案例']];
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f5f6ed">
<meta name="description" content="面向算法研发同事的 AI 自助培训，含课程、演示、练习与四个综合案例。">
<title>${h(title)} · AI 辅助研发训练手册</title><link rel="icon" href="${base}assets/mark.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}assets/style.css">${['home','projects'].includes(active) ? `<link rel="stylesheet" href="${base}assets/case-guide.css">` : ''}${active === 'projects' && !sample ? `<link rel="stylesheet" href="${base}assets/projects.css">` : ''}
<script type="module" src="${base}assets/main.mjs"></script></head>
<body><a class="skip" href="#main">跳到正文</a><header class="masthead"><div class="wrap header-inner">
<a class="brand" href="${base}index.html"><img src="${base}assets/mark.svg" alt="" width="34" height="34"><span>AI 辅助研发训练手册</span></a>
<nav aria-label="主导航">${links.map(([key, url, label]) => `<a href="${base + (url || 'index.html')}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
</div></header><main id="main">${main}</main>
<footer><div class="wrap footer-inner"><span>AI 辅助研发训练手册</span><span>课程版本 ${h(version)} · 学习进度保存在当前浏览器</span></div></footer></body></html>`;
}

function workflowArt(base) {
  return `<figure class="hero-art"><div class="art-inner">
<div class="art-bar"><span><i></i> 研发任务流</span><span>训练异常排查</span></div>
<div class="art-flow" aria-hidden="true">
<div class="art-entry"><span class="art-icon">›_</span><div><strong>训练停止</strong><small>读取本次日志</small></div></div>
<div class="art-stem"></div><div class="art-decision">日志里有什么线索？</div>
<div class="art-fork"></div>
<div class="art-choices"><div><span>PATH</span><b>检查数据目录</b></div><div><span>OOM</span><b>查看显存记录</b></div></div>
<div class="art-stem end"></div><div class="art-verdict"><span>✓</span> 记录证据，决定下一步</div>
</div><figcaption>按报错线索选择检查项。 <a href="${base + courseUrl('A9')}#demo">打开排查演示 ↗</a></figcaption></div></figure>`;
}

function home() {
  return `<div class="wrap"><section class="hero"><div><p class="eyebrow">算法研发 · 自助培训</p>
<h1>把 AI 用到<br>日常研发里<span>。</span></h1>
<p class="intro">算法研发自学材料，覆盖模型原理、论文复现、实验诊断、图像质量和部署。</p>
<div class="actions"><a class="button primary" href="paths/">选一条学习路线 <span aria-hidden="true">↗</span></a><a class="button secondary" href="courses/">浏览课程</a></div>
<div class="hero-summary"><span><b>32</b> 门课程</span><span><b>4</b> 个综合案例</span></div></div>${workflowArt('')}</section>
<section class="home-tracks" aria-labelledby="tracks-title"><div class="section-heading"><div><h2 id="tracks-title">课程内容</h2></div><a class="text-link" href="courses/">查看完整目录 ↗</a></div>
<div class="cards">${Object.entries(tracks).map(([key, track]) => `<a class="track-card" href="courses/#track-${key}"><span class="track-sign" aria-hidden="true">${track.sign}</span><h3>${track.title}</h3><p>${track.text}</p><span class="card-end">${modules.filter(item => item.track === key).length} 门课程 <span aria-hidden="true">↗</span></span></a>`).join('')}</div></section>
<section class="home-cases"><div class="section-heading"><h2>研发案例</h2><a class="text-link" href="projects/">查看全部案例 ↗</a></div>${projectCards('')}</section></div>`;
}

function paths() {
  return `<div class="wrap"><section class="page-intro"><h1>学习路线</h1><p class="intro">按研发任务选课。先修章节见各课页首。</p></section>
<div class="route-list">${routes.map(route => `<section class="route" id="${route.key}"><h2>${route.name}</h2><p>${route.text}</p><ol>${route.ids.map(id => `<li>${courseChip(id, '../')}</li>`).join('')}</ol></section>`).join('')}</div></div>`;
}

function catalog() {
  return `<div class="wrap"><section class="page-intro"><h1>课程目录</h1></section>
<div class="catalog-toolbar"><label class="search"><span>搜索课程</span><input type="search" data-course-search placeholder="搜索标题、主题或编号" autocomplete="off"></label><p class="catalog-count" data-course-count aria-live="polite">${modules.length} 门课程</p></div>
<div class="tabs"><a href="#track-A">通用主干</a><a href="#track-B">算法实战</a><a href="#track-C">前沿选修</a></div><p data-empty hidden>没有找到课程，试试别的关键词。</p>
${Object.entries(tracks).map(([key, track]) => `<section class="catalog-track" data-course-group id="track-${key}"><h2>${track.title}</h2><p>${track.text}</p><div class="catalog-list">${modules.filter(item => item.track === key).map(item => {
    const body = `<span class="mono">${item.id}</span><div><h3>${h(item.title)}</h3><p>${h(item.goal)}</p></div><span class="catalog-arrow" data-course-state="${item.id}" aria-label="打开课程">↗</span>`;
    return pageCourseIds.includes(item.id)
      ? `<a class="catalog-item" data-course-card data-keywords="${h(item.level + ' ' + item.title + ' ' + item.core.join(' '))}" href="../${courseUrl(item.id)}">${body}</a>`
      : `<div class="catalog-item" data-course-card>${body}</div>`;
  }).join('')}</div></section>`).join('')}</div>`;
}

function figureMarkup(item, base) {
  return (figures[item.id] ?? []).map(figure => {
    const src = base + 'assets/' + h(figure.src);
    return `<figure class="research-figure"><a href="${src}" aria-label="查看大图：${h(figure.alt)}"><img loading="lazy" src="${src}" alt="${h(figure.alt)}"></a><figcaption>${h(figure.caption)} <a href="${h(figure.sourceUrl)}">${h(figure.sourceTitle)}</a> · ${figure.licenseUrl ? `<a href="${h(figure.licenseUrl)}">${h(figure.license)}</a>` : h(figure.license)}</figcaption></figure>`;
  }).join('');
}

function renderQuiz(quiz) {
  return `<form class="quiz" data-quiz data-answer="${quiz.answer}" data-explanation="${h(quiz.explanation)}"><fieldset><legend>${h(quiz.prompt)}</legend>
${quiz.options.map((option, index) => `<label><input type="radio" name="option" value="${index}" required><span>${h(option)}</span></label>`).join('')}
</fieldset><button class="button primary" type="submit">检查答案</button><p data-quiz-feedback role="status" hidden></p><noscript><details><summary>查看答案</summary><p>${h(quiz.explanation)}</p></details></noscript></form>`;
}

function course(item) {
  const base = '../../';
  const lesson = lessons[item.id] ?? sampleLesson;
  const related = sample ? [] : projects.filter(project => project.modules.includes(item.id));
  const next = modules[modules.indexOf(item) + 1];
  return `<div class="wrap"><div class="breadcrumbs"><a href="../">课程目录</a><span>/</span><a href="../#track-${item.track}">${tracks[item.track].title}</a><span>/</span><span>${item.id}</span></div>
<div class="reading-layout"><article><header class="lesson-header"><p class="eyebrow">${item.id} · ${h(item.level)}</p><h1>${h(item.title)}</h1><p class="intro">${h(lesson.question)}</p><p>${h(item.goal)}</p>
${item.prerequisites.length ? `<div class="prerequisites"><strong>先修</strong> ${item.prerequisites.map(id => courseChip(id, base)).join(' ')}</div>` : ''}</header>
<section id="concept"><h2>原理与示例</h2><dl class="definition"><dt>${h(lesson.term.name)}</dt><dd>${h(lesson.term.meaning)}</dd></dl><p class="example">${h(lesson.example)}</p>${paragraphs(item.core)}${figureMarkup(item, base)}</section>
${demoCaptions[item.id] ? `<section id="demo"><h2>分步演示</h2><p>${demoCaptions[item.id]}</p><div data-process="${item.id}"></div><noscript><p>启用 JavaScript 后可单步操作演示。</p></noscript></section>` : ''}
<section id="practice"><h2>练习</h2>${renderQuiz(lesson.quiz)}<h3>实操任务</h3><p>${h(item.exercise)}</p>${list(item.steps, 'ol')}
<details class="reference"><summary>参考产物与自查</summary><p>${h(lesson.sample)}</p>${list(lesson.checklist)}</details><h3>验收条件</h3>${list(item.checks)}<p class="note"><b>常见误区</b>　${h(item.failure)}</p></section>
<section id="references"><h2>继续阅读</h2><ul class="source-list">${item.references.map(id => sourceMap.get(id)).map(source => `<li><a href="${h(source.url)}">${h(source.title)} ↗</a><p>${h(source.use)}</p></li>`).join('')}</ul>
${related.length ? `<h3>相关案例</h3><ul class="text-list">${related.map(project => `<li><a href="${base + projectUrl(project.id)}">${project.id} · ${h(project.title)}</a></li>`).join('')}</ul>` : ''}</section>
<div class="lesson-end"><button type="button" class="button secondary" data-complete="${item.id}" aria-pressed="false" hidden>标记已学</button><span data-save-message role="status"></span>${next && !sample ? `<a class="text-link" href="${base + courseUrl(next.id)}">下一课 ${next.id} ↗</a>` : ''}</div></article>
<aside class="reading-aside"><nav aria-label="本课导航"><strong>本课内容</strong><a href="#concept">原理与示例</a>${demoCaptions[item.id] ? '<a href="#demo">分步演示</a>' : ''}<a href="#practice">练习</a><a href="#references">继续阅读</a></nav></aside></div></div>`;
}

function projectCards(base) {
  return `<div class="project-cards illustrated-cards">${projects.map(item => {
    const guide = caseGuides[item.id];
    return `<a class="project-card illustrated-card" href="${base + (sample ? 'projects/' : projectUrl(item.id))}">
<div class="case-card-art"><img src="${base}assets/case-art/${item.id.toLowerCase()}.svg" width="460" height="214" alt="" loading="lazy"></div>
<div class="case-card-text"><div class="case-card-label"><span class="project-code">${item.id}</span><span aria-hidden="true">↗</span></div>
<h3>${caseTitles[item.id]}</h3><p>AI 交付：${h(guide.deliverable)}</p></div></a>`;
  }).join('')}</div>`;
}

const caseRole = { '工程师': 'engineer', AI: 'ai', '验证': 'verify' };

function caseFlow(guide) {
  return `<figure class="case-flow" data-case-flow aria-label="工程师与 AI 的协作流程">
<ol class="case-flow-nodes">${guide.steps.map((step, index) => `<li class="flow-${caseRole[step.role]}">
<button type="button" data-case-step="${index}" aria-controls="case-evidence-${index}" aria-pressed="${index === 0}" hidden><span class="flow-role"><span>${index + 1}</span> ${step.role}</span><strong>${h(step.title)}</strong></button></li>`).join('')}</ol>
<div class="case-evidence">${guide.steps.map((step, index) => `<div class="case-panel flow-${caseRole[step.role]}" id="case-evidence-${index}" data-case-panel><p class="case-panel-owner">${index + 1} · ${step.role} · ${h(step.title)}</p><p>${h(step.detail)}</p><pre><code>${h(step.evidence)}</code></pre></div>`).join('')}</div>
<figcaption><span>教学流程 · 产物为示例</span><div class="case-flow-controls" data-case-controls hidden><button type="button" class="button" data-tour-play>播放</button><button type="button" class="button" data-tour-next>下一步</button><button type="button" class="button" data-tour-reset>重置</button></div></figcaption>
</figure>`;
}

function projectDetail(item) {
  const base = '../../';
  const guide = caseGuides[item.id];
  return `<div class="wrap case-page"><div class="breadcrumbs"><a href="../">实战案例</a><span>/</span><span>${item.id}</span></div>
<header class="case-hero"><div><p class="eyebrow">${item.id} · 实战案例</p><h1>${caseTitles[item.id]}</h1><p class="intro">${h(guide.task)}</p>
<div class="actions"><a class="button primary" href="#steps">看协作流程 ↓</a><a class="button secondary" href="#demo">打开交互演示</a></div></div>
<div class="case-hero-art"><img src="${base}assets/case-art/${item.id.toLowerCase()}.svg" width="460" height="214" alt=""></div></header>
<article class="case-body">
<section id="steps"><div class="section-heading"><h2>协作流程</h2></div>
<dl class="case-contract"><div><dt>交给 AI</dt><dd>${h(guide.handoff)}</dd></div><div><dt>AI 交付</dt><dd>${h(guide.deliverable)}</dd></div><div><dt>工程师验收</dt><dd>${h(guide.verification)}</dd></div></dl>
${caseFlow(guide)}
<details class="case-prompt"><summary>给 AI 的任务单</summary><pre><code data-copy-source>${h(guide.prompt)}</code></pre><button type="button" class="button secondary" data-copy-case hidden>复制任务单</button><span data-copy-status role="status"></span></details></section>
<section id="demo"><h2>交互演示</h2><div data-project-demo="${item.id}"></div><noscript><p>启用 JavaScript 后可操作案例。</p></noscript></section>
<section id="checks"><h2>用到实际项目时</h2><dl class="case-comparison"><div><dt>原有工作</dt><dd>${h(guide.before)}</dd></div><div><dt>AI 接手</dt><dd>${h(guide.withAI)}</dd></div></dl>
<p class="note">${h(guide.limit)}</p>
<details class="reference"><summary>完整交付清单</summary>${list(item.deliverables)}${list(item.rubric)}</details></section>
<section id="related"><h2>相关课程</h2><div class="prerequisites">${item.modules.map(id => courseChip(id, base)).join(' ')}</div></section>
</article></div>`;
}

async function write(path, data) {
  const file = join(dist, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data, 'utf8');
}
async function pathsUnder(directory) {
  const items = await readdir(join(dist, directory), { withFileTypes: true });
  const folders = await Promise.all(items.filter(item => item.isDirectory()).map(item => pathsUnder(join(directory, item.name))));
  return [...items.filter(item => item.isFile()).map(item => join(directory, item.name).replaceAll('\\', '/')), ...folders.flat()];
}
async function checkLinks() {
  const paths = new Set(await pathsUnder('.'));
  const documents = new Map();
  for (const path of paths) {
    if (path.endsWith('.html')) documents.set(path, await readFile(join(dist, path), 'utf8'));
  }
  for (const [path, html] of documents) {
    const from = `https://training.test/AI_teach_website/${path}`;
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `Duplicate id on ${path}`);
    for (const [, attribute] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      if (/^https:\/\//.test(attribute)) continue;
      const url = new URL(attribute, from);
      assert(url.pathname.startsWith('/AI_teach_website/'), `Link leaves base path on ${path}: ${attribute}`);
      const relative = url.pathname.slice('/AI_teach_website/'.length);
      const target = extname(relative) ? relative : relative + 'index.html';
      assert(paths.has(target), `Link missing on ${path}: ${attribute}`);
      if (url.hash) assert(documents.get(target)?.includes(`id="${url.hash.slice(1)}"`), `Anchor missing on ${path}: ${attribute}`);
    }
  }
  return documents.size;
}

validateData();
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(site, 'static'), join(dist, 'assets'), { recursive: true });
await write('.nojekyll', '');
await write('index.html', shell('', '首页', 'home', home()));
await write('paths/index.html', shell('../', '学习路线', 'paths', paths()));
await write('courses/index.html', shell('../', '课程目录', 'courses', catalog()));
await write('projects/index.html', shell('../', '实战案例', 'projects', `<div class="wrap"><section class="page-intro"><h1>实战案例</h1><p class="intro">四个研发任务，分别演示 AI 接手的工作和工程师的验收步骤。</p></section>${projectCards('../')}</div>`));
for (const id of pageCourseIds) {
  const item = courseMap.get(id);
  await write(courseUrl(id) + 'index.html', shell('../../', item.title, 'courses', course(item)));
}
if (!sample) {
  for (const item of projects) await write(projectUrl(item.id) + 'index.html', shell('../../', caseTitles[item.id], 'projects', projectDetail(item)));
}
const pages = await checkLinks();
console.log(`Verified ${pages} HTML pages, ${pageCourseIds.length} courses and ${sample ? 0 : projects.length} project details.`);
