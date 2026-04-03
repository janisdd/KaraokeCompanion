import json
import subprocess
import sys

TARGET_LRA_DEFAULT = 11.0
TARGET_TP_DEFAULT = -1.5


def validate_analysis(analysis: dict) -> None:
    if not isinstance(analysis, dict):
        raise ValueError("analysis_json must decode to an object")

    required_keys = [
        "input_i",
        "input_lra",
        "input_tp",
        "input_thresh",
        "target_offset",
    ]
    missing_keys = [key for key in required_keys if key not in analysis]

    if missing_keys:
        raise ValueError(
            f"analysis_json is missing required keys: {', '.join(missing_keys)}"
        )


def build_two_pass_filter_str(
    measured: dict,
    target_i_lufs: float,
) -> str:
    return (
        "loudnorm="
        f"I={target_i_lufs}:"
        f"LRA={TARGET_LRA_DEFAULT}:"
        f"TP={TARGET_TP_DEFAULT}:"
        f"measured_I={measured['input_i']}:"
        f"measured_LRA={measured['input_lra']}:"
        f"measured_TP={measured['input_tp']}:"
        f"measured_thresh={measured['input_thresh']}:"
        f"offset={measured['target_offset']}:"
        "linear=true:"
        "print_format=summary"
    )


def match_loudness_two_pass_by_target_analysis(
    input_file: str,
    analysis: dict,
    target_i_lufs: float,
    output_file: str,
) -> None:
    validate_analysis(analysis)
    filter_str = build_two_pass_filter_str(analysis, target_i_lufs)

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
    if len(sys.argv) != 5:
        print("Usage: python3 matchLoudnessTwoPassByTarget.py <input_file> <analysis_json> <target_lufs_I> <output_file>")
        sys.exit(1)

    in_file = sys.argv[1]

    try:
        analysis = json.loads(sys.argv[2])
    except json.JSONDecodeError:
        print("analysis_json must be valid JSON", file=sys.stderr)
        sys.exit(1)

    try:
        target_lufs_i = float(sys.argv[3])
    except ValueError:
        print("target_lufs_I must be a number", file=sys.stderr)
        sys.exit(1)

    out_file = sys.argv[4]
    match_loudness_two_pass_by_target_analysis(in_file, analysis, target_lufs_i, out_file)

