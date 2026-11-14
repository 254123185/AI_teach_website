from base64 import b64encode
from html import escape
from json import dumps
from struct import pack
from zlib import compress, crc32

from scene import crop


LABELS = {
    "reference": "干净参考", "noisy": "共同加噪输入", "weak": "弱支路", "strong": "强支路",
    "global": "A · 固定权重", "spatial": "B · 分区权重", "weights": "B · 强支路权重图",
    "mean_matched": "均值匹配诊断",
}
REGIONS = {"wall": "暗墙", "wood": "木纹", "lamp": "灯芯"}


def review_regions(scene):
    areas = dict(scene["rois"])
    first_y, end_y = scene["seam_y_range"]
    radius = scene["seam_half_width"]
    for index, center in enumerate(scene["seam_x_centers"], start=1):
        # Include the neighbor immediately left of the first evaluated difference.
        areas[f"seam{index}"] = [center - radius - 1, first_y, 2 * radius + 2, end_y - first_y]
    return areas


def pgm(frame):
    return (f"P5\n{len(frame[0])} {len(frame)}\n255\n".encode("ascii")
            + bytes(value for row in frame for value in row))


def png(frame):
    def chunk(tag, data):
        return pack(">I", len(data)) + tag + data + pack(">I", crc32(tag + data))

    header = pack(">IIBBBBB", len(frame[0]), len(frame), 8, 0, 0, 0, 0)
    pixels = b"".join(b"\0" + bytes(row) for row in frame)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
            + chunk(b"IDAT", compress(pixels, level=9)) + chunk(b"IEND", b""))


def png_url(data):
    return "data:image/png;base64," + b64encode(data).decode("ascii")


def comparison_svg(result, frames, png_bytes, detail):
    scene = result["scene"]
    labels = ("reference", "weak", "strong", "global", "spatial") if detail else (
        "reference", "noisy", "weak", "strong", "global", "spatial", "weights", "mean_matched")
    if detail:
        areas = review_regions(scene)
        region_labels = {**REGIONS, "seam1": "左交界", "seam2": "右交界"}
        total_width, total_height = 940, 106 + len(areas) * 143 + 12
        content = []
        for column, method in enumerate(labels):
            content.append(f'<text x="{148 + column * 153}" y="84">{LABELS[method]}</text>')
        for index, (region, box) in enumerate(areas.items()):
            x, y, width, height = box
            row_y = 106 + index * 143
            content.append(f'<text x="22" y="{row_y + 45}">{region_labels[region]}</text>'
                           f'<text class="small" x="22" y="{row_y + 69}">坐标 ({x}, {y})</text>'
                           f'<text class="small" x="22" y="{row_y + 88}">{width} × {height} 像素</text>')
            for column, method in enumerate(labels):
                content.append(f'<image x="{148 + column * 153}" y="{row_y}" width="125" height="126" '
                               f'preserveAspectRatio="xMidYMid meet" href="{png_url(png(crop(frames[method], box)))}"/>')
        title = "同坐标裁剪与交界检查"
        subtitle = "每行比较相同位置，灰度范围统一为 0–255。两处交界保留用于相邻差计算的像素。"
    else:
        total_width, total_height = 930, 564
        content = []
        display_width, display_height = 199, 124.375
        scale = display_width / scene["width"]
        colors = {"wall": "#61d9c1", "wood": "#ffcf59", "lamp": "#ff9d89"}
        for index, method in enumerate(labels):
            pos_x, pos_y = 25 + (index % 4) * 222, 98 + (index // 4) * 206
            content.append(f'<text x="{pos_x}" y="{pos_y}">{LABELS[method]}</text>'
                           f'<image x="{pos_x}" y="{pos_y + 10}" width="{display_width}" height="{display_height}" '
                           f'href="{png_url(png_bytes[method])}"/>')
            if method in {"reference", "global", "spatial"}:
                for region, (x, y, width, height) in scene["rois"].items():
                    content.append(f'<rect x="{pos_x + x * scale:.3f}" y="{pos_y + 10 + y * scale:.3f}" '
                                   f'width="{width * scale:.3f}" height="{height * scale:.3f}" '
                                   f'stroke="{colors[region]}" stroke-width="1.7" rx="1" fill="none"/>')
            if method == "weights":
                content.append(f'<text class="small" x="{pos_x}" y="{pos_y + 154}">黑 0%，白 100%</text>')
        content.extend(
            f'<circle cx="{27 + index * 122}" cy="505" r="5" fill="{colors[region]}" stroke="#325541"/>'
            f'<text class="small" x="{38 + index * 122}" y="510">{label} ROI</text>'
            for index, (region, label) in enumerate(REGIONS.items())
        )
        title = "同一低照度样本的输入、支路与融合结果"
        subtitle = "两路输出固定。A 和 B 只更换强支路权重，彩框是评估位置。"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_width} {total_height}" role="img" aria-labelledby="title description">
