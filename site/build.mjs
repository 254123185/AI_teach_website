import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controlReview, denoiseOpening, fusionFlow, paperTextureRead, researchRecord, revisionRecord, fusionImage, fusionResults, fusionLinks, inspectFusionRegions } from './fusion-case.mjs';
import { visualInputLesson } from './visual-input.mjs';
import { deepContent, deepTask, taskMarkdown, validateDeepLesson } from './deep-lesson.mjs';

const site = dirname(fileURLToPath(import.meta.url));
const dist = resolve(site, '../dist');
const sample = process.argv.includes('--sample');
const json = async (name) => JSON.parse((await readFile(join(site, 'content', name), 'utf8')).replace(/^\uFEFF/, ''));
const { modules, sources, version } = await json('curriculum.json');
const projects = await Promise.all(['P1', 'P2', 'P3', 'P4'].map(async id =>
  ({ id, ...await json(`workflows/${id.toLowerCase()}.json`) })));
const workflowFixtures = {
  P2: ['p2/fixtures.json', 'p2-fixtures.json'],
  P3: ['p3/scenarios.json', 'p3-scenarios.json'],
};
const denoiseCase = await json('denoise-case.json');
const denoisePapers = [await json('denoise-paper.json')].flat();
const fusionSelection = await json('fusion-selection.json');
const fusionRevision = await json('fusion-revision.json');
const sddBasics = await json('sdd-basics.json');
const imageEvidenceBasics = await json('image-evidence-basics.json');
const visualInputBasics = await json('visual-input-basics.json');
const fusionPath = 'experiments/tea-shop/';
const python = process.env.TRAINING_PYTHON || 'python';
const stages = { P1: '论文证据', P2: '候选实验', P3: '样本补齐', P4: '评审 Demo' };
const stageIntros = {
  P1: '改变能用的数据与训练资源，看看哪条论文机制仍值得先试。',
  P2: '动手筛候选。开发集用来试，锁定后再看留出结果。',
  P3: '调整退化和种子，观察生成的配对图、覆盖条件和清单。',
};
const llmChapters = { A1: await json('llm-foundations.json'), A2: await json('llm-selection.json') };
const lessons = sample ? {} : await json('lessons.json');
const figures = sample ? {} : await json('figures.json');
const courseMap = new Map(modules.map(item => [item.id, item]));
const sourceMap = new Map(sources.map(item => [item.id, item]));
const pageCourseIds = sample ? ['A9'] : modules.map(item => item.id);
const deepIds = modules.map(item => item.id).filter(id => !['A1', 'A2', 'A3'].includes(id));
const deepLessons = Object.fromEntries(await Promise.all(deepIds.map(async id => [id, await json(`deep/${id.toLowerCase()}.json`)])));
const visualTask = {
  input: 'weak.png 和 strong.png 为同一低照度输入的两路结果。附件 low-light-weak-wood-crop.png 与 low-light-strong-wood-crop.png 是两张 [52, 14, 32, 48] 的原像素木纹裁片。low-light-reference.png 为干净参考。其余两张文件展示参考图的缩图和木纹裁片。',
  prompt: visualInputBasics.prompt,
  deliverable: 'visual-review.md，记录图号、坐标、可见差异、不确定之处和脚本核对清单。',
  check: ['四张输入图的角色和对应关系清楚，木纹坐标与原图一致。', '分开描述观察、像素测量和需要参考图的指标。', '用一个裁片或一项读数抽查报告，保留无法确认的结论。'],
};
const labDescriptions = {
  A1: '实现数值稳定的 softmax 和贪心解码，验收极大分数与并列分数。',
  A2: '汇总配对任务的正确率、首 token 延迟与成本，按门槛筛选模型。',
};
const tracks = {
  A: { title: '通用主干', text: '从 LLM 的基本原理，到能调用工具、交接和恢复的 Agent。', sign: '⌘' },
  B: { title: '算法实战', text: '把论文、数据和实验整理成可以交付的研发成果。', sign: '↗' },
  C: { title: '前沿选修', text: '研究自动化、长期记忆与多 Agent 协作，按手头任务选读。', sign: '∿' },
};
const routes = [
  { key: 'apply', name: '日常使用 AI', text: '从模型边界、任务说明和编码协作入手，再学会组织上下文和复用方法。', ids: ['A1','A2','A3','A4','A5','A6','A7','A8','B1'] },
  { key: 'build', name: '做一个领域工具', text: '把已有脚本接到 AI 工作流，学习怎样留下运行记录、验证结果和处理失败。', ids: ['A6','A9','A10','A11','A12','B7','B9'] },
  { key: 'platform', name: '建设团队能力', text: '关心长任务、评测、协作和服务化时，从这里开始。', ids: ['A11','A12','A13','A14','A15','C4'] },
];
const demoCaptions = {
  A9: '切换故障和执行模式，再逐步看日志里哪条线索改变了下一步。示例日志为教学构造。',
  A11: '逐步提交、保存和恢复。看同一个幂等键如何找回第一次已经提交的任务。教学示意。',
  B8: '看同样预算下候选如何用开发集筛选，最后用独立样本验证。分数为教学设定。',
};
const sampleLesson = {
  question: '训练跑到一半停了。AI 先翻日志，接着应该查什么？',
  term: { name: 'Agent', meaning: '能根据工具返回的观察结果，决定下一步调用什么工具的程序。' },
  example: '如果日志报路径不存在，先检查配置里的路径。如果日志提示 GPU 显存耗尽，就对照配置与显存记录。把关键检查写进固定流程，把依赖线索的分支交给 Agent。',
};

