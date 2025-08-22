import os
import re
import math

def sanitize_filename(name: str) -> str:
    """Make user input safe for folder/file names."""
    return re.sub(r'[^A-Za-z0-9_\-]', '_', name.strip())

def get_files():
    """Return all .md and .txt files in current directory (excluding this script)."""
    all_files = [f for f in os.listdir('.') if os.path.isfile(f)]
    return sorted([f for f in all_files if f.lower().endswith(('.md', '.txt'))])

def distribute_files(files, num_bins=20):
    """
    Greedy bin packing: assign files to bins to balance total size.
    Preserves alphabetical order as much as possible.
    """
    # Get sizes
    file_sizes = [(f, os.path.getsize(f)) for f in files]

    # Initialize bins
    bins = [[] for _ in range(num_bins)]
    bin_sizes = [0] * num_bins

    # Greedy assignment: go through in order and place in the bin with smallest current size
    for fname, size in file_sizes:
        idx = bin_sizes.index(min(bin_sizes))
        bins[idx].append(fname)
        bin_sizes[idx] += size

    return bins

def combine_files(bins, topic):
    """Write combined files into new folder."""
    folder_name = sanitize_filename(topic)
    os.makedirs(folder_name, exist_ok=True)

    for i, group in enumerate(bins, start=1):
        out_name = f"{folder_name}/{folder_name}_combined_{i}.md"
        with open(out_name, 'w', encoding='utf-8') as out_f:
            for fname in group:
                out_f.write(f"**Original file: {fname}**\n\n")
                with open(fname, 'r', encoding='utf-8', errors='ignore') as in_f:
                    out_f.write(in_f.read().strip())
                out_f.write("\n\n\n")  # extra spacing between files

def main():
    topic = input("Enter topic name: ")
    files = get_files()

    if not files:
        print("No .md or .txt files found in this directory.")
        return

    bins = distribute_files(files, num_bins=20)
    combine_files(bins, topic)

    print(f"✅ Finished combining {len(files)} files into 20 files in folder '{sanitize_filename(topic)}'.")

if __name__ == "__main__":
    main()