<title id="title">{title}</title><desc id="description">{subtitle}</desc>
<style>text{{font:700 17px system-ui,sans-serif;fill:#213e2a}} .small{{font:400 14px system-ui,sans-serif}} image{{image-rendering:pixelated}}</style>
<rect width="100%" height="100%" fill="#f8f8ef" rx="14"/>
<text x="22" y="36" style="font-size:23px">{title}</text>
<text class="small" x="22" y="60">{subtitle}</text>
{''.join(content)}
</svg>"""


def demo_html(result, frames, png_bytes):
    regions = {"full": "整图", **REGIONS, "seam1": "左交界", "seam2": "右交界"}
    frame_names = ("reference", "noisy", "weak", "strong", "global", "spatial", "weights", "mean_matched")
    scene = result["scene"]
    areas = review_regions(scene)
    images = {}
    for method in frame_names:
        images[method] = {"full": png_url(png_bytes[method])}
        for region, box in areas.items():
            selected = crop(frames[method], box)
            if method == "weights":
                selected = [[(value * 255 + 50) // 100 for value in row] for row in selected]
            images[method][region] = png_url(png(selected))
    def method_choices(default):
        return "".join(f'<option value="{method}"{" selected" if method == default else ""}>'
                       f'{LABELS[method]}</option>' for method in frame_names)

    region_choices = "".join(f'<option value="{region}">{name}</option>' for region, name in regions.items())
    presets = {region: ["global", "spatial", region] for region in regions}
    presets["matched"] = ["mean_matched", "spatial", "wall"]
    preset_links = "".join(f'<a id="{region}" href="#{region}">{name}</a>' for region, name in regions.items())
    peak_x, peak_y = scene["lamp_peak_xy"]
    rows = "".join(
        f"<tr><th>{escape(gate['label'])}</th><td>{gate['baseline']:.3f}</td><td>{gate['candidate']:.3f}</td>"
        f"<td>{escape(gate['op'])} {gate['limit']:.3f}</td><td>{'通过' if gate['passed'] else '失败'}</td></tr>"
        for gate in result["gates"]
    )
    bundle = dumps({"scene": scene, "images": images, "labels": LABELS, "regions": regions, "boxes": areas,
                    "metrics": result["metrics"], "reference_lamp_peak": frames["reference"][peak_y][peak_x],
                    "presets": presets, "experiment_id": result["experiment_id"]},
                   ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>低照度图像降噪 · 权重对照</title><link rel="icon" href="data:,">
<style>
  *{{box-sizing:border-box}} body{{margin:0;background:#f6f7ee;color:#19291f;font:16px/1.55 system-ui,sans-serif}}
  main{{max-width:960px;margin:auto;padding:1rem clamp(.6rem,3vw,2rem) 2rem}}
  h1{{line-height:1.18;margin:.5rem 0}} p{{margin:.55rem 0}}
  .presets{{display:flex;flex-wrap:wrap;gap:.45rem;margin:.8rem 0}}
  .presets[hidden]{{display:none}}
  .presets a{{padding:.32rem .55rem;border:1px solid #9cb09e;border-radius:.35rem;color:#224f37;scroll-margin-top:.65rem}}
  .presets a[aria-current]{{background:#e3eddf;font-weight:650}}
  .controls,.panels{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;margin:.8rem 0}}
  .controls{{grid-template-columns:repeat(3,minmax(0,1fr))}} label{{display:grid;gap:.2rem;font-weight:650}}
  select{{width:100%;font:inherit;padding:.35rem;background:#fffef7;color:#19291f;border:1px solid #9cb09e;border-radius:.35rem}}
  figure{{min-width:0;margin:0;padding:.45rem;border:1px solid #a8b9a6;border-radius:.45rem;background:#fffef7}}
  figure img{{display:block;width:100%;height:auto;max-height:320px;object-fit:contain;image-rendering:pixelated;background:#1f2220;border-radius:.25rem}}
  figure .frame{{aspect-ratio:8/5;display:grid;place-items:center;background:#1f2220}}
  figcaption{{font-size:.87rem;margin-top:.25rem}}
  .table-wrap{{overflow:auto}} table{{width:100%;border-collapse:collapse;min-width:24rem;font-size:.88rem}}
  th,td{{padding:.36rem .4rem;text-align:left;border-bottom:1px solid #bccabb}}
  .muted{{font-size:.86rem;color:#466253}} .status{{font-weight:750}} .small{{font-size:.86rem}}
  @media(max-width:520px){{.controls{{grid-template-columns:repeat(2,minmax(0,1fr))}}.scope{{grid-column:1/-1}}}}
</style>
</head>
<body><main>
<p class="muted">{escape(result['experiment_id'])} · 低照度合成灰度图</p>
<h1>固定权重与分区权重对照</h1>
<p>A、B 共用弱、强两路降噪结果。A 全图用 50% 的强支路。B 在暗墙、木纹和灯芯附近分别用 85%、15% 和 8%，交界处线性过渡。</p>
<p class="muted">同均值对照把 B 的平均强支路权重（{result['diagnostics']['mean_matched']['strong_weight']}%）用于全图。与 B 比较，可以看出权重分配到不同位置有什么影响。</p>
<nav class="presets" aria-label="快速选择对照" hidden>{preset_links}<a id="matched" href="#matched">同均值对照</a></nav>
<noscript><p>下方显示 A/B 整图和验收结果。启用 JavaScript 后可切换版本和区域。</p></noscript>
<div class="controls">
<label for="method-a">左图<select id="method-a" disabled>{method_choices('global')}</select></label>
<label for="method-b">右图<select id="method-b" disabled>{method_choices('spatial')}</select></label>
<label for="region" class="scope">同坐标裁剪<select id="region" disabled>{region_choices}</select></label>
</div>
<div class="panels">
<figure><div class="frame"><img id="frame-a" src="{images['global']['full']}" alt="固定权重"></div><figcaption id="label-a">A · 固定权重</figcaption></figure>
<figure><div class="frame"><img id="frame-b" src="{images['spatial']['full']}" alt="分区权重"></div><figcaption id="label-b">B · 分区权重</figcaption></figure>
</div>
<p class="small" id="position" role="status"></p>
<div id="selection" aria-live="polite" hidden>
<p class="small" id="reading"></p>
<div class="table-wrap" tabindex="0" aria-label="所选区域的测量结果">
<table><thead><tr><th scope="col">指标</th><th scope="col" id="metric-a">左图</th><th scope="col" id="metric-b">右图</th></tr></thead>
<tbody id="metric-rows"></tbody></table></div></div>
<h2>验收结果 · B 对 A</h2>
<p class="status">{'分区权重通过全部预设门槛。' if result['all_gates_pass'] else '分区权重未通过部分预设门槛。'}</p>
<div class="table-wrap" tabindex="0" aria-label="预设门槛与判定">
<table><thead><tr><th>门槛</th><th>A</th><th>B</th><th>条件</th><th>判定</th></tr></thead><tbody>{rows}</tbody></table></div>
<p class="muted">图像和读数来自同一次合成实验。真实画质和设备表现需要另行验证。</p>
</main>
<script type="application/json" id="experiment">{bundle}</script>
<script>
const evidence = JSON.parse(document.getElementById('experiment').textContent);
const left = document.getElementById('method-a');
const right = document.getElementById('method-b');
const roi = document.getElementById('region');
const controls = [left, right, roi];
const presetNav = document.querySelector('.presets');
const seamView = {{
  metrics: [['seam_excess_step_mae', '两处交界合计梯度误差 MAE', 3]],
  reading: '画面显示所选交界。表中合并统计两处交界，比较输出与参考的横向相邻像素差，再取平均绝对误差。'
}};
const views = {{
  full: {{metrics: [['global_mae', '全图 MAE', 3]], reading: 'MAE 是输出与参考图逐像素比较得到的平均绝对误差。'}},
  wall: {{metrics: [['wall_residual_std', '暗墙残差标准差', 3], ['wall_mae', '暗墙 MAE', 3]],
    reading: '残差标准差越低，输出减去参考后的波动越小。MAE 也计入整体偏亮或偏暗造成的误差。'}},
  wood: {{metrics: [['wood_mae', '木纹 MAE', 3], ['wood_contrast_ratio', '木纹反差比', 3]],
    reading: '木纹反差比是输出的横向平均反差除以参考值，接近 1 表示反差接近参考。噪点也可能抬高反差，因此要和 MAE 一起看。'}},
  lamp: {{metrics: [['lamp_peak_value', '灯芯固定点亮度', 0], ['lamp_peak_loss', '灯芯固定点亮度损失', 0]],
    reading: `灯芯测量点位于 (${{evidence.scene.lamp_peak_xy.join(', ')}})，参考亮度为 ${{evidence.reference_lamp_peak}}。`
      + '亮度损失表示该点比参考暗了多少。'}},
  seam1: seamView,
  seam2: seamView
}};
const reference = {{wood_contrast_ratio: 1, lamp_peak_value: evidence.reference_lamp_peak}};
function metricCell(method, key, digits) {{
  if (method === 'weights') return '—';
  const value = method === 'reference' ? (reference[key] ?? 0) : evidence.metrics[method][key];
  return value.toFixed(digits) + (key === 'wood_contrast_ratio' ? '' : ' 灰度级');
}}
function update() {{
  const region = roi.value;
  const methods = [left.value, right.value];
  for (const [side, method] of [['a', methods[0]], ['b', methods[1]]]) {{
    const image = document.getElementById('frame-' + side);
    image.src = evidence.images[method][region];
    image.alt = evidence.labels[method] + '，' + evidence.regions[region];
    document.getElementById('label-' + side).textContent = evidence.labels[method];
    document.getElementById('metric-' + side).textContent = evidence.labels[method];
  }}
  const frameBox = [0,0,evidence.scene.width,evidence.scene.height];
  document.getElementById('position').textContent =
    evidence.regions[region] + '，裁剪范围 [x, y, 宽, 高] = [' +
    (evidence.boxes[region] ?? frameBox).join(', ') + ']';
  const view = views[region];
  document.getElementById('reading').textContent = view.reading
    + (methods.includes('weights') ? ' 权重图的黑色和白色分别表示 0% 和 100% 的强支路权重。表中该列显示 —。' : '');
  const rows = view.metrics.map(([key, label, digits]) => {{
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    for (const method of methods) row.insertCell().textContent = metricCell(method, key, digits);
    return row;
  }});
  document.getElementById('metric-rows').replaceChildren(...rows);
  for (const link of presetNav.querySelectorAll('a')) {{
    const preset = evidence.presets[link.hash.slice(1)];
    if (preset[0] === methods[0] && preset[1] === methods[1] && preset[2] === region) {{
      link.setAttribute('aria-current', 'true');
    }} else {{
      link.removeAttribute('aria-current');
    }}
  }}
}}
function applyPreset() {{
  const name = location.hash.slice(1);
  const preset = Object.hasOwn(evidence.presets, name) ? evidence.presets[name] : evidence.presets.full;
  [left.value, right.value, roi.value] = preset;
  update();
}}
for (const control of controls) {{
  control.disabled = false;
  control.addEventListener('change', update);
}}
presetNav.addEventListener('click', event => {{
  if (event.target.matches('a') && event.target.hash === location.hash) applyPreset();
}});
window.addEventListener('hashchange', applyPreset);
applyPreset();
presetNav.hidden = false;
document.getElementById('selection').hidden = false;
</script></body></html>"""
