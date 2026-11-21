"""Split a CK-12 unit PDF into one PDF per numbered section (4.1, 4.2, ...).

A section starts on any page whose first line begins with "<unit>.<n>"
(e.g. "4.12 Mitosis"). Pages before the first section (the unit cover)
are left out. Each section runs until the page before the next one.

Usage:
    python3 split_sections.py "Unit 4 The Circle of Life.pdf" output_folder
Requires:  pip install pypdf
"""
import re
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter

# "4.12 Mitosis" or a bare "4.17" -- but not a page footer like "4.12. Mitosis www.ck12.org"
HEADING = re.compile(r"^(\d+\.\d+)(?:\s+(.*))?$")
MAX_TITLE_LINES = 4


def section_start(lines):
    """Return (number, title) if this page starts a section, else None.

    A section heading is followed (after its title, which may wrap over
    several lines) by the "FlexBooks 2.0 > ..." breadcrumb. The unit's final
    REFERENCES section has no breadcrumb, so it is recognised by name.
    """
    if not lines:
        return None
    m = HEADING.match(lines[0])
    if not m:
        return None
    num, first = m.group(1), (m.group(2) or "")
    parts = [first]
    for line in lines[1 : 1 + MAX_TITLE_LINES]:
        if line.startswith("FlexBooks"):
            return num, " ".join(p for p in parts if p).strip()
        if line == "REFERENCES" and not first:
            return num, "References"
        parts.append(line)
    return None


def find_sections(reader):
    starts = []
    for i, page in enumerate(reader.pages):
        lines = [l.strip() for l in (page.extract_text() or "").splitlines() if l.strip()]
        found = section_start(lines)
        if found:
            starts.append((i, *found))
    return starts


def safe_name(text):
    text = text.replace(":", " -")  # colons aren't allowed in Mac/Windows file names
    return re.sub(r'[\\/*?"<>|]', "", text).strip()


def main(pdf_path, out_dir):
    reader = PdfReader(pdf_path)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    starts = find_sections(reader)
    if not starts:
        sys.exit("No numbered section headings found.")
    for k, (first, num, title) in enumerate(starts):
        last = starts[k + 1][0] - 1 if k + 1 < len(starts) else len(reader.pages) - 1
        writer = PdfWriter()
        for p in range(first, last + 1):
            writer.add_page(reader.pages[p])
        name = safe_name(f"{num} {title}") + ".pdf"
        with open(out / name, "wb") as f:
            writer.write(f)
        print(f"{name}\tpages {first + 1}-{last + 1}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
