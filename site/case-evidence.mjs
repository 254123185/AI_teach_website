import { readFileSync } from 'node:fs';
import { evaluateProfiles, filterProfile } from './static/workflow-examples/p2-interaction.mjs';

const profiles = JSON.parse(readFileSync(new URL('./labs/p2/fixtures.json', import.meta.url), 'utf8'));
const methods = {
  baseline: '原图基线',
  mean3: '三点均值',
  median3: '三点中值',
  gated: '门控中值',
};
const shades = { baseline: '#7b8a82', pass: '#176947', fail: '#a24d2c' };
const figureStyle = 'margin:1rem 0;padding:clamp(.55rem,2vw,1rem);border:1px solid #d4dfd6;border-radius:.7rem;background:#fffdf8';
const gridStyle = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,285px),1fr));gap:.55rem';
const fixed = value => value.toFixed(2);

function horizontalChart({ title, units = '灰度级 · 0–7', rows, max = 7, limit, ticks }) {
  const svgWidth = 360;
  const start = 81;
  const width = 226;
  const chartX = value => start + value / max * width;
  const blockHeight = 28;
  const rowTop = 43;
  const end = rowTop + blockHeight * rows.length + 2;
  return `<svg viewBox="0 0 ${svgWidth} ${end + 31}" width="100%" style="max-width:440px;display:block" role="img" aria-label="${title}，门槛 ${fixed(limit)} 灰度级">`
    + `<g font-family="system-ui,sans-serif" fill="#293e34" font-size="11">
    <text x="6" y="16" font-weight="700" font-size="14">${title}</text>
    <text x="351" y="16" text-anchor="end" font-size="10">${units}</text>
    ${ticks.map(tick => `<path d="M${chartX(tick)} ${rowTop - 8}V${end}" stroke="#dfe8df"/><text x="${chartX(tick)}" y="${end + 14}" text-anchor="middle">${tick}</text>`).join('')}
    ${rows.map(({label, value, state}, index) => {
      const y = rowTop + blockHeight * index;
      return `<text x="${start - 8}" y="${y + 13}" text-anchor="end" font-weight="${state === 'baseline' ? '500' : '650'}">${label}</text>
        <rect x="${start}" y="${y + 2}" width="${Math.max(1.3, chartX(value) - start)}" height="14" fill="${shades[state]}" rx="3"/>
        <text x="346" y="${y + 13}" text-anchor="end" fill="#25392d" font-weight="700">${fixed(value)}</text>`;
    }).join('')}
    <path d="M${chartX(limit)} ${rowTop - 8}V${end}" fill="none" stroke="#3d5446" stroke-width="1.25" stroke-dasharray="3 3"/>
    <text x="${chartX(limit) + 4}" y="${rowTop - 13}" font-size="10">门槛 ${fixed(limit)}</text>
    </g></svg>`;
}

