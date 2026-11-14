import argparse
from hashlib import sha256
import json
from pathlib import Path
from statistics import fmean, pstdev

from render import LABELS, comparison_svg, demo_html, pgm, png
from scene import blend, box_filter, crop, spatial_weights, tea_shop


ROOT = Path(__file__).resolve().parent
SOURCE_FILES = ("protocol.json", "scene.py", "solution.py", "render.py", "test_solution.py", "task.md")


def mae(frame, reference):
    return fmean(abs(value - truth) for row, clean_row in zip(frame, reference)
                 for value, truth in zip(row, clean_row))


def local_contrast(frame):
    return fmean(abs(right - left) for row in frame for left, right in zip(row, row[1:]))


def seam_error(frame, reference, scene):
    first_y, end_y = scene["seam_y_range"]
    radius = scene["seam_half_width"]
    return fmean(
        abs((frame[y][x] - frame[y][x - 1]) - (reference[y][x] - reference[y][x - 1]))
        for center in scene["seam_x_centers"]
        for x in range(center - radius, center + radius + 1)
        for y in range(first_y, end_y)
    )


def evaluate(frame, reference, scene):
    regions = scene["rois"]
    wall, wall_reference = crop(frame, regions["wall"]), crop(reference, regions["wall"])
    wood, wood_reference = crop(frame, regions["wood"]), crop(reference, regions["wood"])
    lamp, lamp_reference = crop(frame, regions["lamp"]), crop(reference, regions["lamp"])
    peak_x, peak_y = scene["lamp_peak_xy"]
    return {
        "wall_mae": mae(wall, wall_reference),
        "wall_residual_std": pstdev(value - truth for row, clean_row in zip(wall, wall_reference)
                                     for value, truth in zip(row, clean_row)),
        "wood_mae": mae(wood, wood_reference),
        "wood_contrast_ratio": local_contrast(wood) / local_contrast(wood_reference),
        "lamp_mae": mae(lamp, lamp_reference),
        "lamp_peak_loss": max(0, reference[peak_y][peak_x] - frame[peak_y][peak_x]),
        "lamp_peak_value": frame[peak_y][peak_x],
        "seam_excess_step_mae": seam_error(frame, reference, scene),
        "global_mae": mae(frame, reference),
    }


def judge(metrics, protocol):
    global_metrics, candidate_metrics = metrics["global"], metrics["spatial"]
    rules = {
        "global * 0.90": lambda baseline: baseline * 0.90,
        "global + 0.60": lambda baseline: baseline + 0.60,
        "global": lambda baseline: baseline,
        "min(28, global)": lambda baseline: min(28, baseline),
        "global + 1.50": lambda baseline: baseline + 1.50,
    }
    gates = []
    for spec in protocol["gates"]:
        metric = spec["metric"]
        value = candidate_metrics[metric]
        limit = rules[spec["limit_rule"]](global_metrics[metric])
        passed = value <= limit if spec["op"] == "<=" else value >= limit
        gates.append({**spec, "baseline": global_metrics[metric], "candidate": value,
                      "limit": limit, "passed": passed})
    return gates


def experiment(protocol):
    scene = protocol["scene"]
    width, height = scene["width"], scene["height"]
    reference, noisy = tea_shop(scene)
    weak = blend(noisy, box_filter(noisy, 1), [[protocol["weak"]["box_weight"]] * width for _ in range(height)])
    strong = box_filter(noisy, 3)
    global_map = [[protocol["global"]["strong_weight"]] * width for _ in range(height)]
    spatial_map = spatial_weights(width, height, protocol["spatial"])
    # The map is columnwise, so this fraction is the exact full-frame mean.
    mean_matched_numerator = sum(spatial_map[0])
    mean_matched_denominator = 100 * width
    mean_matched_map = [[mean_matched_numerator] * width for _ in range(height)]
    frames = {
        "reference": reference, "noisy": noisy, "weak": weak, "strong": strong,
        "global": blend(weak, strong, global_map), "spatial": blend(weak, strong, spatial_map),
        "weights": spatial_map,
        "mean_matched": blend(weak, strong, mean_matched_map, mean_matched_denominator),
    }
    metrics = {name: evaluate(frames[name], reference, scene)
               for name in ("noisy", "weak", "strong", "global", "spatial", "mean_matched")}
    return frames, metrics, judge(metrics, protocol)


