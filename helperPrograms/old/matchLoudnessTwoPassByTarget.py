import json
import subprocess
import sys

# EBU R128 / FFmpeg loudnorm filter (from AI)

# LRA (Loudness Range)
# Describes how much the loudness varies over time (quiet vs loud parts), not “how loud on average.”
# In loudnorm, target LRA steers how much the processor is allowed to reshape dynamics to hit your targets while keeping a plausible loudness range for the content type.

# TP (True Peak)
# A peak ceiling in dBTP (true peak, inter-sample peaks considered).
# It limits how high the peaks can go after normalization; lowering TP makes the output more peak-safe (less risk of clipping on playback), often at the cost of more limiting/compression if I is held fixed.

# Rough intuition: I = average loudness you’re aiming for, TP = “don’t let spikes poke above here,” LRA = “don’t let the loud/quiet spread end up wildly wrong for this kind of material.”

TARGET_LRA_DEFAULT = 11.0
TARGET_TP_DEFAULT = -1.5


def run_loudnorm_analysis(input_file: str, target_i_lufs: float, target_lra: float, target_tp: float) -> dict:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-i",
        input_file,
        "-af",
        f"loudnorm=I={target_i_lufs}:LRA={target_lra}:TP={target_tp}:print_format=json",
        "-f",
        "null",
        "-",
    ]

    result = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "ffmpeg analysis failed")

    stderr = result.stderr
    start = stderr.find("{")
    end = stderr.rfind("}") + 1
    if start == -1 or end <= start:
        raise RuntimeError(f"Could not find loudnorm JSON in ffmpeg output: {stderr}")

    json_str = stderr[start:end]
    return json.loads(json_str)


def build_two_pass_filter_str(
    measured: dict,
    target_i_lufs: float,
    target_lra: float,
    target_tp: float,
) -> str:
    return (
        "loudnorm="
        f"I={target_i_lufs}:"
        f"LRA={target_lra}:"
        f"TP={target_tp}:"
        f"measured_I={measured['input_i']}:"
        f"measured_LRA={measured['input_lra']}:"
        f"measured_TP={measured['input_tp']}:"
        f"measured_thresh={measured['input_thresh']}:"
        f"offset={measured['target_offset']}:"
        "linear=true:"
        "print_format=summary"
    )


def match_loudness_two_pass_by_target_lufs(input_file: str, target_i_lufs: float, output_file: str) -> None:
    target_lra = TARGET_LRA_DEFAULT
    target_tp = TARGET_TP_DEFAULT

    print("Analyzing input file...")
    analysis = run_loudnorm_analysis(input_file, target_i_lufs, target_lra, target_tp)

    filter_str = build_two_pass_filter_str(analysis, target_i_lufs, target_lra, target_tp)

    print("Applying two-pass loudnorm normalization...")
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-i",
        input_file,
        "-af",
        filter_str,
        output_file,
    ]

    subprocess.run(cmd, check=True)
    print(f"Done! Output written to: {output_file}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python3 matchLoudnessTwoPassByTarget.py <input_file> <target_lufs_I> <output_file>")
        sys.exit(1)

    in_file = sys.argv[1]
    try:
        target_lufs_i = float(sys.argv[2])
    except ValueError:
        print("target_lufs_I must be a number", file=sys.stderr)
        sys.exit(1)

    out_file = sys.argv[3]
    match_loudness_two_pass_by_target_lufs(in_file, target_lufs_i, out_file)

