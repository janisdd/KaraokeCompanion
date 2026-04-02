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


def get_loudness_stats(input_file):
    # print("Analyzing input file...")
    in_stats = run_loudnorm_analysis(input_file)
    print(json.dumps(in_stats, indent=2))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python get_loudness_stats.py input.mp3")
        sys.exit(1)

    in_file = sys.argv[1]

    get_loudness_stats(in_file)