def report_markdown(result):
    scene = result["scene"]
    protocol = result["protocol"]
    body = [
        "# 夜景茶铺分区融合实验报告",
        "",
        f"实验 `{result['experiment_id']}`，场景 `{scene['id']}`，种子 `{scene['seed']}`，"
        f"{scene['width']}×{scene['height']}，{scene['domain']}。{scene['split']}。",
        "",
        "复算命令 `python solution.py --out run`。单元测试 `python -m unittest -v`。",
        "",
        "## 方案从哪里来",
        "",
        "AI 调研选中 FFDNet Fig. 5 作为立题证据。原论文固定含噪图和模型，比较与空间噪声图均值相同的常量输入和空间变化输入，"
        "同一合成噪声样本的 PSNR 为 27.45 dB 与 30.08 dB。茶铺借鉴同图控制强度分布的实验思路，"
        "把改变强度的位置放到现有的后融合接口。 [FFDNet 原文 Fig. 5](https://arxiv.org/html/1710.04026v2#S4.F5)",
        "",
        "Exposure Fusion Fig. 4 展示了多曝光融合中的接缝和光晕，提醒我们在对照里单独检查分区交界。"
        " [Exposure Fusion 原文 Fig. 4](https://www.tommertens.com/old-academic/papers/exposure_fusion_reduced.pdf#page=5)",
        "",
        "## 固定项与变更项",
        "",
        "同一输入生成弱、强两个输出。弱支路为原输入 80% 与 3×3 方框均值 20% 的混合，强支路为 7×7 方框均值。"
        "方框滤波均用边缘像素复制，结果取最近的整数灰度。基线固定使用 50% 强支路。候选只修改强支路比例，"
        "左侧暗墙 85%，中间木纹 15%，右侧灯芯 8%，两个边界附近线性过渡。",
        "",
        protocol["spatial"]["basis"],
        "",
        f"补充诊断固定强支路权重为 {result['diagnostics']['mean_matched']['strong_weight']:.3f}%，"
        "等于分区图全局均值，用于观察固定强支路总比例后，改变其空间分布是否仍有差别。"
        "这组保留供读者核对，正式门槛仍比较 B 与 A（50%）。",
        "",
        "## 对照结果",
        "",
        "| 版本 | 暗墙 MAE | 暗墙残差标准差 | 木纹 MAE | 木纹相邻列反差比 | 灯区 MAE | 灯芯坐标亮度 | 灯芯亮度损失 | 交界梯度误差 MAE | 全图 MAE |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    keys = ["wall_mae", "wall_residual_std", "wood_mae", "wood_contrast_ratio", "lamp_mae",
            "lamp_peak_value", "lamp_peak_loss", "seam_excess_step_mae", "global_mae"]
    for name, metrics in result["metrics"].items():
        values = " | ".join(f"{metrics[key]:.3f}" for key in keys)
        body.append(f"| {LABELS[name]} | {values} |")
    body.extend([
        "", "误差、残差标准差和灯芯亮度以灰度级表示。木纹反差比是该 ROI 内水平相邻像素差绝对值的均值"
        "除以参考图对应值，接近 1 表示该统计量接近参考，噪声也可能抬高比值，因此与木纹 MAE 合看。"
        "交界 MAE 是水平邻接差相对参考图的绝对误差，并非主观接缝评分。",
        "",
        f"固定强支路全图均值后，暗墙残差标准差从常量权重的 {result['metrics']['mean_matched']['wall_residual_std']:.3f} "
        f"降到分区权重的 {result['metrics']['spatial']['wall_residual_std']:.3f}，"
        f"木纹 MAE 从 {result['metrics']['mean_matched']['wood_mae']:.3f} 降到 {result['metrics']['spatial']['wood_mae']:.3f}。"
        "这个样本中，强支路占比相同时，权重落在哪些像素仍会影响结果。",
        "",
        f"对单支路也做了对照。强支路的暗墙残差标准差为 {result['metrics']['strong']['wall_residual_std']:.3f}，"
        f"低于分区融合的 {result['metrics']['spatial']['wall_residual_std']:.3f}。"
        f"弱支路的木纹 MAE 为 {result['metrics']['weak']['wood_mae']:.3f}，"
        f"低于分区融合的 {result['metrics']['spatial']['wood_mae']:.3f}，"
        f"灯芯亮度损失也是 {result['metrics']['weak']['lamp_peak_loss']} 对 {result['metrics']['spatial']['lamp_peak_loss']}。"
        "分区融合在不同区域作了折中。",
        "", "## 冻结门槛", "",
        "| 项目 | 基线 | 候选 | 条件 | 判定 |",
        "| --- | ---: | ---: | --- | --- |",
    ])
    for gate in result["gates"]:
        verdict = "通过" if gate["passed"] else "失败"
        body.append(f"| {gate['label']} | {gate['baseline']:.3f} | {gate['candidate']:.3f} | "
                    f"{gate['op']} {gate['limit']:.3f}（{gate['limit_rule']}） | {verdict} |")
    body.extend([
        "", "门槛仅为本教学算例预设，使用未舍入数值判断。",
        "", f"本轮结论：{'全部过线，可安排独立同类型验证' if result['all_gates_pass'] else '有失败项，需要复核失败处才考虑扩大验证'}。",
        "", "## 使用边界与文件",
        "", "此实验借鉴空间控制思路，实施的是推理后混合，未运行 FFDNet 或真实 ISP。"
        "人工布局已知，不能据此判断自动分区、真实画质、模型性能或研发节省时间。",
        "", "`comparison.svg` 是同一坐标的整图对照，`roi-comparison.svg` 使用相同剪裁框。"
        "`demo.html` 内嵌本轮 PNG 与指标，可断网打开。`result.json` 保留 ROI、门槛和完整精度指标，"
        "`manifest.json` 可核对输出文件 SHA-256。PGM 是灰度像素原值，权重图 PGM 中 0–100 代表强支路百分比。",
    ])
    return "\n".join(body) + "\n"


