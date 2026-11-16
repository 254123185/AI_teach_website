import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const batches = [
  ['batch1.json', '基线和候选都有图', 0],
  ['batch2.json', '两边各缺一张', 0],
  ['batch3.json', '候选侧有重复 ID', 1],
  ['batch4.json', '001 和 1 是两个不同的 ID', 0],
];

export async function skillExamples(site, python) {
  const lab = join(site, 'lesson-assets', 'a8');
  return Promise.all(batches.map(async ([file, label, expected]) => {
    const input = JSON.parse(await readFile(join(lab, file), 'utf8'));
    const command = ['pair-review/scripts/pair.py', file];
    const run = spawnSync(python, command, { cwd: lab, encoding: 'utf8' });
    assert.equal(run.status, expected, `A8 ${file}: ${run.error?.message || run.stderr || run.stdout}`);
    return { label, input, command: ['python', ...command].join(' '), output: JSON.parse(run.stdout), status: run.status };
  }));
}

export function showSkillExamples(examples, h) {
  const pretty = (value) => h(JSON.stringify(value, null, 2));
  return `<div class="skill-replay"><h3>查看各批次的脚本输出</h3>
<p>下列读数由随包脚本生成。展开一个批次，核对清单、命令和退出码。</p>${examples.map(({ label, input, command, output, status }) => `
<details class="artifact-reference"><summary>${h(label)}</summary>
<p><code>${h(command)}</code> · 退出码 ${status}</p>
<div class="foundation-compare"><div><h4>输入清单</h4><pre>${pretty(input)}</pre></div><div><h4>脚本输出</h4><pre>${pretty(output)}</pre></div></div>
</details>`).join('')}</div>`;
}
