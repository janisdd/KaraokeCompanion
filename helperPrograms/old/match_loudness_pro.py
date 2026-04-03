import subprocess
import json
import sys


def run_loudnorm_analysis(file_path):
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-i", file_path,
        "-af", "loudnorm=print_format=json",
        "-f", "null",
        "-"
    ]

    result = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)

    stderr = result.stderr
    start = stderr.find("{")
    end = stderr.rfind("}") + 1
    json_str = stderr[start:end]

    return json.loads(json_str)


def build_loudnorm_filter(measured, target):
    return (
        "loudnorm="
        f"I={target['I']}:"
        f"LRA={target['LRA']}:"
        f"TP={target['TP']}:"
        f"measured_I={measured['input_i']}:"
        f"measured_LRA={measured['input_lra']}:"
        f"measured_TP={measured['input_tp']}:"
        f"measured_thresh={measured['input_thresh']}:"
        f"offset={measured['target_offset']}:"
        "linear=true:"
        "print_format=summary"
    )


def match_loudness_two_pass(reference_file, input_file, output_file):
    print("Analyzing reference file...")
    ref_stats = run_loudnorm_analysis(reference_file)

    print("Analyzing input file...")
    in_stats = run_loudnorm_analysis(input_file)

    # Compute loudness difference
    ref_lufs = float(ref_stats["input_i"])
    in_lufs = float(in_stats["input_i"])
    lufs_diff = ref_lufs - in_lufs  # this is effectively gain in dB

    print("\n--- Loudness Comparison ---")
    print(f"Reference LUFS: {ref_lufs:.2f}")
    print(f"Input LUFS:     {in_lufs:.2f}")
    print(f"Difference:     {lufs_diff:.2f} dB")
    # print(f"FFmpeg offset: {float(in_stats['target_offset']):.2f} dB")

    # Use reference as target
    target = {
        "I": ref_lufs,
        "LRA": float(ref_stats["input_lra"]),
        "TP": float(ref_stats["input_tp"]),
    }

    print("\nApplying two-pass normalization...")

    filter_str = build_loudnorm_filter(in_stats, target)

    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_file,
        "-af", filter_str,
        output_file
    ]

    subprocess.run(cmd, check=True)

    print(f"\nDone! Output written to: {output_file}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python match_loudness_pro.py reference.mp3 input.mp3 output.mp3")
        sys.exit(1)

    ref_file = sys.argv[1]
    in_file = sys.argv[2]
    out_file = sys.argv[3]

    match_loudness_two_pass(ref_file, in_file, out_file)