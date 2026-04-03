import json
import subprocess
import sys


def validate_analysis(analysis: dict, argument_name: str) -> None:
    if not isinstance(analysis, dict):
        raise ValueError(f"{argument_name} must decode to an object")

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
            f"{argument_name} is missing required keys: {', '.join(missing_keys)}"
        )

    for key in required_keys:
        try:
            float(analysis[key])
        except (TypeError, ValueError) as error:
            raise ValueError(f"{argument_name}.{key} must be numeric") from error


def validate_reference_analysis(reference_analysis: dict) -> None:
    validate_analysis(reference_analysis, "reference_analysis_json")


def get_reference_targets(reference_analysis: dict) -> dict[str, float]:
    target_tp = min(float(reference_analysis["input_tp"]), 0.0)

    return {
        "I": float(reference_analysis["input_i"]),
        "LRA": float(reference_analysis["input_lra"]),
        "TP": target_tp,
    }


def build_second_pass_filter_str(measured: dict, targets: dict[str, float]) -> str:
    return (
        "loudnorm="
        f"I={targets['I']}:"
        f"LRA={targets['LRA']}:"
        f"TP={targets['TP']}:"
        f"measured_I={measured['input_i']}:"
        f"measured_LRA={measured['input_lra']}:"
        f"measured_TP={measured['input_tp']}:"
        f"measured_thresh={measured['input_thresh']}:"
        f"offset={measured['target_offset']}:"
        "linear=true:"
        "print_format=summary"
    )
def match_loudness_two_pass_by_reference(
    input_file: str,
    input_analysis: dict,
    reference_analysis: dict,
    output_file: str,
) -> None:
    validate_analysis(input_analysis, "input_analysis_json")
    validate_reference_analysis(reference_analysis)
    targets = get_reference_targets(reference_analysis)
    filter_str = build_second_pass_filter_str(input_analysis, targets)

    print(
        "Applying two-pass loudnorm normalization "
        f"using reference targets I={targets['I']}, "
        f"LRA={targets['LRA']}, TP={targets['TP']}..."
    )
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
        print(
            "Usage: python3 matchLoudnessTwoPassByReference.py "
            "<input_file> <input_analysis_json> <reference_analysis_json> <output_file>"
        )
        sys.exit(1)

    in_file = sys.argv[1]

    try:
        input_analysis = json.loads(sys.argv[2])
    except json.JSONDecodeError:
        print("input_analysis_json must be valid JSON", file=sys.stderr)
        sys.exit(1)

    try:
        reference_analysis = json.loads(sys.argv[3])
    except json.JSONDecodeError:
        print("reference_analysis_json must be valid JSON", file=sys.stderr)
        sys.exit(1)

    out_file = sys.argv[4]

    try:
        match_loudness_two_pass_by_reference(
            in_file,
            input_analysis,
            reference_analysis,
            out_file,
        )
    except subprocess.CalledProcessError as error:
        print(
            f"ffmpeg failed with exit code {error.returncode}",
            file=sys.stderr,
        )
        sys.exit(error.returncode)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
