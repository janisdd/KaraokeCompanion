import subprocess
import sys


def change_relative_loudness(input_file: str, db_change: float, output_file: str) -> None:

    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-i", input_file,
        "-map", "0",
        "-filter:a", f"volume={db_change}dB",
        "-c:v", "copy",
        "-c:s", "copy",
        "-c:d", "copy",
        output_file
    ]

    try:
        subprocess.run(cmd, check=True, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(error.stderr.strip() or error.stdout.strip() or "ffmpeg failed") from error


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python3 changeRelativeLoudness.py <input_file> <db_change> <output_file>")
        sys.exit(1)

    input_path = sys.argv[1]

    try:
        db_delta = float(sys.argv[2])
    except ValueError:
        print("db_change must be a number")
        sys.exit(1)

    output_path = sys.argv[3]

    try:
        change_relative_loudness(input_path, db_delta, output_path)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
