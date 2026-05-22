#!/usr/bin/env python3
"""Parse Word Lists.pdf into data/word-lists.json for LexiQuest Option B path."""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF_CANDIDATES = [
    ROOT / "data" / "Word Lists.pdf",
    Path(r"D:\Work\Projects\Lexiquest\data\Word Lists.pdf"),
]
OUT = ROOT / "data" / "word-lists.json"
WORDS_JSON = ROOT / "data" / "words.json"

LIST_ICONS = ["📘", "📗", "📙", "📕", "📓", "📔", "📒", "📚", "🔖", "📝", "✏️", "🎯", "🏁"]
LIST_COLORS = [
    "lavender", "sky", "coral", "gold", "lime",
    "lavender", "sky", "coral", "gold", "lime",
    "lavender", "sky", "lime",
]


def find_pdf():
    for p in PDF_CANDIDATES:
        if p.exists():
            return p
    raise FileNotFoundError("Word Lists.pdf not found in data/ or Lexiquest project")


def normalize_part(raw):
    w = raw.strip()
    w = re.sub(r"\s+", " ", w)
    if not w or len(w) < 2:
        return None
    return w.title() if w.isupper() else w.capitalize()


def expand_word_token(raw, role):
    """Split PDF tokens like ELUDE/ELUSIVE or FORESIGHT/ FORESEE into separate words."""
    raw = raw.strip()
    parts = [p for p in re.split(r"/\s*", raw) if p.strip()]
    out = []
    for i, part in enumerate(parts):
        word = normalize_part(part)
        if not word:
            continue
        if word.upper() in ("VERY", "CAUSING", "SIGN", "OLD", "TO", "RULE", "SHORT", "HAVING"):
            if len(word) < 5:
                continue
        entry_role = role if i == 0 else ("variant" if role == "normal" else role)
        out.append((word, entry_role))
    return out


WORD_TOKEN = r"[A-Z][A-Za-z\-]+(?:/\s*[A-Z][A-Za-z\-]+)*"


def parse_pdf_text(text):
    text = re.sub(r"\s+", " ", text).strip()
    chunks = re.split(r"(List\s+\d+)\s+", text)
    if chunks and not chunks[0].strip():
        chunks = chunks[1:]
    lists = []
    i = 0
    while i < len(chunks) - 1:
        header = chunks[i]
        body = chunks[i + 1]
        m = re.match(r"List\s+(\d+)", header)
        if not m:
            i += 1
            continue
        list_num = int(m.group(1))
        groups = []
        parts = re.split(r"(G\d+)\s+", body)
        j = 1
        while j < len(parts) - 1:
            gid = parts[j]
            gbody = parts[j + 1]
            j += 2
            gm = re.match(r"G(\d+)", gid)
            if not gm:
                continue
            gnum = int(gm.group(1))
            first_word = re.search(
                rf"\d+\s+(?:X\s+|#\s+|\*\s+)?({WORD_TOKEN})",
                gbody,
            )
            if not first_word:
                continue
            title = gbody[: first_word.start()].strip()
            title = re.sub(r"\s+", " ", title)
            title = title.strip(" /-")
            word_entries = []
            for wm in re.finditer(
                rf"(\d+)\s+(X\s+|#\s+|\*\s+)?({WORD_TOKEN})",
                gbody[first_word.start() :],
            ):
                role = "normal"
                prefix = (wm.group(2) or "").strip()
                if prefix.startswith("X"):
                    role = "antonym"
                elif prefix.startswith("#"):
                    role = "contrast"
                elif prefix.startswith("*"):
                    role = "note"
                for word, entry_role in expand_word_token(wm.group(3), role):
                    word_entries.append(
                        {
                            "word": word,
                            "index": int(wm.group(1)),
                            "role": entry_role,
                        }
                    )
            if not word_entries:
                continue
            groups.append(
                {
                    "id": f"L{list_num}-G{gnum}",
                    "groupNum": gnum,
                    "title": title or f"Group {gnum}",
                    "words": word_entries,
                }
            )
        lists.append(
            {
                "id": f"list-{list_num}",
                "listNum": list_num,
                "title": f"List {list_num}",
                "icon": LIST_ICONS[(list_num - 1) % len(LIST_ICONS)],
                "color": LIST_COLORS[(list_num - 1) % len(LIST_COLORS)],
                "groups": groups,
            }
        )
        i += 2
    return lists


def title_case_word(w):
    return w[0].upper() + w[1:] if w else w


def load_existing_words():
    if not WORDS_JSON.exists():
        return {}
    data = json.loads(WORDS_JSON.read_text(encoding="utf-8"))
    return {title_case_word(x["word"]): x for x in data}


def merge_word_index(lists, existing):
    index = {}
    stubs = []
    for lst in lists:
        for grp in lst["groups"]:
            for entry in grp["words"]:
                name = entry["word"]
                key = title_case_word(name)
                if key in index:
                    continue
                if key in existing:
                    rec = dict(existing[key])
                else:
                    rec = {
                        "word": key,
                        "phonetic": "",
                        "pos": "word",
                        "def": f"Vocabulary word from {lst['title']} · {grp['title']}.",
                        "example": f"Study <em>{key.lower()}</em> in context — group: {grp['title']}.",
                        "syn": "",
                        "ant": entry["role"] == "antonym" and "opposite cluster" or "",
                        "tags": ["GRE", "GMAT", "IELTS"],
                        "premium": False,
                        "stub": True,
                    }
                    stubs.append(key)
                rec["list"] = lst["listNum"]
                rec["listId"] = lst["id"]
                rec["group"] = grp["id"]
                rec["groupTitle"] = grp["title"]
                rec["groupRole"] = entry["role"]
                index[key] = rec
    return index, stubs


def main():
    try:
        import pypdf
    except ImportError:
        print("Install pypdf: pip install pypdf", file=sys.stderr)
        sys.exit(1)

    pdf = find_pdf()
    text = ""
    for page in pypdf.PdfReader(str(pdf)).pages:
        text += (page.extract_text() or "") + "\n"

    lists = parse_pdf_text(text)
    existing = load_existing_words()
    word_index, stubs = merge_word_index(lists, existing)

    out = {
        "source": pdf.name,
        "version": 2,
        "listCount": len(lists),
        "groupCount": sum(len(x["groups"]) for x in lists),
        "wordCount": sum(len(g["words"]) for x in lists for g in x["groups"]),
        "uniqueWords": len(word_index),
        "stubCount": len(stubs),
        "lists": lists,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    merged_path = ROOT / "data" / "words-merged.json"
    merged = sorted(word_index.values(), key=lambda w: w["word"].lower())
    merged_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"PDF: {pdf}")
    print(f"Lists: {out['listCount']}, Groups: {out['groupCount']}")
    print(f"Word entries: {out['wordCount']}, Unique: {out['uniqueWords']}, Stubs: {out['stubCount']}")
    print(f"Wrote {OUT}")
    print(f"Wrote {merged_path}")


if __name__ == "__main__":
    main()