function dataTable(headers, rows, label) {
  return `<table style="width:100%;border-collapse:collapse;font:inherit;font-size:.85rem;table-layout:fixed"><caption style="text-align:left;font-weight:700;padding:.4rem .3rem">${label}</caption><thead><tr>${headers.map(header => `<th scope="col" style="text-align:left;padding:.3rem;border-bottom:1px solid #dee7db">${header}</th>`).join('')}</tr></thead><tbody>${rows.map(([name, ...values]) =>
    `<tr><th scope="row" style="text-align:left;padding:.3rem;font-weight:650">${name}</th>${values.map(value => `<td style="padding:.3rem">${value}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export function experimentFigure(type = 'all') {
  const dev = evaluateProfiles(profiles.dev);
  const baseline = evaluateProfiles(profiles.holdout, ['baseline']).rows[0];
  const holdout = [16, 23].map(threshold => {
    const held = evaluateProfiles(profiles.holdout, ['gated'], threshold).rows[0];
    return { threshold, ...held };
  });
  const devCharts = [['flat', '开发集 · 暗墙', 1], ['detail', '开发集 · 木纹与边缘', dev.detailGate]]
    .map(([region, title, limit]) => horizontalChart({ title, limit, ticks: [0, 2, 4, 6],
      rows: dev.rows.map(row => ({
        label: methods[row.id], value: row[region], state: row.id === 'baseline' ? 'baseline' : row[region] <= limit ? 'pass' : 'fail',
      })),
    })).join('');
  const heldChart = horizontalChart({ title: '留出集 · 暗墙', units: '灰度级 · 0–4', max: 4, limit: 1, ticks: [0, 1, 2, 3, 4],
    rows: [{ label: '原图基线', value: baseline.flat, state: 'baseline' },
      ...holdout.map(row => ({ label: `阈值 ${row.threshold}`, value: row.flat, state: row.passes ? 'pass' : 'fail' }))],
  });
  const devBlock = `<div style="${gridStyle}">${devCharts}</div><details><summary>查看开发集数值</summary>
    ${dataTable(['开发集方案','暗墙 MAE','细节 MAE','合格'], dev.rows.map(row => [
      methods[row.id], fixed(row.flat), fixed(row.detail), row.id === 'baseline' ? '基线' : row.passes ? '通过' : '未通过',
    ]), '阈值 16 的开发结果')}</details>`;
  const heldBlock = `<div style="${gridStyle};align-items:center">${heldChart}<p>两种阈值的开发集结果一样。把方案分别冻结，再用相同的留出剖面复核，阈值 23 的暗墙误差超过 1.00。</p></div>
    <details><summary>查看留出集数值</summary>${dataTable(['留出集方案','暗墙 MAE','细节 MAE','合格'], [
      ['原图基线', fixed(baseline.flat), fixed(baseline.detail), '基线'],
      ...holdout.map(row => [`阈值 ${row.threshold}`, fixed(row.flat), fixed(row.detail), row.passes ? '通过' : '未通过']),
    ], '冻结阈值后复核')}</details>`;
  return `<figure class="case-evidence-figure" style="${figureStyle}">
    <figcaption><strong>图中虚线是验收门槛。</strong> 每个指标都必须通过。柱长表示分区 MAE，越短越好。</figcaption>
    ${type === 'holdout' ? '' : devBlock}
    ${type === 'dev' ? '' : heldBlock}
    <p style="font-size:.85rem">每批四条一维合成剖面。暗墙共 18 个像素，木纹与边缘共 22 个像素。暗墙门槛为 1，细节门槛为该批次基线加 0.5，判定使用完整精度。</p>
  </figure>`;
}

function pixelTrace({ name, reference, input, point }) {
  const filtered = filterProfile(input, 'gated', 16);
  const x = index => 32 + index * 38;
  const y = value => 143 - value;
  const chartLine = values => values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  return {
    name, input: input[point], reference: reference[point], filtered: filtered[point],
    svg: `<svg viewBox="0 0 360 177" width="100%" style="max-width:440px;display:block" role="img" aria-label="${name}：同一位置，参考值 ${reference[point]}，输入值 ${input[point]}，处理后 ${filtered[point]}">
      <g font-family="system-ui,sans-serif" font-size="10" fill="#293e34">
      <text x="6" y="17" font-weight="700" font-size="14">${name}</text>
      ${[0, 25, 50, 75, 100].map(value => `<path d="M32 ${y(value)}H336" stroke="#dce6dd"/><text x="25" y="${y(value) + 3}" text-anchor="end">${value}</text>`).join('')}
      <path d="M${x(point)} 43V143" stroke="#cbd8cc" stroke-dasharray="3 3"/><text x="${x(point)}" y="158" text-anchor="middle">第 ${point + 1} 个像素</text>
      <text x="336" y="31" text-anchor="end">灰度级</text>
      <polyline points="${chartLine(input)}" fill="none" stroke="#b16236" stroke-width="2.2"/>
      <polyline points="${chartLine(filtered)}" fill="none" stroke="#176947" stroke-width="2.5"/>
      <polyline points="${chartLine(reference)}" fill="none" stroke="#304a66" stroke-width="1.9" stroke-dasharray="4 3"/>
      <circle cx="${x(point)}" cy="${y(input[point])}" r="4" fill="#fff" stroke="#a24d2c" stroke-width="2"/>
      <circle cx="${x(point)}" cy="${y(filtered[point])}" r="4" fill="#176947" stroke="#fff" stroke-width="1"/>
      <text x="${x(point) + 8}" y="${y(input[point]) - 6}" fill="#8e4225" font-weight="700">${input[point]}</text>
      <text x="${x(point) + 8}" y="${y(filtered[point]) + 15}" fill="#176947" font-weight="700">${filtered[point]}</text>
      </g></svg>`,
  };
}

export function counterexampleFigure() {
  const wall = profiles.dev[0];
  const traces = [
    pixelTrace({ name: '暗墙 · 错误尖峰', reference: wall.reference, input: wall.noisy, point: 3 }),
    pixelTrace({ name: '灯芯 · 应保留的亮峰', reference: [38, 39, 41, 96, 41, 39, 38, 38, 38],
      input: [38, 40, 41, 96, 40, 38, 38, 39, 38], point: 3 }),
  ];
  return `<figure class="case-evidence-figure" style="${figureStyle}">
    <figcaption><strong>同一门控，同样压掉一个尖峰，结论相反。</strong> 用同一灰度尺度比较。蓝色虚线是参考，橙色是输入，绿色是候选输出。</figcaption>
    <div style="${gridStyle}">${traces.map(trace => trace.svg).join('')}</div>
    ${dataTable(['剖面第 4 点','参考','原输入','处理后'], traces.map(trace => [trace.name, trace.reference, trace.input, trace.filtered]), '从图上读出的数值')}
    <p>暗墙回到参考值 42。灯芯损失 55 灰度级，远超 4 灰度级的演练门槛。灯芯是一条额外构造的压力样本。</p>
  </figure>`;
}