def write_experiment(out):
    protocol = json.loads((ROOT / "protocol.json").read_text(encoding="utf-8"))
    frames, metrics, gates = experiment(protocol)
    frame_files = {name: f"{name}.pgm" for name in frames}
    method_files = {name: f"{name}.png" for name in frames}
    frame_bytes = {name: pgm(frame) for name, frame in frames.items()}
    png_bytes = {name: png(frame if name != "weights" else [[(value * 255 + 50) // 100 for value in row]
                                                          for row in frame]) for name, frame in frames.items()}
    result = {
        "experiment_id": protocol["experiment_id"],
        "scene": protocol["scene"],
        "protocol": protocol,
        "methods": LABELS,
        "metrics": metrics,
        "gates": gates,
        "all_gates_pass": all(gate["passed"] for gate in gates),
        "diagnostics": {"mean_matched": {"strong_weight": fmean(frames["weights"][0]),
                                          "weight_numerator": sum(frames["weights"][0]),
                                          "weight_denominator": 100 * len(frames["weights"][0]),
                                          "used_for_gates": False}},
        "artifacts": {"frames": frame_files, "images": method_files, "report": "report.md",
                      "demo": "demo.html", "comparison": "comparison.svg", "roi_comparison": "roi-comparison.svg",
                      "manifest": "manifest.json"},
        "provenance": {
            "source_sha256": {
                name: sha256((ROOT / name).read_bytes().replace(b"\r\n", b"\n")).hexdigest()
                for name in SOURCE_FILES
            },
            "source_line_endings": "文本 SHA-256 统一以 LF 计算；生成的输出按文件字节计算。",
            "frame_sha256": {frame_files[name]: sha256(data).hexdigest() for name, data in frame_bytes.items()},
            "command": "python solution.py --out run",
            "source": "本地程序生成的对齐合成灰度数据",
        },
    }
    outputs = {
        **{frame_files[name]: data for name, data in frame_bytes.items()},
        **{method_files[name]: data for name, data in png_bytes.items()},
        "result.json": (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
        "report.md": report_markdown(result).encode("utf-8"),
        "demo.html": demo_html(result, frames, png_bytes).encode("utf-8"),
        "comparison.svg": comparison_svg(result, frames, png_bytes, detail=False).encode("utf-8"),
        "roi-comparison.svg": comparison_svg(result, frames, png_bytes, detail=True).encode("utf-8"),
    }
    manifest = {
        "experiment_id": result["experiment_id"],
        "hash_algorithm": "SHA-256",
        "artifacts": {name: {"bytes": len(data), "sha256": sha256(data).hexdigest()}
                      for name, data in sorted(outputs.items())},
    }
    outputs["manifest.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    out.mkdir(parents=True, exist_ok=True)
    for name, data in outputs.items():
        (out / name).write_bytes(data)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="复算茶铺夜景分区融合实验")
    parser.add_argument("--out", type=Path, default=Path("run"), help="输出目录，默认 run")
    args = parser.parse_args()
    result = write_experiment(args.out)
    print(json.dumps({"experiment_id": result["experiment_id"], "out": str(args.out),
                      "all_gates_pass": result["all_gates_pass"],
                      "gates": {gate["id"]: gate["passed"] for gate in result["gates"]}}, ensure_ascii=False))