const h = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const courseUrl = (id) => `courses/${id.toLowerCase()}/`;
const projectUrl = (id) => `projects/${id.toLowerCase()}/`;
const paragraphs = (items) => items.map(item => `<p>${h(item)}</p>`).join('');
const courseChip = (id, base) => {
  const item = courseMap.get(id);
  return pageCourseIds.includes(id) ? `<a class="chip" href="${base + courseUrl(id)}">${id} <span>${h(item.title)}</span></a>`
    : `<span class="chip">${id} <span>${h(item.title)}</span></span>`;
};

function validateData() {
  const expected = [...Object.entries({ A: 15, B: 12, C: 5 }).flatMap(([key, count]) => Array.from({length: count}, (_, index) => key + (index + 1)))];
  assert.deepEqual([...courseMap.keys()], expected);
  assert.deepEqual(projects.map(item => item.id), ['P1', 'P2', 'P3', 'P4']);
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
  for (const guide of projects) {
    assert(Array.isArray(guide.modules) && guide.modules.length > 0, `Missing related courses in ${guide.id}`);
    for (const id of guide.modules) assert(courseMap.has(id), `Missing module ${id}`);
    for (const key of ['title','tagline','problem','inputs','delegation','deliverable','decision','prompt','limit','lab']) {
      assert(typeof guide[key] === 'string' && guide[key].trim(), `Missing ${key} in ${guide.id}`);
    }
    assert(guide.workflow.length === 3 && guide.workflow.every(step => step.title && step.detail), `Incomplete workflow in ${guide.id}`);
    assert(guide.walkthrough.length >= 3 && guide.walkthrough.every(step => step.title && step.text && step.look && step.decision), `Incomplete guided case in ${guide.id}`);
    const { title, caption, headers, rows, holdout } = guide.example;
    const tableIsValid = (body) => body.length && body.every(row => row.length === headers.length && row.every(cell => typeof cell === 'string'));
    assert(title && caption && headers.length > 1 && tableIsValid(rows), `Incomplete example in ${guide.id}`);
    if (holdout) assert(holdout.caption && tableIsValid(holdout.rows), `Incomplete holdout in ${guide.id}`);
    for (const source of guide.sources ?? []) {
      assert(source.title && /^https:\/\//.test(source.url) && source.note, `Invalid source in ${guide.id}`);
    }
  }
  assert(denoiseCase.intro.length && denoiseCase.chapters.length >= 7, 'Incomplete denoising case');
  assert(new Set(denoiseCase.chapters.map(chapter => chapter.id)).size === denoiseCase.chapters.length, 'Duplicate case chapter');
  for (const chapter of denoiseCase.chapters) {
    assert(chapter.title && chapter.paragraphs.length >= 2, `Incomplete chapter ${chapter.id}`);
    if (chapter.artifact) assert(chapter.artifact.title && chapter.artifact.body, `Incomplete artifact in ${chapter.id}`);
  }
  assert(denoisePapers.length && denoisePapers.every(paper => paper.src && paper.alt && paper.caption && paper.license && /^https:\/\//.test(paper.url) && /^https:\/\//.test(paper.licenseUrl)), 'Incomplete paper attribution');
  for (const [id, lesson] of Object.entries(deepLessons)) validateDeepLesson(id, lesson);
  if (sample) return;
  assert.deepEqual(Object.keys(lessons).sort(), expected.sort());
  for (const [id, lesson] of Object.entries(lessons)) {
    const { question, example, term } = lesson;
    assert([question, example, term?.name, term?.meaning].every(value => typeof value === 'string' && value.trim()), `Missing teaching content ${id}`);
  }
  for (const [id, chapters] of Object.entries(llmChapters)) {
    assert(chapters.length >= 3 && new Set(chapters.map(chapter => chapter.id)).size === chapters.length, `Incomplete chapters for ${id}`);
    for (const chapter of chapters) {
      assert(chapter.title && chapter.intuition && chapter.details.length >= 2 && chapter.example, `Incomplete chapter ${chapter.id}`);
      assert(/^llm-flow\/[a-z0-9-]+\.svg$/.test(chapter.figure.src) && chapter.figure.alt && chapter.figure.caption, `Missing chapter figure ${chapter.id}`);
    }
  }
  for (const [id, entries] of Object.entries(figures)) {
    assert(courseMap.has(id) && entries.length, `Invalid research figure entry ${id}`);
    for (const entry of entries) {
      assert(/^figures\/[\w.-]+\.(svg|png|webp|jpe?g)$/.test(entry.src), `Invalid figure path ${id}`);
      assert(entry.alt && entry.caption && entry.sourceTitle && /^https:\/\//.test(entry.sourceUrl) && entry.license, `Missing figure attribution ${id}`);
    }
  }
}

function shell(base, title, active, main, caseStyles = false) {
  const links = [['home','', '首页'], ['paths','paths/', '学习路线'], ['courses','courses/', '课程目录'], ['projects','projects/', '实战案例']];
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f5f6ed">
<meta name="description" content="面向算法研发同事的 AI 自助培训，含课程、实战工作流和本地任务包。">
<title>${h(title)} · AI 辅助研发训练手册</title><link rel="icon" href="${base}assets/mark.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}assets/style.css">${caseStyles || ['home','projects'].includes(active) ? `<link rel="stylesheet" href="${base}assets/case-guide.css">` : ''}${active === 'projects' && !sample ? `<link rel="stylesheet" href="${base}assets/workflow-examples/p34-interaction.css">` : ''}
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
<section class="home-cases"><div class="section-heading"><h2>研发案例</h2><a class="text-link" href="projects/">阅读完整案例 ↗</a></div>${projectCards('')}</section></div>`;
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

function localLab(id, base, description = labDescriptions[id], reproducible = false) {
  return `<section id="practice" class="lab-section"><h2>本地实操</h2><p>${h(description)}</p>
<p>${reproducible ? '任务包内含完整实现、实验协议、验收测试和本站发布的产物。只做评审可以直接打开快照。需要复算时使用 Python 3.10+。' : '任务包内含任务单、示例数据、待实现代码和验收测试。需要 Python 3.10+。'}</p>
 ${reproducible ? '<ol class="text-list"><li>解压 ZIP，打开 <code>published/demo.html</code> 和报告，先看同均值对照与木纹局部。</li><li>用本地 Agent 打开目录，请它读 <code>task.md</code>，依据已交付的文件写一页评审备忘录。</li><li>抽查它引用的坐标和读数，自己决定还要补哪类样本。需要复算时，按 <code>README.md</code> 操作。</li></ol>' : id === 'P1' ? '<ol class="text-list"><li>解压 ZIP，把目录交给本地 Agent，请它先读 <code>task.md</code> 和四张论文证据卡。</li><li>让它写选型备忘录。自己抽查两幅论文图，再确定首试和边界检查。</li><li>团队若要重复使用筛选规则，可按任务单让 Agent 把规则整理成脚本。</li></ol>' : `
<ol class="text-list"><li>下载并解压 ZIP，在包含 <code>task.md</code> 的目录打开终端。</li>
<li>启动 <code>opencode</code>，或用其他编码 Agent 打开该目录。输入「先读 task.md 和测试，完成任务并运行验收」。</li>
<li>自己运行 <code>python -m unittest -v</code>，核对 Agent 的改动与输出。</li></ol>`}
<div class="actions"><a class="button primary" href="${base}downloads/${id.toLowerCase()}.zip" download>下载 ${id} 任务包 · ZIP</a><a class="text-link" href="https://opencode.ai/docs/cli/">OpenCode 使用说明 ↗</a></div></section>`;
}

function llmChapter(chapter, index, base) {
  const { figure } = chapter;
  const src = base + 'assets/' + h(figure.src);
  return `<section class="llm-chapter" id="${h(chapter.id)}"><h2><span class="chapter-index">${String(index + 1).padStart(2, '0')}</span>${h(chapter.title)}</h2>
<p class="llm-intuition">${h(chapter.intuition)}</p>
<figure class="research-figure"><a href="${src}" aria-label="查看大图：${h(figure.alt)}"><img src="${src}" alt="${h(figure.alt)}" loading="lazy"></a><figcaption>${h(figure.caption)} <a class="figure-enlarge" href="${src}">查看大图 ↗</a></figcaption></figure>
<h3>技术细节</h3>${paragraphs(chapter.details)}
<div class="llm-example"><strong>算例与应用</strong><p>${h(chapter.example)}</p></div>
${chapter.sources?.length ? `<ul class="llm-sources">${chapter.sources.map(source => `<li><a href="${h(source.url)}">${h(source.title)} ↗</a></li>`).join('')}</ul>` : ''}</section>`;
}

const foundationAnchors = { A3: 'visual-input', A4: 'spec-driven-development', B9: 'denoise-evidence' };
function courseFoundation(id, base) {
  const caseUrl = base + 'projects/';
  if (id === 'A4') {
    const { title, intro, steps, before, after, check } = sddBasics;
    return `<section id="${foundationAnchors[id]}" class="course-foundation"><h2>${h(title)}</h2><p>${h(intro)}</p>
<ol class="foundation-steps">${steps.map(step => `<li><strong>${h(step.title)}</strong><p>${h(step.text)}</p></li>`).join('')}</ol>
<div class="foundation-compare"><div><h3>需求原句</h3><p>${h(before)}</p></div><div><h3>可验收的规格</h3><pre>${h(after)}</pre></div></div>
<p>${h(check)}</p><p><a href="${caseUrl}#problem">回到案例 · 确定改动范围</a> · <a href="${base}downloads/p4.zip" download>下载用到的协议和样本</a></p></section>`;
  }
  if (id === 'B9') {
    const { title, intro, sections, check } = imageEvidenceBasics;
    return `<section id="${foundationAnchors[id]}" class="course-foundation"><h2>${h(title)}</h2><p>${h(intro)}</p>
${fusionImage(base, 'roi-comparison.svg', '同坐标比较暗墙、木纹、灯芯和过渡带', '同一行是同一个裁剪框。先认准参考图，再从左到右比较各路输出。', h)}
${sections.map(section => `<section id="${h(section.id)}"><h3>${h(section.title)}</h3>${paragraphs([section.body].flat())}<p class="foundation-example">${h(section.example)}</p></section>`).join('')}
<p>${h(check)}</p><p><a href="${caseUrl}#review">回到案例 · 核对同一区域</a></p></section>`;
  }
  return '';
}

function course(item, fusionResult) {
  const base = '../../';
  const lesson = lessons[item.id] ?? sampleLesson;
  const chapters = llmChapters[item.id];
  const visual = item.id === 'A3';
  const deep = deepLessons[item.id];
  const foundationTitle = { A3: visualInputBasics.title, A4: sddBasics.title, B9: imageEvidenceBasics.title }[item.id];
  const related = sample ? [] : projects.filter(project => project.modules.includes(item.id));
  const next = modules[modules.indexOf(item) + 1];
  return `<div class="wrap"><div class="breadcrumbs"><a href="../">课程目录</a><span>/</span><a href="../#track-${item.track}">${tracks[item.track].title}</a><span>/</span><span>${item.id}</span></div>
<div class="reading-layout"><article><header class="lesson-header"><p class="eyebrow">${item.id} · ${h(item.level)}</p><h1>${h(item.title)}</h1>${visual ? '' : deep ? `<p class="intro">${h(deep.intro)}</p>` : `<p class="intro">${h(lesson.question)}</p><p>${h(item.goal)}</p>`}
${item.prerequisites.length ? `<div class="prerequisites"><strong>先修</strong> ${item.prerequisites.map(id => courseChip(id, base)).join(' ')}</div>` : ''}</header>
${visual ? visualInputLesson(visualInputBasics, fusionResult, base, h) : deep ? deepContent(deep, h) : chapters ? `<nav id="concept" class="llm-contents" aria-label="章节目录"><h2>章节目录</h2><ol>${chapters.map(chapter => `<li><a href="#${h(chapter.id)}">${h(chapter.title)}</a></li>`).join('')}</ol><a class="text-link" href="#practice">本地实操 ↓</a></nav>${chapters.map((chapter, index) => llmChapter(chapter, index, base)).join('')}` : `<section id="concept"><h2>原理与示例</h2><dl class="definition"><dt>${h(lesson.term.name)}</dt><dd>${h(lesson.term.meaning)}</dd></dl><p class="example">${h(lesson.example)}</p>${paragraphs(item.core)}${figureMarkup(item, base)}<p class="note lesson-note"><b>常见误区</b>　${h(item.failure)}</p></section>`}
${courseFoundation(item.id, base)}
${deep && figures[item.id]?.length ? `<section id="research-figures"><h2>论文图解</h2>${figureMarkup(item, base)}</section>` : ''}
${demoCaptions[item.id] ? `<section id="demo"><h2>分步演示</h2><p>${demoCaptions[item.id]}</p><div data-process="${item.id}"></div><noscript><p>启用 JavaScript 后可单步操作演示。</p></noscript></section>` : ''}
${visual ? deepTask(item.id, visualTask, base, h) : deep ? deepTask(item.id, deep.task, base, h) : chapters ? localLab(item.id, base) : ''}
<section id="references"><h2>继续阅读</h2><ul class="source-list">${(deep?.sources ?? item.references.map(id => sourceMap.get(id))).map(source => `<li><a href="${h(source.url)}">${h(source.title)} ↗</a>${source.use ? `<p>${h(source.use)}</p>` : ''}</li>`).join('')}</ul>
${related.length ? `<h3>相关案例</h3><ul class="text-list">${related.map(project => `<li><a href="${base + projectUrl(project.id)}">${project.id} · ${h(project.title)}</a></li>`).join('')}</ul>` : ''}</section>
<div class="lesson-end"><button type="button" class="button secondary" data-complete="${item.id}" aria-pressed="false" hidden>标记已学</button><span data-save-message role="status"></span>${next && !sample ? `<a class="text-link" href="${base + courseUrl(next.id)}">下一课 ${next.id} ↗</a>` : ''}</div></article>
<aside class="reading-aside"><nav aria-label="本课导航"><strong>本课内容</strong><a href="#concept">${chapters || visual || deep ? '章节目录' : '原理与示例'}</a>${foundationTitle ? `<a href="#${foundationAnchors[item.id]}">${h(foundationTitle)}</a>` : ''}${demoCaptions[item.id] ? '<a href="#demo">分步演示</a>' : ''}<a href="#practice">本地任务</a><a href="#references">继续阅读</a></nav></aside></div></div>`;
}

function projectCards(base) {
  return `<div class="project-cards illustrated-cards">${projects.map(item =>
    `<a class="project-card illustrated-card" href="${base + (sample ? 'projects/' : projectUrl(item.id))}">
<div class="case-card-text"><div class="case-card-label"><span class="project-code">${stages[item.id]}</span><span aria-hidden="true">↗</span></div>
<h3>${h(item.title)}</h3><p>${h(item.tagline)}</p><span class="case-card-output">${h(item.deliverable)}</span></div></a>`).join('')}</div>`;
}

function stageNav(base, current) {
  return `<nav class="workflow-journey" aria-label="案例进度">${projects.map((item, index) =>
    `<a href="${base + (sample ? 'projects/' : projectUrl(item.id))}"${item.id === current ? ' aria-current="step"' : ''}><span>${index + 1}</span> ${stages[item.id]} <span aria-hidden="true">↗</span></a>`).join('')}</nav>`;
}

function workflowEvidence(base, current) {
  const evidence = [
    ['P1', '论文 → 候选方案', '从 FFDNet 图 5 提取“空间控制”这个可试机制。', '交付：带出处的候选表'],
    ['P2', '补充练习 · 一维筛选', '同口径比较门控中值、普通中值和均值。', '交付：可复算的剖面报告'],
    ['P3', '补充练习 · 数据生成', '可复跑的暗区、木纹和高光退化。', '交付：参考图、退化图、清单'],
    ['P4', '正文复现 · 二维分区融合', '从同样的弱、强输出复跑固定与分区权重。', '交付：报告、Demo 和任务包'],
  ];
  return `<figure class="workflow-evidence"><figcaption><strong>案例阅读与复现资料</strong><p>从 P1 查论文依据，从 P4 复跑正文实验。</p></figcaption>
<ol>${evidence.map(([id, title, text, output], index) => `<li><a href="${base + (sample ? 'projects/' : projectUrl(id))}"${id === current ? ' aria-current="step"' : ''}><span class="guide-index">${index + 1}</span><strong>${title}</strong><span>${text}</span><small>${output}</small></a></li>`).join('')}</ol></figure>`;
}

function publishedFigures(base) {
  return denoisePapers.map(paper => {
    const src = base + 'assets/' + paper.src;
    return `<figure class="story-figure paper-original"><a href="${h(src)}"><img src="${h(src)}" loading="lazy" alt="${h(paper.alt)}"></a><figcaption><strong>论文原图</strong>　${h(paper.caption)}<br><a href="${h(paper.url)}">${h(paper.title)} ↗</a> · <a href="${h(paper.licenseUrl)}">${h(paper.license)}</a> · <a href="${h(src)}">放大原图 ↗</a></figcaption></figure>`;
  }).join('');
}

function ffdnetComparison() {
  return `<figure class="story-figure paper-proof"><figcaption><strong>FFDNet 图 5 · 同一张带噪图，两种噪声图</strong></figcaption>
<dl class="paper-panels">
<div><dt>(a) 带噪输入 <span>20.55 dB</span></dt><dd>在原图标出两处，一处颗粒明显，一处还能看见细纹。</dd></div>
<div><dt>(b) 空间变化的真值噪声图 <span>30.08 dB</span></dt><dd>对照噪声图和输出，看看两处各用多大的强度。</dd></div>
<div><dt>(c) 用均值填满噪声图 <span>27.45 dB</span></dt><dd>回到相同位置。高噪处还剩多少颗粒，低噪处的细纹还在不在？</dd></div>
</dl><p><a href="https://arxiv.org/html/1710.04026v2#S4.F5">FFDNet 图 5 原图</a>。读数来自论文，使用峰值信噪比（PSNR）表示输出与参考图的差距。</p>
<p>分区的边界可以另读 <a href="https://www.tommertens.com/old-academic/papers/exposure_fusion_reduced.pdf#page=5">Mertens 等，图 4</a>。注意 (b) 权重突变留下的接缝、(c) 平滑后出现的光晕，以及 (e) 的多尺度融合结果。</p></figure>`;
}

function denoiseStory(result) {
  const order = ['problem', 'research', 'transfer', 'data', 'experiment', 'review', 'holdout', 'handoff'];
  const chapters = order.map(id => {
    const chapter = denoiseCase.chapters.find(item => item.id === id);
    assert(chapter, `Missing case chapter ${id}`);
    return chapter;
  });
  const imagePrerequisite = sample ? '' : `<p>第一次看这类对照图，可以先读 <a href="../${courseUrl('B9')}#${foundationAnchors.B9}">B9 · 读懂降噪对照图</a>。</p>`;
  const figuresByChapter = {
    problem: () => sample ? '' : `<p>把输入、改动范围和验收写在同一份任务单上，见 <a href="../${courseUrl('A4')}#${foundationAnchors.A4}">A4 · 用规格驱动 AI 开发</a>。</p>`,
    research: () => researchRecord(fusionSelection, h)
      + (sample ? '' : '<p><a href="p1/#demo">试着改变数据和接口条件，看看哪些路线还能用</a></p>')
      + `<details class="artifact-reference"><summary>延伸读图 · 同坐标怎么看纹理损失</summary>${publishedFigures('../')}${paperTextureRead('../', denoisePapers[0], h)}</details>`,
    transfer: () => fusionFlow() + fusionImage('../', 'comparison.svg', '带噪输入、弱和强降噪、固定和分区融合以及权重图', '同一张合成图的各路输出。分区权重图越亮，采用的强降噪输出越多。', h),
    experiment: () => controlReview('../', result) + fusionResults(result, h),
    review: () => fusionImage('../', 'roi-comparison.svg', '暗墙、木纹、灯芯与接缝的同坐标对照', '每一行取同一个位置。先与参考图比较，再沿行看不同输出的差异。', h) + inspectFusionRegions('../'),
  };
  return `<div class="wrap story-page"><header class="story-hero">
<div class="story-hero-copy"><p class="eyebrow">算法研发案例</p><h1>低照度图像的分区降噪</h1>
<div class="story-lead">${paragraphs(denoiseCase.intro)}</div>
</div>${denoiseOpening('../')}</header>
<div class="story-layout"><aside class="story-sidebar"><nav aria-label="案例章节"><strong>目录</strong><ul>${chapters.map(chapter => `<li><a href="#${h(chapter.id)}">${h(chapter.title)}</a></li>`).join('')}<li><a href="#appendix">附录</a></li></ul></nav></aside>
<article class="story-article" aria-label="夜景降噪案例正文">
<span id="ai-workflow" class="story-anchor" aria-hidden="true"></span>
${chapters.map(chapter => `<section class="story-chapter" id="${h(chapter.id)}"><h2>${h(chapter.title)}</h2>
${chapter.lead ? `<p class="story-chapter-lead">${h(chapter.lead)}</p>` : ''}
${chapter.id === 'review' ? imagePrerequisite : ''}
${chapter.id === 'research'
    ? paragraphs(chapter.paragraphs.slice(0, -1)) + ffdnetComparison() + paragraphs(chapter.paragraphs.slice(-1))
    : paragraphs(chapter.paragraphs)}
${figuresByChapter[chapter.id]?.() ?? ''}
${chapter.artifact ? `<details class="case-prompt"><summary>${h(chapter.artifact.title)}</summary><pre><code data-copy-source>${h(chapter.artifact.body)}</code></pre><button type="button" class="button secondary" data-copy-case hidden>复制</button><span data-copy-status role="status"></span></details>` : ''}
${chapter.note ? `<p class="note workflow-limit">${h(chapter.note)}</p>` : ''}</section>`).join('')}
<section id="appendix" class="story-chapter story-appendix"><h2>附录</h2>${fusionLinks('../')}${revisionRecord(fusionRevision, h)}<details class="artifact-reference"><summary>阅读、选型与本地任务</summary>${projectCards('../')}</details></section></article></div></div>`;
}

function caseStartLink(id) {
  const chapter = { P1: 'research', P2: 'experiment', P3: 'data', P4: 'review' }[id];
  return `../#${chapter}`;
}

function guidedCase(guide) {
  const title = { P1: '从原文到对照方案', P4: '怎样复核评审材料' }[guide.id] || '工作示例';
  return `<section id="steps"><h2>${title}</h2>
<ol class="guided-workflow">${guide.walkthrough.map((step, index) => `<li><span class="guide-index">${index + 1}</span><div><h3>${h(step.title)}</h3><p>${h(step.text)}</p><dl><div><dt>看什么</dt><dd>${h(step.look)}</dd></div><div><dt>据此做什么</dt><dd>${h(step.decision)}</dd></div></dl></div></li>`).join('')}</ol>
<dl class="case-contract"><div><dt>团队提供</dt><dd>${h(guide.inputs)}</dd></div><div><dt>AI 承担</dt><dd>${h(guide.delegation)}</dd></div><div><dt>交付物</dt><dd>${h(guide.deliverable)}</dd></div></dl>
<details class="case-prompt"><summary>给 Agent 的任务示例</summary><pre><code data-copy-source>${h(guide.prompt)}</code></pre><button type="button" class="button secondary" data-copy-case hidden>复制任务单</button><span data-copy-status role="status"></span></details></section>`;
}

function artifactTable(headers, rows, caption, subset) {
  return `<div class="artifact-table" data-workflow-panel="${subset}" tabindex="0" role="region" aria-label="${subset === 'holdout' ? '留出集结果' : '示例结果'}">
<table><caption>${h(caption)}</caption><thead><tr>${headers.map(header => `<th scope="col">${h(header)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(([name, ...cells]) => `<tr><th scope="row">${h(name)}</th>${cells.map(cell => `<td>${h(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function examplePreview(id, base) {
  if (id === 'P3') return `<figure class="workflow-preview"><a href="${base}assets/workflow-examples/p3-samples.svg"><img src="${base}assets/workflow-examples/p3-samples.svg" alt="查看三组样本大图：暗区噪声、细纹理和高光截断" loading="lazy"></a><figcaption>每类各展示一对样本，左侧为参考图，右侧为退化输入。<a class="figure-enlarge" href="${base}assets/workflow-examples/p3-samples.svg">查看大图 ↗</a></figcaption></figure>`;
  return '';
}

function projectDetail(guide) {
  const base = '../../';
  const { example } = guide;
  if (guide.id === 'P4') return `<div class="wrap case-page"><div class="breadcrumbs"><a href="../">实战案例</a><span>/</span><span>P4</span></div><header class="story-hero"><h1>${h(guide.title)}</h1><p class="intro">${h(guide.problem)}</p><a href="../#review">回到正文评审 ↗</a></header><article class="case-body"><section id="demo"><h2>同一实验的输出</h2><p>报告、像素图与 Demo 由同一条命令生成。</p>${fusionLinks(base)}</section>${localLab('P4', base, guide.lab, true)}${guidedCase(guide)}<section id="checks"><h2>验收边界</h2><p>${h(guide.limit)}</p></section></article></div>`;
  return `<div class="wrap case-page"><div class="breadcrumbs"><a href="../">实战案例</a><span>/</span><span>${guide.id}</span></div>
<header class="case-hero"><div><p class="eyebrow">${guide.id} · 算法团队工作流</p><h1>${h(guide.title)}</h1><p class="intro">${h(guide.problem)}</p>
<div class="actions"><a class="button primary" href="${caseStartLink(guide.id)}">阅读正文 ↗</a><a class="button secondary" href="#practice">本地实操</a></div></div>
${workflowEvidence(base, guide.id)}</header>
${stageNav(base, guide.id)}
<article class="case-body">
${guidedCase(guide)}
<section id="demo"><h2>${guide.id === 'P1' ? '按项目条件筛选论文' : '复算工具与原始记录'}</h2>
<details class="artifact-reference workflow-optional"${guide.id === 'P1' ? ' open' : ''}><summary>${h(guide.interactionTitle || '打开复算工具')}</summary><p class="interaction-intro">${h(guide.interactionIntro || stageIntros[guide.id])}</p>
<div class="workflow-workspace" data-workflow-id="${guide.id.toLowerCase()}"${workflowFixtures[guide.id] ? ` data-fixture="${base}assets/workflow-examples/${workflowFixtures[guide.id][1]}"` : ''}><p>正在载入交互工作台…</p></div><noscript><p>开启 JavaScript 后可操作工作台，示例和来源仍可查看。</p></noscript>
</details>
<details class="artifact-reference"><summary>${h(example.title)}</summary>
${examplePreview(guide.id, base)}
${example.holdout ? '<div class="artifact-switch" data-workflow-switch hidden role="group" aria-label="结果数据范围"><button type="button" class="button" data-workflow-subset="dev" aria-pressed="true">开发集 · 筛选候选</button><button type="button" class="button" data-workflow-subset="holdout" aria-pressed="false">留出集 · 复核结论</button></div>' : ''}
${example.headers.length > 3 ? '<p class="artifact-scroll-hint">横向滑动查看全部列</p>' : ''}
${artifactTable(example.headers, example.rows, example.caption, 'dev')}
${example.holdout ? artifactTable(example.headers, example.holdout.rows, example.holdout.caption, 'holdout') : ''}</details>
${guide.sources?.length ? `<ul class="source-list">${guide.sources.map(source => `<li><a href="${h(source.url)}">${h(source.title)} ↗</a><p>${h(source.note)}</p></li>`).join('')}</ul>` : ''}</section>
<section id="checks"><h2>${guide.id === 'P1' ? '本案采用的方案' : '结果与适用条件'}</h2><p>${h(guide.decision)}</p><p class="note workflow-limit">${h(guide.limit)}</p></section>
${localLab(guide.id, base, guide.lab)}
<section id="related"><h2>相关课程</h2><div class="prerequisites">${guide.modules.map(id => courseChip(id, base)).join(' ')}</div></section>
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
      if (attribute === 'data:,' || /^data:image\/png;base64,[A-Za-z0-9+/=]+$|^https:\/\//.test(attribute)) continue;
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
for (const [source, target] of Object.values(workflowFixtures)) {
  await cp(join(site, 'labs', source), join(dist, 'assets', 'workflow-examples', target));
}
const fusionOutput = join(dist, fusionPath);
execFileSync(python, [join(site, 'labs', 'p4', 'solution.py'), '--out', fusionOutput], { stdio: 'inherit' });
const fusionResult = JSON.parse(await readFile(join(fusionOutput, 'result.json'), 'utf8'));
assert(fusionResult.experiment_id && fusionResult.metrics.global && fusionResult.metrics.spatial && fusionResult.gates.length, 'Incomplete fusion experiment output');
const lessonTasks = await mkdtemp(join(tmpdir(), 'training-tasks-'));
try {
  const tasks = [['A3', visualTask], ...Object.entries(deepLessons).map(([id, lesson]) => [id, lesson.task])];
  await Promise.all(tasks.map(([id, task]) => writeFile(join(lessonTasks, id.toLowerCase() + '.md'), taskMarkdown(id, courseMap.get(id).title, task), 'utf8')));
  execFileSync(python, [join(site, 'package-labs.py'), join(dist, 'downloads'), fusionOutput, lessonTasks], { stdio: 'inherit' });
} finally {
  await rm(lessonTasks, { recursive: true, force: true });
}
await write('.nojekyll', '');
await write('index.html', shell('', '首页', 'home', home()));
await write('paths/index.html', shell('../', '学习路线', 'paths', paths()));
await write('courses/index.html', shell('../', '课程目录', 'courses', catalog()));
await write('projects/index.html', shell('../', '低照度图像的分区降噪', 'projects', denoiseStory(fusionResult)));
for (const id of pageCourseIds) {
  const item = courseMap.get(id);
  await write(courseUrl(id) + 'index.html', shell('../../', item.title, 'courses', course(item, fusionResult), Boolean(foundationAnchors[id] || deepLessons[id])));
}
if (!sample) {
  for (const item of projects) await write(projectUrl(item.id) + 'index.html', shell('../../', item.title, 'projects', projectDetail(item)));
}
const pages = await checkLinks();
console.log(`Verified ${pages} HTML pages, ${pageCourseIds.length} courses and ${sample ? 0 : projects.length} project details.`);
