import os
import sys

MAX_WORDS = 100000  # max words per output chunk


def count_words_in_text(text):
    return len(text.split())


def load_markdown(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def process_directory(root_dir):
    output_dir = os.path.join(root_dir, "output_chunks")
    os.makedirs(output_dir, exist_ok=True)

    # Collect all markdown files recursively
    md_files = []
    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.lower().endswith(".md"):
                md_files.append(os.path.join(dirpath, filename))

    # Optional but cleaner: sort alphabetically
    md_files.sort()

    print(f"[INFO] Found {len(md_files)} markdown files.")

    chunk_index = 1
    current_chunk_words = 0
    current_chunk_text = []

    def write_chunk():
        nonlocal chunk_index, current_chunk_text
        if not current_chunk_text:
            return
        out_path = os.path.join(output_dir, f"chunk_{chunk_index}.md")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n\n".join(current_chunk_text))
        print(f"[INFO] Created {out_path}")
        chunk_index += 1
        current_chunk_text = []

    # Build chunks by *adding entire markdown files as blocks*
    for mdfile in md_files:
        content = load_markdown(mdfile)
        words = count_words_in_text(content)

        # If adding this file would exceed the chunk limit → start a new chunk
        if current_chunk_words + words > MAX_WORDS and current_chunk_words > 0:
            write_chunk()
            current_chunk_words = 0

        # Add the entire markdown file (never partial)
        header = f"\n\n---\n\n<!-- Source: {mdfile} -->\n\n"
        current_chunk_text.append(header + content)
        current_chunk_words += words

    # Final chunk
    if current_chunk_text:
        write_chunk()

    print(f"[SUCCESS] Generated {chunk_index - 1} combined chunks at: {output_dir}")


def main():
    # Target directory provided or current working directory
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
        if not os.path.isdir(target_dir):
            print(f"[ERROR] Not a directory: {target_dir}")
            sys.exit(1)
    else:
        target_dir = os.getcwd()

    process_directory(target_dir)


if __name__ == "__main__":
    main()
