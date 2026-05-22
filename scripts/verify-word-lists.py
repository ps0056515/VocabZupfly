#!/usr/bin/env python3
"""Verify word-lists.json captures all words from Word Lists.pdf."""

import json
import re
import sys
from collections import Counter
from pathlib import Path

import pypdf

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "data" / "Word Lists.pdf"
if not PDF.exists():
    PDF = Path(r"D:\Work\Projects\Lexiquest\data\Word Lists.pdf")


def normalize(raw):
    w = raw.strip()
    if "/" in w:
        w = w.split("/")[0].strip()
    if w.isupper():
        return w.title()
    return w[0].upper() + w[1:] if w else w


def load_parsed():
    wl = json.loads((ROOT / "data" / "word-lists.json").read_text(encoding="utf-8"))
    merged = json.loads((ROOT / "data" / "words-merged.json").read_text(encoding="utf-8"))
    parsed = set()
    for lst in wl["lists"]:
        for g in lst["groups"]:
            for w in g["words"]:
                parsed.add(w["word"].strip().lower())
    merged_set = {w["word"].strip().lower() for w in merged}
    return wl, parsed, merged_set


def extract_pdf_words(text):
    text = re.sub(r"\s+", " ", text)
    words = set()
    display = {}
    for m in re.finditer(
        r"(\d+)\s+(X\s+|#\s+|\*\s+)?([A-Z][A-Za-z\-/]+(?:/[A-Z][A-Za-z]+)?)",
        text,
    ):
        w = normalize(m.group(3))
        if len(w) < 3:
            continue
        k = w.lower()
        words.add(k)
        display[k] = w
    return words, display


def parse_with_official_script():
    """Re-run same logic as parse-word-lists-pdf.py for ground truth."""
    sys.path.insert(0, str(ROOT / "scripts"))
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "parser", ROOT / "scripts" / "parse-word-lists-pdf.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    text = ""
    for page in pypdf.PdfReader(str(PDF)).pages:
        text += (page.extract_text() or "") + "\n"
    lists = mod.parse_pdf_text(text)
    official = set()
    entry_count = 0
    for lst in lists:
        for g in lst["groups"]:
            for w in g["words"]:
                official.add(w["word"].strip().lower())
                entry_count += 1
    return lists, official, entry_count


def main():
    if not PDF.exists():
        print("ERROR: Word Lists.pdf not found")
        sys.exit(1)

    wl, parsed, merged = load_parsed()
    text = ""
    for page in pypdf.PdfReader(str(PDF)).pages:
        text += (page.extract_text() or "") + "\n"

    pdf_raw, pdf_display = extract_pdf_words(text)
    official_lists, official_words, official_entries = parse_with_official_script()

    missing_from_json = official_words - parsed
    extra_in_json = parsed - official_words
    missing_merged = parsed - merged

    print("=== Word Lists audit ===")
    print(f"PDF: {PDF}")
    print(f"Pages: {len(pypdf.PdfReader(str(PDF)).pages)}")
    print()
    print(f"Official parser: {len(official_lists)} lists, {sum(len(x['groups']) for x in official_lists)} groups")
    print(f"Official parser: {official_entries} entries, {len(official_words)} unique words")
    print(f"word-lists.json: {wl['listCount']} lists, {wl['groupCount']} groups")
    print(f"word-lists.json: {wl['wordCount']} entries, {len(parsed)} unique words")
    print(f"words-merged.json: {len(merged)} words")
    print()
    print(f"JSON matches official parser: {parsed == official_words}")
    print(f"All parsed words in merged: {len(missing_merged) == 0}")
    print(f"Raw PDF regex unique (noisy): {len(pdf_raw)}")
    print(f"Official vs raw PDF diff: {len(official_words - pdf_raw)} official-only, {len(pdf_raw - official_words)} raw-only")

    if missing_from_json:
        print(f"\nMISSING from word-lists.json ({len(missing_from_json)}):")
        for k in sorted(missing_from_json)[:50]:
            print(f"  - {k}")
        if len(missing_from_json) > 50:
            print(f"  ... and {len(missing_from_json) - 50} more")

    if extra_in_json:
        print(f"\nEXTRA in word-lists.json ({len(extra_in_json)}):")
        for k in sorted(extra_in_json)[:20]:
            print(f"  - {k}")

    if missing_merged:
        print(f"\nIn word-lists but NOT merged ({len(missing_merged)}):")
        for k in sorted(missing_merged)[:20]:
            print(f"  - {k}")

    print("\n=== Per list ===")
    for lst in wl["lists"]:
        wc = sum(len(g["words"]) for g in lst["groups"])
        print(f"  List {lst['listNum']:>2}: {len(lst['groups']):>3} groups, {wc:>4} word entries")

    # Duplicates across groups
    c = Counter()
    locs = {}
    for lst in wl["lists"]:
        for g in lst["groups"]:
            for w in g["words"]:
                k = w["word"].lower()
                c[k] += 1
                locs.setdefault(k, []).append(f"L{lst['listNum']}-{g['id']}")
    dups = [k for k, v in c.items() if v > 1]
    print(f"\nDuplicate words (appear in multiple groups): {len(dups)}")
    if dups[:10]:
        for k in dups[:10]:
            print(f"  {k}: {c[k]}x in {', '.join(locs[k][:3])}")

    # Coverage rate
    if official_words:
        pct = 100 * len(parsed & official_words) / len(official_words)
        print(f"\nCoverage: {pct:.1f}% of official parser words in word-lists.json")

    sys.exit(0 if not missing_from_json and not missing_merged else 1)


if __name__ == "__main__":
    main()
