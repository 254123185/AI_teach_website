import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blindSpotCheck, caseHandoff, controlReview, denoiseOpening, fusionFlow, pairedSample, paperTextureRead, profileEvidence, researchRecord, revisionRecord, fusionImage, fusionResults, fusionLinks, inspectFusionRegions } from './fusion-case.mjs';
import { visualInputLesson } from './visual-input.mjs';
import { deepContent, deepTask, evidenceTable, lessonFlow, taskMarkdown, validateDeepLesson } from './deep-lesson.mjs';
import { showSkillExamples, skillExamples } from './skill-lesson.mjs';
import { onboardingLesson, validateOnboarding } from './onboarding.mjs';
import { publicCourseDirectory, publicCourseDetail, publicCourseLabel, publicCoursesEntry, publicCoursesIndex, publicCourseUrl, validatePublicCourses } from './public-courses.mjs';

const site = dirname(fileURLToPath(import.meta.url));
const dist = resolve(site, '../dist');
const sample = process.argv.includes('--sample');
const json = async (name) => JSON.parse((await readFile(join(site, 'content', name), 'utf8')).replace(/^\uFEFF/, ''));
const { modules, sources, version } = await json('curriculum.json');
const onboarding = await json('onboarding.json');
const publicCourses = (await Promise.all(['public-courses-cn.json', 'public-courses-en.json'].map(json))).flat();
const publicCourseFit = await json('public-course-fit.json');
const projects = await Promise.all(['P1', 'P2', 'P3', 'P4'].map(async id =>
  ({ id, ...await json(`workflows/${id.toLowerCase()}.json`) })));
