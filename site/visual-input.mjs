import { evidenceTable, lessonFlow } from './deep-lesson.mjs';

export function visualInputLesson(content, result, base, h) {
  const assets = base + 'assets/visual-input/low-light-';
  const frames = base + 'experiments/tea-shop/';
  const { intro, sections, prompt, source } = content;
  const copy = `<div class="case-prompt"><h3>给视觉模型的任务单</h3><pre><code data-copy-source>${h(prompt)}</code></pre><button type="button" class="button secondary" data-copy-case hidden>复制任务单</button><span data-copy-status role="status"></span></div>`;
  const view = (file, name, size, alt, detail, marked = false) => `<figure class="visual-panel">
<a href="${assets + file}.png" class="visual-frame" aria-label="打开${name} PNG"><img src="${assets + file}.png" alt="${h(alt)}">${marked ? '<span class="visual-roi" aria-hidden="true"></span>' : ''}</a>
<figcaption><strong>${name}</strong><span class="visual-size">${size}</span><p>${detail}</p><a href="${assets + file}.png" download>下载${name} PNG</a></figcaption></figure>`;
  const gallery = `<figure class="visual-gallery" id="views"><figcaption><strong>同一张低照度合成参考图的三种视图</strong></figcaption>
<div class="visual-views">
${view('reference', '全图', '128×80', '低照度参考全图，木纹裁框在暗墙与灯芯之间', '先确认木纹在画面中间。绿框标出原图的裁剪范围。', true)}
${view('thumbnail', '缩略图', '32×20', '全图每四乘四像素取均值后的缩略图，细条纹难以辨认', '每个 4×4 像素块缩成一个灰度值。缩小后细条纹难以辨认。')}
${view('wood-crop', '原尺寸裁片', '32×48', '从参考全图固定坐标直接裁出的木纹，可见明暗细条', '从原图直接裁出 [52, 14, 32, 48]，每个文件像素保留原值。')}
</div><p class="visual-foot">网页为方便观察放大显示。三个链接打开各自的图像文件。</p></figure>`;
  const pixels = [70, 66, 96, 92, 70, 66, 96, 92, 71, 67, 97, 93, 71, 67, 97, 93];
  const scanline = `<figure class="visual-scan"><figcaption><strong>一个缩略像素里原来有什么</strong></figcaption>
<div class="visual-average"><div><div class="visual-values visual-pixels" aria-label="原始四行像素，从左到右，从上到下">${pixels.map(value => `<span style="--shade:${value}">${value}</span>`).join('')}</div><p>原图从 (60, 28) 起取 4×4 像素。第一行中 66 和 96 相邻，相差 30 灰度级。</p></div><span class="visual-arrow" aria-hidden="true">→</span><div><div class="visual-values"><span style="--shade:82">82</span></div><p>16 个值的平均数是 81.5，四舍五入为 82。缩略图把它存到 (15, 7)。</p></div></div>
</figure>`;
  const attachmentRows = [
    ['A · 弱降噪', frames + 'weak.png', assets + 'weak-wood-crop.png'],
    ['B · 强降噪', frames + 'strong.png', assets + 'strong-wood-crop.png'],
  ];
  const attachments = `<aside class="visual-attachments"><h3>同一块木纹的弱、强降噪对照</h3><ul>${attachmentRows.map(([label, full, crop]) => `<li><strong>${label}</strong><img src="${crop}" width="32" height="48" alt="${label}的木纹局部" loading="lazy"><a href="${full}" download>下载全图 · 128×80</a><a href="${crop}" download>下载木纹裁片 · 32×48</a></li>`).join('')}</ul><p>这四张图可以直接交给 AI。做保真测量时，再加 <a href="${assets}reference.png" download>干净参考图</a>。</p></aside>`;
  const readings = [
    ['木纹平均绝对误差（灰度级）', 'wood_mae'],
    ['木纹反差比（参考为 1）', 'wood_contrast_ratio'],
    ['灯芯指定坐标的灰度值', 'lamp_peak_value'],
  ];
  const verification = `<figure class="visual-scan"><figcaption><strong>脚本对这两版输出的读数</strong></figcaption><div class="selection-table" role="region" aria-label="弱强降噪的像素测量" tabindex="0"><table><thead><tr><th scope="col">指标</th><th scope="col">A · 弱降噪</th><th scope="col">B · 强降噪</th></tr></thead><tbody>${readings.map(([label, key]) => `<tr><th scope="row">${label}</th>${['weak', 'strong'].map(method => `<td>${result.metrics[method][key].toFixed(key === 'lamp_peak_value' ? 0 : 3)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>强降噪输出的木纹误差更大，反差比也更低。把这两项与裁片合起来看，能核对条纹变淡的观察。数值来自本站已有的合成样本结果。</p></figure>`;
  const modelView = lessonFlow({ caption: '上传到回答，中间要经过哪些处理', nodes: [
    { title: '文件与版本', text: '记录源图像素与裁片坐标' },
    { title: '模型预处理', text: '模型可按配置改尺寸、裁剪或分块' },
    { title: '视觉特征', text: '与文字一起进入模型，产生定性回答' },
    { title: '回到原图核对', text: '从原始像素测量，记录无法确认的环节' },
  ] }, h);
  const alignment = evidenceTable({ caption: '同一张参考图，像素误差也会随裁框改变', headers: ['窗口 A', '窗口 B', 'MAE（灰度级）'],
    rows: [['[52,14,32,48]', '[52,14,32,48]', '0.000'], ['[52,14,32,48]', '[53,14,32,48]', '16.534'], ['[52,14,32,48]', '[54,14,32,48]', '27.822']],
  }, h);
  const reviewQueue = evidenceTable({
    caption: '一条模型观察怎样进入评审队列',
    headers: ['模型记录（教学示例）', '程序证据', '工程师打开哪里'],
    rows: [
      ['B 的木条边界比 A 难分辨', '同坐标木纹裁片的反差比和 MAE', '同尺寸 A/B 裁片，核对条纹与对齐'],
      ['灯芯边界看不清，暂存不确定', '灯芯固定坐标灰度读数', '原图灯芯与指定点，分开看位置和亮度'],
      ['两图中的亮点像是错位', '输出尺寸、裁框和几何变换记录', '回到同一帧核对位置，对齐前暂缓保真比较'],
    ],
  }, h);
  const extras = { locate: gallery, thumbnail: scanline, 'model-view': modelView, crop: attachments + copy, alignment, verify: verification + reviewQueue };
  return `<div class="visual-lesson"><p class="visual-intro">${h(intro)}</p>
<nav id="concept" class="visual-contents" aria-label="本课章节">${sections.map(section => `<a href="#${h(section.id)}">${h(section.title)}</a>`).join('')}</nav>
<div id="visual-input">${sections.map(section => `<section class="visual-section" id="${h(section.id)}"><h2>${h(section.title)}</h2>${section.paragraphs.map(line => `<p>${h(line)}</p>`).join('')}
${extras[section.id] ?? ''}${section.id === 'verify' ? `<p><a href="${base}experiments/tea-shop/demo.html#wood">打开木纹 Demo，可切换弱、强输出</a> · <a href="${base}courses/b9/#denoise-evidence">B9 · 读懂降噪对照图</a></p>` : ''}</section>`).join('')}</div>
<aside class="visual-source"><p>多图编号、版本和比较维度参考 <a href="${h(source.url)}">${h(source.title)}</a>。预处理见 <a href="https://huggingface.co/docs/transformers/main/en/image_processors">Transformers 图像预处理文档</a>。图像与像素值来自本站的低照度合成样本。</p></aside></div>`;
}
