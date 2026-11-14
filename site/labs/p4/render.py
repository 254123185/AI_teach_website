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
        title = "同一张茶铺夜景的输入、支路与融合结果"
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
    choices = "".join(f'<option value="{method}">{LABELS[method]}</option>' for method in frame_names)
    region_choices = "".join(f'<option value="{region}">{name}</option>' for region, name in regions.items())
    rows = "".join(
        f"<tr><th>{escape(gate['label'])}</th><td>{gate['baseline']:.3f}</td><td>{gate['candidate']:.3f}</td>"
        f"<td>{escape(gate['op'])} {gate['limit']:.3f}</td><td>{'通过' if gate['passed'] else '失败'}</td></tr>"
        for gate in result["gates"]
    )
    bundle = dumps({"scene": scene, "images": images, "labels": LABELS, "regions": regions, "boxes": areas,
                    "metrics": result["metrics"], "experiment_id": result["experiment_id"]},
                   ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>茶铺夜景 · 分区融合 A/B</title><link rel="icon" href="data:,">
<style>
  *{{box-sizing:border-box}} body{{margin:0;background:#f6f7ee;color:#19291f;font:16px/1.55 system-ui,sans-serif}}
  main{{max-width:960px;margin:auto;padding:1rem clamp(.6rem,3vw,2rem) 2rem}}
  h1{{line-height:1.18;margin:.5rem 0}} p{{margin:.55rem 0}}
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
<p class="muted">{escape(result['experiment_id'])} · 合成灰度场景 · 可离线复算对照</p>
<h1>同一输入的固定权重与分区权重</h1>
<p>弱、强两路固定。A 的强支路权重处处为 50%。B 在暗墙、木纹、灯芯邻域分别为 85%、15%、8%，边界线性过渡。</p>
<p class="muted">均值匹配诊断使用 B 的全图平均权重（{result['diagnostics']['mean_matched']['strong_weight']:.3f}%），门槛表仍比较 B 和 A。</p>
<div class="controls">
<label for="method-a">左图<select id="method-a">{choices}</select></label>
<label for="method-b">右图<select id="method-b">{choices}</select></label>
<label for="region" class="scope">同坐标剪裁<select id="region">{region_choices}</select></label>
</div>
<div class="panels">
<figure><div class="frame"><img id="frame-a" src="{images['global']['full']}" alt="固定权重"></div><figcaption id="label-a">A · 固定权重</figcaption></figure>
<figure><div class="frame"><img id="frame-b" src="{images['spatial']['full']}" alt="分区权重"></div><figcaption id="label-b">B · 分区权重</figcaption></figure>
</div>
<p class="small" id="position" role="status"></p>
<p class="small" id="selection" role="status"></p>
<h2>固定比较 · B 对 A</h2>
<p class="status">{'本张教学图全部过线' if result['all_gates_pass'] else '本张教学图有未通过项'}</p>
<div class="table-wrap" tabindex="0" aria-label="固定门槛结果">
<table><thead><tr><th>门槛</th><th>A</th><th>B</th><th>条件</th><th>判定</th></tr></thead><tbody>{rows}</tbody></table></div>
<p class="muted">此页展示同一实验的预计算像素和指标。切换视图不调整算法或门槛。没有独立实拍，不能据此判断部署效果。权重图黑 0%、白 100%。</p>
</main>
<script type="application/json" id="experiment">{bundle}</script>
<script>
const evidence = JSON.parse(document.getElementById('experiment').textContent);
const left = document.getElementById('method-a');
const right = document.getElementById('method-b');
const roi = document.getElementById('region');
left.value = 'global';
right.value = 'spatial';
function update() {{
  const region = roi.value;
  for (const [side, method] of [['a',left.value],['b',right.value]]) {{
    const image = document.getElementById('frame-' + side);
    image.src = evidence.images[method][region];
    image.alt = evidence.labels[method] + '，' + evidence.regions[region];
    document.getElementById('label-' + side).textContent = evidence.labels[method];
  }}
  const frameBox = [0,0,evidence.scene.width,evidence.scene.height];
  document.getElementById('position').textContent =
    evidence.regions[region] + '，评估坐标 [x, y, 宽, 高] = [' +
    (evidence.boxes[region] ?? frameBox).join(', ') + ']';
  const metric = region === 'full' ? 'global_mae' : region + '_mae';
  const results = [left.value,right.value].map(method => {{
    if (method === 'reference') return '参考图 0.000';
    if (method === 'weights') return '权重图不计 MAE';
    if (region.startsWith('seam')) return evidence.labels[method] + ' ' + evidence.metrics[method].seam_excess_step_mae.toFixed(3);
    return evidence.labels[method] + ' ' + evidence.metrics[method][metric].toFixed(3);
  }});
  const metricLabel = region.startsWith('seam') ? '两处交界合计梯度误差 MAE' : '所选范围 MAE';
  document.getElementById('selection').textContent = metricLabel + '（灰度级） · ' + results.join(' / ');
}}
for (const control of [left,right,roi]) control.addEventListener('change', update);
update();
</script></body></html>"""