const workflowFixtures = {
  P2: ['p2/fixtures.json', 'p2-fixtures.json'],
  P3: ['p3/scenarios.json', 'p3-scenarios.json'],
};
const profileFixtures = sample ? null : JSON.parse(await readFile(join(site, 'labs', workflowFixtures.P2[0]), 'utf8'));
const denoiseCase = await json('denoise-case.json');
const denoisePapers = [await json('denoise-paper.json')].flat();
const fusionSelection = await json('fusion-selection.json');
const fusionRevision = await json('fusion-revision.json');
const sddBasics = await json('sdd-basics.json');
const imageEvidenceBasics = await json('image-evidence-basics.json');
const visualInputBasics = await json('visual-input-basics.json');
const fusionPath = 'experiments/tea-shop/';
const fusionSnapshot = process.env.TRAINING_FUSION_SNAPSHOT && resolve(process.env.TRAINING_FUSION_SNAPSHOT);
const python = process.env.TRAINING_PYTHON || 'python';
const caseTitle = '低照度图像的分区降噪';
const caseMenuLabel = '实战案例';
const casePath = 'projects/';
const caseScope = 'P1 讲项目怎样选论文，P4 复核正文里的二维实验。P2 和 P3 分别用独立的教学数据演练候选筛选与样本生成。';
const caseTopics = {
  P1: { label: '论文选型', type: '正文选型记录', section: 'research', chapter: '为什么参考 FFDNet', tool: '论文选型演示', steps: '从原文到对照方案' },
  P2: { label: '候选验证', type: '一维教学工作台', section: 'experiment', chapter: '二维融合对照', tool: '一维候选筛选', steps: '怎样用短测筛候选' },
  P3: { label: '生成样本', type: '16×8 教学工作台', section: 'data', chapter: '正文的 128×80 样本', tool: '16×8 样本生成器', steps: '怎样给 AI 定义配对样本' },
  P4: { label: '结果评审', type: '正文实验复核', section: 'review', chapter: '同坐标评审', tool: '二维对照图、报告与 Demo', steps: '怎样复核评审材料' },
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
const onboardingUrl = 'courses/onboarding/';
const projectUrl = (id) => `${casePath}${id.toLowerCase()}/`;
const paragraphs = (items) => items.map(item => `<p>${h(item)}</p>`).join('');
const courseChip = (id, base) => {
  const item = courseMap.get(id);
  return pageCourseIds.includes(id) ? `<a class="chip" href="${base + courseUrl(id)}">${id} <span>${h(item.title)}</span></a>`
    : `<span class="chip">${id} <span>${h(item.title)}</span></span>`;
};

function validateData() {
  const expected = [...Object.entries({ A: 15, B: 12, C: 5 }).flatMap(([key, count]) => Array.from({length: count}, (_, index) => key + (index + 1)))];
  assert.deepEqual([...courseMap.keys()], expected);
  validateOnboarding(onboarding, courseMap);
  validatePublicCourses(publicCourses, publicCourseFit, courseMap);
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
    assert(denoiseCase.chapters.some(chapter => chapter.id === caseTopics[guide.id]?.section), `Missing case chapter for ${guide.id}`);
    if (guide.id !== 'P4') assert(guide.interactionIntro?.trim(), `Missing demo introduction in ${guide.id}`);
    assert(Array.isArray(guide.modules) && guide.modules.length > 0, `Missing related courses in ${guide.id}`);
    for (const id of guide.modules) assert(courseMap.has(id), `Missing module ${id}`);
    for (const key of ['title','tagline','problem','inputs','delegation','deliverable','decision','prompt','limit','lab']) {
      assert(typeof guide[key] === 'string' && guide[key].trim(), `Missing ${key} in ${guide.id}`);
    }
    assert(guide.workflow.length === 3 && guide.workflow.every(step => step.title && step.detail), `Incomplete workflow in ${guide.id}`);
    assert(guide.walkthrough.length >= 3 && guide.walkthrough.every(step => step.title && step.text && step.look && step.decision), `Incomplete guided case in ${guide.id}`);
    for (const key of ['title', 'intro', 'artifactTitle', 'artifact', 'check', 'saved']) {
      assert(typeof guide.handoff?.[key] === 'string' && guide.handoff[key].trim(), `Missing handoff ${key} in ${guide.id}`);
    }
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
      assert(chapter.figure.caption && (chapter.figure.src
        ? /^llm-flow\/[a-z0-9-]+\.svg$/.test(chapter.figure.src) && chapter.figure.alt
        : chapter.figure.nodes?.length >= 2), `Missing chapter figure ${chapter.id}`);
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
  const links = [['home','', '首页'], ['public',publicCourseDirectory, '公开课程'], ['paths','paths/', '学习路线'], ['courses','courses/', '课程目录'], ['projects',casePath,caseMenuLabel]];
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
</div><figcaption>按报错线索选择检查项。 <a href="${base + courseUrl('A9')}#demo">看 A9 训练故障排查演示 ↗</a></figcaption></div></figure>`;
}

function home() {
  return `<div class="wrap">${publicCoursesEntry(publicCourses.length, publicCourseFit, h)}<section class="hero"><div><p class="eyebrow">算法研发 · 自助培训</p>
<h1>把 AI 用到<br>日常研发里<span>。</span></h1>
<p class="intro">算法研发自学材料，覆盖模型原理、论文复现、实验诊断、图像质量和部署。</p>
<div class="actions"><a class="button primary" href="paths/">选一条学习路线 <span aria-hidden="true">↗</span></a><a class="button secondary" href="courses/">浏览课程</a></div>
<div class="hero-summary"><span><b>32</b> 门课程</span><span><b>4</b> 个实战专题</span></div></div>${workflowArt('')}</section>
<section class="home-tracks" aria-labelledby="tracks-title"><div class="section-heading"><div><h2 id="tracks-title">课程内容</h2></div><a class="text-link" href="courses/">查看完整目录 ↗</a></div>
<div class="cards">${Object.entries(tracks).map(([key, track]) => `<a class="track-card" href="courses/#track-${key}"><span class="track-sign" aria-hidden="true">${track.sign}</span><h3>${track.title}</h3><p>${track.text}</p><span class="card-end">${modules.filter(item => item.track === key).length} 门课程 <span aria-hidden="true">↗</span></span></a>`).join('')}</div></section>
<section class="home-cases" aria-labelledby="home-cases"><div class="section-heading"><h2 id="home-cases">${caseMenuLabel}</h2><a data-case-overview class="text-link" href="${casePath}">打开实战案例总览 ↗</a></div>
<div class="case-overview-copy"><h3>${caseTitle}</h3><p>${caseScope}</p></div>${projectCards('')}</section></div>`;
}

function paths() {
  return `<div class="wrap"><section class="page-intro"><h1>学习路线</h1><p class="intro">找外部课可以先看 <a href="../${publicCourseDirectory}">公开课程适配表</a>。学本站课程时，按手头的研发任务选择下面的路线。</p></section>
<div class="route-list">${routes.map(route => `<section class="route" id="${route.key}"><h2>${route.name}</h2><p>${route.text}</p><ol>${route.ids.map(id => `<li>${courseChip(id, '../')}</li>`).join('')}</ol></section>`).join('')}</div>
<p class="route-case-link"><a data-case-overview class="text-link" href="../${casePath}">打开实战案例总览 ↗</a> · ${caseTitle}</p></div>`;
}

function catalog() {
  return `<div class="wrap"><section class="page-intro"><h1>课程目录</h1></section>
<div class="catalog-toolbar"><label class="search"><span>搜索课程与学习资料</span><input type="search" data-course-search placeholder="搜索标题、主题或编号" autocomplete="off"></label><p class="catalog-count" data-course-count aria-live="polite">${modules.length} 门课程 · ${publicCourseLabel}</p></div>
<div class="tabs"><a href="#track-public">${publicCourseLabel}</a><a href="#track-A">通用主干</a><a href="#track-B">算法实战</a><a href="#track-C">前沿选修</a></div><p data-empty hidden>没有找到课程或学习资料，试试别的关键词。</p>
<section class="catalog-track" data-course-group="public" id="track-public"><h2>${publicCourseLabel}</h2><div class="catalog-list"><a class="catalog-item public-catalog-item" data-course-card data-keywords="${h(publicCourses.map(item => `${item.provider} ${item.title} ${item.summary}`).join(' '))}" href="../${publicCourseDirectory}"><div><h3>查看公开课程适配表</h3><p>按学习目的比较 ${publicCourses.length} 门外部课程，点课程名看详情。</p></div><span class="catalog-arrow" aria-hidden="true">↗</span></a></div></section>
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
<div class="actions"><a class="button primary" href="${base}downloads/${id.toLowerCase()}.zip" download>下载 ${id} ${reproducible ? '复现包' : '任务包'} · ZIP</a><a class="text-link" href="https://opencode.ai/docs/cli/">OpenCode 使用说明 ↗</a></div></section>`;
}

function llmChapter(chapter, index, base) {
  const { figure } = chapter;
  const src = base + 'assets/' + h(figure.src);
  return `<section class="llm-chapter" id="${h(chapter.id)}"><h2><span class="chapter-index">${String(index + 1).padStart(2, '0')}</span>${h(chapter.title)}</h2>
<p class="llm-intuition">${h(chapter.intuition)}</p>
${figure.src ? `<figure class="research-figure"><a href="${src}" aria-label="查看大图：${h(figure.alt)}"><img src="${src}" alt="${h(figure.alt)}" loading="lazy"></a><figcaption>${h(figure.caption)} <a class="figure-enlarge" href="${src}">查看大图 ↗</a></figcaption></figure>` : lessonFlow(figure, h)}
<h3>技术细节</h3>${paragraphs(chapter.details)}
<div class="llm-example"><strong>算例与应用</strong><p>${h(chapter.example)}</p></div>
${chapter.table ? evidenceTable(chapter.table, h) : ''}
${chapter.sources?.length ? `<ul class="llm-sources">${chapter.sources.map(source => `<li><a href="${h(source.url)}">${h(source.title)} ↗</a></li>`).join('')}</ul>` : ''}</section>`;
}

const foundationAnchors = { A3: 'visual-input', A4: 'spec-driven-development', B9: 'denoise-evidence' };
function courseFoundation(id, base) {
  const caseUrl = base + casePath;
  if (id === 'A4') {
    const { title, intro, steps, before, after, check } = sddBasics;
    return `<section id="${foundationAnchors[id]}" class="course-foundation"><h2>${h(title)}</h2><p>${h(intro)}</p>
<ol class="foundation-steps">${steps.map(step => `<li><strong>${h(step.title)}</strong><p>${h(step.text)}</p></li>`).join('')}</ol>
<div class="foundation-compare"><div><h3>需求原句</h3><p>${h(before)}</p></div><div><h3>可验收的规格</h3><pre>${h(after)}</pre></div></div>
<p>${h(check)}</p><p><a href="${caseUrl}#problem">看案例正文 · 怎样确定改动范围</a> · <a href="${base}downloads/p4.zip" download>下载 P4 复现包（含协议和样本）</a></p></section>`;
  }
  if (id === 'B9') {
    const { title, intro, sections, check } = imageEvidenceBasics;
    return `<section id="${foundationAnchors[id]}" class="course-foundation"><h2>${h(title)}</h2><p>${h(intro)}</p>
${fusionImage(base, 'roi-comparison.svg', '同坐标比较暗墙、木纹、灯芯和过渡带', '同一行是同一个裁剪框。先认准参考图，再从左到右比较各路输出。', h)}
${sections.map(section => `<section id="${h(section.id)}"><h3>${h(section.title)}</h3>${paragraphs([section.body].flat())}<p class="foundation-example">${h(section.example)}</p></section>`).join('')}
<p>${h(check)}</p><p><a href="${caseUrl}#review">看案例正文 · 同坐标评审</a></p></section>`;
  }
  return '';
}

function course(item, fusionResult, extras) {
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
${courseFoundation(item.id, base)}
${visual ? visualInputLesson(visualInputBasics, fusionResult, base, h) : deep ? deepContent(deep, base, h, extras) : chapters ? `<nav id="concept" class="llm-contents" aria-label="章节目录"><h2>章节目录</h2><ol>${chapters.map(chapter => `<li><a href="#${h(chapter.id)}">${h(chapter.title)}</a></li>`).join('')}</ol><a class="text-link" href="#practice">本地实操 ↓</a></nav>${chapters.map((chapter, index) => llmChapter(chapter, index, base)).join('')}` : `<section id="concept"><h2>原理与示例</h2><dl class="definition"><dt>${h(lesson.term.name)}</dt><dd>${h(lesson.term.meaning)}</dd></dl><p class="example">${h(lesson.example)}</p>${paragraphs(item.core)}${figureMarkup(item, base)}<p class="note lesson-note"><b>常见误区</b>　${h(item.failure)}</p></section>`}
${deep && figures[item.id]?.length ? `<section id="research-figures"><h2>论文图解</h2>${figureMarkup(item, base)}</section>` : ''}
${demoCaptions[item.id] ? `<section id="demo"><h2>分步演示</h2><p>${demoCaptions[item.id]}</p><div data-process="${item.id}"></div><noscript><p>启用 JavaScript 后可单步操作演示。</p></noscript></section>` : ''}
${visual ? deepTask(item.id, visualTask, base, h) : deep ? deepTask(item.id, deep.task, base, h) : chapters ? localLab(item.id, base) : ''}
<section id="references"><h2>继续阅读</h2><ul class="source-list">${(deep?.sources ?? item.references.map(id => sourceMap.get(id))).map(source => `<li><a href="${h(source.url)}">${h(source.title)} ↗</a>${source.use ? `<p>${h(source.use)}</p>` : ''}</li>`).join('')}</ul>
${related.length ? `<div class="course-case-links"><h3>实战案例专题</h3><p><a data-case-overview href="${base + casePath}">${caseTitle} · 案例总览</a></p><ul class="text-list">${related.map(project => `<li><a href="${base + projectUrl(project.id)}">${project.id} · ${h(caseTopics[project.id].label)}</a> <span class="subtle">${h(caseTopics[project.id].type)}</span></li>`).join('')}</ul></div>` : ''}</section>
<div class="lesson-end"><button type="button" class="button secondary" data-complete="${item.id}" aria-pressed="false" hidden>标记已学</button><span data-save-message role="status"></span>${next && !sample ? `<a class="text-link" href="${base + courseUrl(next.id)}">下一课 ${next.id} ↗</a>` : ''}</div></article>
<aside class="reading-aside"><nav aria-label="本课导航"><strong>本课内容</strong><a href="#concept">${chapters || visual || deep ? '章节目录' : '原理与示例'}</a>${foundationTitle ? `<a href="#${foundationAnchors[item.id]}">${h(foundationTitle)}</a>` : ''}${demoCaptions[item.id] ? '<a href="#demo">分步演示</a>' : ''}<a href="#practice">本地任务</a><a href="#references">继续阅读</a></nav></aside></div></div>`;
}

function projectCards(base) {
  return `<div class="project-cards illustrated-cards">${projects.map(item => {
    const { label, type } = caseTopics[item.id];
    const body = `<div class="case-card-text"><div class="case-card-label"><span class="project-code">${item.id} · ${h(label)}</span><span class="subtle">${h(type)}${sample ? '' : ' <span aria-hidden="true">↗</span>'}</span></div>
<h3>${h(item.title)}</h3><p>${h(item.tagline)}</p><span class="case-card-output">${h(item.deliverable)}</span></div>`;
    return sample
      ? `<div class="project-card illustrated-card">${body}</div>`
      : `<a class="project-card illustrated-card" data-case-topic="${item.id}" href="${base + projectUrl(item.id)}">${body}</a>`;
  }).join('')}</div>`;
}

function caseTopicNav(base, current) {
  return `<nav class="workflow-journey" aria-label="实战案例专题">${projects.map(({ id }) =>
    `<a href="${base + projectUrl(id)}"${id === current ? ' aria-current="page"' : ''}><span class="project-code">${id}</span> ${h(caseTopics[id].label)}</a>`).join('')}</nav>`;
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
  const relatedTopic = Object.fromEntries(Object.entries(caseTopics).map(([id, topic]) => [topic.section, [id, topic]]));
  const figuresByChapter = {
    problem: () => sample ? '' : `<p>把输入、改动范围和验收写在同一份任务单上，见 <a href="../${courseUrl('A4')}#${foundationAnchors.A4}">A4 · 用规格驱动 AI 开发</a>。</p>`,
    research: () => researchRecord(fusionSelection, h)
      + `<details class="artifact-reference"><summary>延伸读图 · 同坐标怎么看纹理损失</summary>${publishedFigures('../')}${paperTextureRead('../', denoisePapers[0], h)}</details>`,
    transfer: () => fusionFlow() + fusionImage('../', 'comparison.svg', '带噪输入、弱和强降噪、固定和分区融合以及权重图', '同一张合成图的各路输出。分区权重图越亮，采用的强降噪输出越多。', h),
    data: () => pairedSample('../'),
    experiment: () => controlReview('../', result) + fusionResults(result, h),
    review: () => fusionImage('../', 'roi-comparison.svg', '暗墙、木纹、灯芯与接缝的同坐标对照', '每一行取同一个位置。先与参考图比较，再沿行看不同输出的差异。', h) + inspectFusionRegions('../'),
    holdout: blindSpotCheck,
  };
  return `<div class="wrap story-page"><header class="story-hero">
<div class="story-hero-copy"><p class="eyebrow">${caseMenuLabel}</p><h1>${caseTitle}</h1>
<div class="story-lead">${paragraphs(denoiseCase.intro)}</div><div class="actions"><a class="button primary" href="#problem">从问题读起</a><a class="button secondary" href="#case-topics">查看四个专题</a></div>
</div>${denoiseOpening('../')}</header>
<section id="case-topics" class="story-topics" aria-labelledby="case-topics-title"><div class="case-overview-copy"><h2 id="case-topics-title">案例专题</h2><p>${caseScope}</p></div>${projectCards('../')}</section>
<div class="story-layout"><aside class="story-sidebar"><nav aria-label="案例章节"><strong>正文目录</strong><ul>${chapters.map(chapter => `<li><a href="#${h(chapter.id)}">${h(chapter.title)}</a></li>`).join('')}<li><a href="#appendix">报告与下载</a></li></ul></nav></aside>
<article class="story-article" aria-label="${caseTitle}案例正文">
<span id="ai-workflow" class="story-anchor" aria-hidden="true"></span>
${chapters.map(chapter => {
    const [topicId, topic] = relatedTopic[chapter.id] ?? [];
    return `<section class="story-chapter" id="${h(chapter.id)}"><h2>${h(chapter.title)}</h2>
${chapter.lead ? `<p class="story-chapter-lead">${h(chapter.lead)}</p>` : ''}
${chapter.id === 'review' ? imagePrerequisite : ''}
${chapter.id === 'research'
    ? paragraphs(chapter.paragraphs.slice(0, -1)) + ffdnetComparison() + paragraphs(chapter.paragraphs.slice(-1))
    : paragraphs(chapter.paragraphs)}
${figuresByChapter[chapter.id]?.() ?? ''}
${chapter.artifact ? `<details class="case-prompt"><summary>${h(chapter.artifact.title)}</summary><pre><code data-copy-source>${h(chapter.artifact.body)}</code></pre><button type="button" class="button secondary" data-copy-case hidden>复制任务说明</button><span data-copy-status role="status"></span></details>` : ''}
${chapter.note ? `<p class="note workflow-limit">${h(chapter.note)}</p>` : ''}
${topic && !sample ? `<p class="case-topic-link"><a class="text-link" href="../${projectUrl(topicId)}#demo">${topicId} · ${h(topic.tool)} ↗</a> <span class="subtle">${h(topic.type)}</span></p>` : ''}</section>`;
  }).join('')}
<section id="appendix" class="story-chapter story-appendix"><h2>报告与下载</h2>${fusionLinks('../')}${revisionRecord(fusionRevision, h)}<p class="case-topic-link"><a class="text-link" href="#case-topics">回到案例专题 ↑</a></p></section></article></div></div>`;
}

function guidedCase(guide, base) {
  const visual = {
    P1: () => denoiseOpening(base),
    P2: () => profileEvidence(profileFixtures.dev),
    P3: () => examplePreview(guide.id, base),
    P4: () => fusionImage(base, 'roi-comparison.svg', '对照固定和分区融合在暗墙、木纹、灯芯与交界的同坐标局部', '每一行都是同一位置。木纹一行可直接看细条如何从固定 50% 到分区融合。', h),
  }[guide.id]();
  return `<section id="steps"><h2>${h(caseTopics[guide.id].steps)}</h2>
${lessonFlow({caption: '从问题到交付', nodes: guide.workflow.map(({title, detail}) => ({title, text: detail}))}, h)}
${visual}
<ol class="guided-workflow">${guide.walkthrough.map((step, index) => `<li><span class="guide-index">${index + 1}</span><div><h3>${h(step.title)}</h3><p>${h(step.text)}</p><dl><div><dt>看什么</dt><dd>${h(step.look)}</dd></div><div><dt>据此做什么</dt><dd>${h(step.decision)}</dd></div></dl></div></li>`).join('')}</ol>
<dl class="case-contract"><div><dt>团队提供</dt><dd>${h(guide.inputs)}</dd></div><div><dt>AI 承担</dt><dd>${h(guide.delegation)}</dd></div><div><dt>交付物</dt><dd>${h(guide.deliverable)}</dd></div></dl>
${caseHandoff(guide.handoff, h)}
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

function caseDemo(guide, base) {
  const { example } = guide;
  const title = h(caseTopics[guide.id].tool);
  if (guide.id === 'P4') return `<section id="demo"><h2>${title}</h2><p>对照图、报告和 Demo 使用正文中同一次二维实验的结果。打开 Demo 后可切换两种输出，也可以直接查看关心的区域。</p>${fusionLinks(base)}${inspectFusionRegions(base)}</section>`;
  const fixture = workflowFixtures[guide.id];
  return `<section id="demo"><h2>${title}</h2>
<div class="artifact-reference"><p class="interaction-intro">${h(guide.interactionIntro)}</p>
<div class="workflow-workspace" data-workflow-id="${guide.id.toLowerCase()}"${fixture ? ` data-fixture="${base}assets/workflow-examples/${fixture[1]}"` : ''}><p role="status">正在加载演示…</p></div><noscript><p>启用 JavaScript 即可操作演示。下方也可直接查看示例记录。</p></noscript></div>
<details class="artifact-reference"><summary>${h(example.title)}</summary>
${example.holdout ? '<div class="artifact-switch" data-workflow-switch hidden role="group" aria-label="结果数据范围"><button type="button" class="button" data-workflow-subset="dev" aria-pressed="true">开发集 · 筛选候选</button><button type="button" class="button" data-workflow-subset="holdout" aria-pressed="false">留出集 · 复核结论</button></div>' : ''}
${example.headers.length > 3 ? '<p class="artifact-scroll-hint">横向滑动查看全部列</p>' : ''}
${artifactTable(example.headers, example.rows, example.caption, 'dev')}
${example.holdout ? artifactTable(example.headers, example.holdout.rows, example.holdout.caption, 'holdout') : ''}</details>
${guide.sources?.length ? `<ul class="source-list">${guide.sources.map(source => `<li><a href="${h(source.url)}">${h(source.title)} ↗</a><p>${h(source.note)}</p></li>`).join('')}</ul>` : ''}</section>`;
}

function projectDetail(guide) {
  const base = '../../';
  const { id } = guide;
  const topic = caseTopics[id];
  return `<div class="wrap case-page"><div class="breadcrumbs"><a data-case-overview href="../">${caseMenuLabel}</a><span aria-hidden="true">/</span><span>${id} · ${h(topic.label)}</span></div>
<header class="case-hero"><p class="eyebrow">${id} · ${h(topic.type)}</p><h1>${h(guide.title)}</h1><p class="intro">${h(guide.problem)}</p>
<p class="case-topic-link"><a href="../#${topic.section}">看案例正文 · ${h(topic.chapter)} ↗</a></p>
<div class="actions"><a class="button primary" href="#demo">${h(topic.tool)} ↓</a><a class="button secondary" href="#practice">本地任务与下载 ↓</a></div></header>
${caseTopicNav(base, id)}
<article class="case-body">
${guidedCase(guide, base)}
${caseDemo(guide, base)}
<section id="checks"><h2>${guide.id === 'P1' ? '本案采用的方案' : '结果与适用条件'}</h2><p>${h(guide.decision)}</p><p class="note workflow-limit">${h(guide.limit)}</p></section>
${localLab(id, base, guide.lab, id === 'P4')}
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
if (fusionSnapshot) {
  assert(fusionSnapshot !== dist && !fusionSnapshot.startsWith(dist + sep), 'Store the fusion snapshot outside the generated dist directory');
  const manifest = JSON.parse(await readFile(join(fusionSnapshot, 'manifest.json'), 'utf8'));
  for (const [name, { bytes, sha256 }] of Object.entries(manifest.artifacts)) {
    assert(/^[a-z0-9_-]+\.[a-z0-9]+$/.test(name), `Invalid snapshot artifact name: ${name}`);
    const file = await readFile(join(fusionSnapshot, name));
    assert(file.length === bytes && createHash('sha256').update(file).digest('hex') === sha256, `Invalid snapshot artifact: ${name}`);
  }
}
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(site, 'static'), join(dist, 'assets'), { recursive: true });
for (const [source, target] of Object.values(workflowFixtures)) {
  await cp(join(site, 'labs', source), join(dist, 'assets', 'workflow-examples', target));
}
const fusionOutput = join(dist, fusionPath);
if (fusionSnapshot) {
  await cp(fusionSnapshot, fusionOutput, { recursive: true });
} else {
  execFileSync(python, [join(site, 'labs', 'p4', 'solution.py'), '--out', fusionOutput], { stdio: 'inherit' });
}
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
await write(`${onboardingUrl}index.html`, shell('../../', onboarding.title, 'courses', onboardingLesson(onboarding, h, courseChip), true));
await write(`${publicCourseDirectory}index.html`, shell('../../', publicCourseLabel, 'public', publicCoursesIndex(publicCourses, publicCourseFit, h)));
for (const item of publicCourses) {
  await write(`${publicCourseUrl(item.id)}index.html`, shell('../../../', item.title, 'public', publicCourseDetail(item, h, courseChip)));
}
await write(`${casePath}index.html`, shell('../', caseTitle, 'projects', denoiseStory(fusionResult)));
const lessonExtras = sample ? {} : { A8: { 'exact-ids': showSkillExamples(await skillExamples(site, python), h) } };
for (const id of pageCourseIds) {
  const item = courseMap.get(id);
  await write(courseUrl(id) + 'index.html', shell('../../', item.title, 'courses', course(item, fusionResult, lessonExtras[id]), Boolean(foundationAnchors[id] || deepLessons[id] || llmChapters[id])));
}
if (!sample) {
  for (const item of projects) await write(projectUrl(item.id) + 'index.html', shell('../../', item.title, 'projects', projectDetail(item)));
}
const pages = await checkLinks();
console.log(`Verified ${pages} HTML pages, ${pageCourseIds.length} courses and ${sample ? 0 : projects.length} project details.`);
