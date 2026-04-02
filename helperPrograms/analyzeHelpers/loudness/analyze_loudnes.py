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

    # print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)

    stderr = result.stderr
    loudnorm_start = stderr.find("[Parsed_loudnorm")
    start = stderr.find("{", loudnorm_start)
    end = stderr.rfind("}") + 1

    if loudnorm_start == -1 or start == -1 or end == 0:
        raise ValueError("Could not locate loudnorm JSON output in ffmpeg stderr")

    json_str = stderr[start:end]

    return json.loads(json_str)


def get_loudness_stats(input_file):
    # print("Analyzing input file...")
    in_stats = run_loudnorm_analysis(input_file)
    print(json.dumps(in_stats, indent=2))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python analyze_loudness.py input.mp3")
        sys.exit(1)

    in_file = sys.argv[1]

    get_loudness_stats(in_file)