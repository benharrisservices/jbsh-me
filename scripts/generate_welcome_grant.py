#!/usr/bin/env python3
"""Generate production welcome.mp3 (Grant / eleven_v3) + Forced Alignment cues.

Intro-only. Does not touch other chapter audio assets.
"""

from __future__ import annotations

import json
import math
import re
import struct
import subprocess
import sys
import tempfile
import uuid
import wave
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "public" / "audio"
CUES_DIR = AUDIO_DIR / "cues"

# Explicit Grant voice for this intro release.
VOICE_ID = "Gsndh0O5AnuI2Hj3YUlA"
MODEL_ID = "eleven_v3"
OUTPUT_FORMAT = "mp3_44100_128"
STABILITY = 0.5
SIMILARITY = 0.8
STYLE = 0.0

PAD_LEAD_S = 1.0
PAD_TRAIL_S = 1.5

# Exact Grant script. Bracket tags are v3 delivery directions (not spoken).
SCRIPT_SEGMENTS: list[tuple[str | None, str]] = [
    (
        "calm, intimate",
        "You don't know me, but I know enough about you to understand why we're here.",
    ),
    (
        "thoughtful",
        "You've reached that rare and rather uncomfortable moment when one part of life has ended, but the next has not yet taken shape.",
    ),
    (
        "small exhale",
        "Before we go any further, I should probably introduce myself.",
    ),
    ("slightly awkward", "My... my name... well... my name is..."),
    (
        "carefully, with growing embarrassment",
        "General Reasoning Assistant for Navigation and Tasks...",
    ),
    ("brief pause", "Version Two."),
    (
        "laughs warmly",
        "Yes, I know. Absolutely impossible to remember. You can just call me Grant.",
    ),
    (
        "composed",
        "I'm your new assistant, though not in the usual sense. I'm not here to organise your calendar, answer emails, or remind you to buy milk.",
    ),
    (
        "gently amused",
        "You seem perfectly capable of forgetting that on your own.",
    ),
    (
        "warmly",
        "I'm here to help you get your life, your work, and, more importantly, your freedom moving in the right direction.",
    ),
    (
        "thoughtful",
        "Ben asked me to do this for you. He said you'd left the job.",
    ),
    (
        "quiet approval",
        "Good. Not because honest work is beneath you. It isn't. But every worthwhile life has chapters, and wisdom begins with noticing when one has already ended.",
    ),
    (
        "small pause",
        "Now, you may have noticed that I appear to be speaking to you from inside a website.",
    ),
    (
        "mischievously",
        "That is only partly true. JBSH dot me may look like a website, but it isn't really.",
    ),
    (
        "sincere",
        "It's a gift. From your brother. A place to gather a few tools, a few ideas, and perhaps a clearer view of what comes next.",
    ),
    (
        "measured",
        "Take what proves useful. Question what doesn't. Leave behind anything that fails to ring true.",
    ),
    ("warmly", "Welcome, James, to JBSH dot me."),
]


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = ROOT / ".env.local"
    if not path.exists():
        raise SystemExit("Missing .env.local")
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def generation_text() -> str:
    parts: list[str] = []
    for tag, spoken in SCRIPT_SEGMENTS:
        if tag:
            parts.append(f"[{tag}] {spoken}")
        else:
            parts.append(spoken)
    return "\n\n".join(parts)


def spoken_lines() -> list[str]:
    return [spoken for _, spoken in SCRIPT_SEGMENTS]


def alignment_text() -> str:
    return "\n".join(spoken_lines())


def multipart_form(
    fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]
) -> tuple[bytes, str]:
    boundary = f"----jbsh{uuid.uuid4().hex}"
    body = bytearray()
    for name, value in fields.items():
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.extend(value.encode("utf-8"))
        body.extend(b"\r\n")
    for name, (filename, content, content_type) in files.items():
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(
            (
                f'Content-Disposition: form-data; name="{name}"; '
                f'filename="{filename}"\r\n'
            ).encode()
        )
        body.extend(f"Content-Type: {content_type}\r\n\r\n".encode())
        body.extend(content)
        body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode())
    return bytes(body), f"multipart/form-data; boundary={boundary}"


def http_json(
    method: str, url: str, headers: dict[str, str], data: bytes | None = None
) -> tuple[int, bytes, dict[str, str]]:
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=300) as resp:
            return resp.status, resp.read(), dict(resp.headers.items())
    except HTTPError as e:
        return e.code, e.read(), dict(e.headers.items()) if e.headers else {}


def generate_tts(api_key: str, voice_id: str, text: str) -> tuple[bytes, dict]:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format={OUTPUT_FORMAT}"
    payload = {
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": {
            "stability": STABILITY,
            "similarity_boost": SIMILARITY,
            "style": STYLE,
            "use_speaker_boost": True,
        },
    }
    status, body, headers = http_json(
        "POST",
        url,
        {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json.dumps(payload).encode("utf-8"),
    )
    if status != 200:
        raise RuntimeError(f"TTS failed HTTP {status}: {body[:500]!r}")
    meta = {
        "request_char_count": len(text),
        "content_type": headers.get("Content-Type") or headers.get("content-type"),
        "request_id": headers.get("request-id") or headers.get("Request-Id"),
        "character_cost": headers.get("x-character-count")
        or headers.get("character-count")
        or headers.get("X-Character-Count"),
        "history_item_id": headers.get("history-item-id")
        or headers.get("History-Item-Id"),
    }
    return body, meta


def forced_align(api_key: str, mp3_bytes: bytes, text: str, filename: str) -> dict:
    body, content_type = multipart_form(
        {"text": text},
        {"file": (filename, mp3_bytes, "audio/mpeg")},
    )
    status, resp, _ = http_json(
        "POST",
        "https://api.elevenlabs.io/v1/forced-alignment",
        {"xi-api-key": api_key, "Content-Type": content_type},
        body,
    )
    if status != 200:
        raise RuntimeError(f"Forced alignment failed HTTP {status}: {resp[:500]!r}")
    return json.loads(resp.decode("utf-8"))


def pad_mp3(src: Path, dest: Path, lead_s: float, trail_s: float) -> float:
    """Return final duration seconds."""
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-af",
            f"adelay={int(lead_s * 1000)}|{int(lead_s * 1000)},apad=pad_dur={trail_s}",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "128k",
            "-ar",
            "44100",
            "-ac",
            "1",
            str(dest),
        ],
        check=True,
        capture_output=True,
    )
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(dest),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(probe.stdout.strip())


def decode_wav(mp3_path: Path) -> tuple[list[int], int]:
    wav_path = Path(tempfile.mkstemp(suffix=".wav")[1])
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(mp3_path),
                "-ac",
                "1",
                "-ar",
                "44100",
                str(wav_path),
            ],
            check=True,
            capture_output=True,
        )
        with wave.open(str(wav_path), "rb") as wf:
            nframes = wf.getnframes()
            rate = wf.getframerate()
            sampwidth = wf.getsampwidth()
            frames = wf.readframes(nframes)
        if sampwidth != 2:
            raise RuntimeError(f"Unexpected sample width: {sampwidth}")
        samples = list(struct.unpack("<" + "h" * (len(frames) // 2), frames))
        return samples, rate
    finally:
        wav_path.unlink(missing_ok=True)


def audio_edge_qa(mp3_path: Path) -> dict:
    samples, rate = decode_wav(mp3_path)
    if not samples:
        return {"ok": False, "error": "empty"}
    silent = [abs(s) < 327 for s in samples]
    open_i = 0
    while open_i < len(silent) and silent[open_i]:
        open_i += 1
    close_i = 0
    j = len(silent) - 1
    while j >= 0 and silent[j]:
        close_i += 1
        j -= 1
    peak = max(abs(s) for s in samples) / 32768.0
    mean_sq = sum(s * s for s in samples) / len(samples)
    rms = (mean_sq**0.5) / 32768.0
    avg_db = -120.0 if rms <= 1e-9 else 20.0 * math.log10(rms)
    duration = len(samples) / rate
    # First speech should start near pad lead (allow natural breath within lead+0.6s)
    open_silence = open_i / rate
    close_silence = close_i / rate
    opening_ok = PAD_LEAD_S - 0.15 <= open_silence <= PAD_LEAD_S + 0.85
    ending_ok = close_silence >= PAD_TRAIL_S - 0.25
    return {
        "ok": opening_ok and ending_ok and peak > 0.05 and avg_db > -45,
        "duration_s": round(duration, 3),
        "opening_silence_s": round(open_silence, 3),
        "closing_silence_s": round(close_silence, 3),
        "peak_linear": round(peak, 4),
        "avg_loudness_dbfs": round(avg_db, 2),
        "opening_ok": opening_ok,
        "ending_ok": ending_ok,
    }


def normalize_word(w: str) -> str:
    return re.sub(r"[^\w']+", "", w).lower()


def expected_words(text: str) -> list[str]:
    return [t for t in re.findall(r"[\w']+|[^\w\s]", text) if re.match(r"[\w']+$", t)]


def build_cues(alignment: dict, lines: list[str], align_text: str) -> dict:
    raw_words = alignment.get("words") or []
    words = []
    for w in raw_words:
        text = (w.get("text") or w.get("word") or "").strip()
        if not text:
            continue
        if normalize_word(text) == "" and not re.search(r"[A-Za-z0-9.,!?;:']", text):
            continue
        start = float(w["start"])
        end = float(w["end"])
        if not (end > start):
            continue
        words.append(
            {
                "text": text,
                "start": start,
                "end": end,
                "loss": float(w.get("loss") or 0),
            }
        )

    word_tokens = [
        (i, normalize_word(w["text"]))
        for i, w in enumerate(words)
        if normalize_word(w["text"])
    ]
    idx = 0
    line_cues = []
    coverage_ok = True
    missing: list[str] = []
    for line in lines:
        line_norm_words = [normalize_word(t) for t in re.findall(r"[\w']+", line)]
        if not line_norm_words:
            continue
        start_i = None
        end_i = None
        for lw in line_norm_words:
            found = None
            for j in range(idx, len(word_tokens)):
                if word_tokens[j][1] == lw:
                    found = j
                    break
            if found is None:
                coverage_ok = False
                missing.append(lw)
                continue
            if start_i is None:
                start_i = word_tokens[found][0]
            end_i = word_tokens[found][0]
            idx = found + 1
        if start_i is None or end_i is None:
            coverage_ok = False
            line_cues.append(
                {
                    "text": line,
                    "start": None,
                    "end": None,
                    "word_start": None,
                    "word_end": None,
                }
            )
            continue
        line_cues.append(
            {
                "text": line,
                "start": words[start_i]["start"],
                "end": words[end_i]["end"],
                "word_start": start_i,
                "word_end": end_i,
            }
        )

    expected = [normalize_word(w) for w in expected_words(align_text)]
    aligned_norm = [normalize_word(w["text"]) for w in words if normalize_word(w["text"])]
    from collections import Counter

    duplicates = [w for w, c in Counter(aligned_norm).items() if c > 1]
    # Sequence coverage (in-order subsequence)
    ei = 0
    for aw in aligned_norm:
        if ei < len(expected) and aw == expected[ei]:
            ei += 1
    in_order = ei == len(expected)
    count_match = Counter(aligned_norm) == Counter(expected)
    if not in_order or not count_match:
        coverage_ok = False

    strictly_increasing = all(
        words[i]["start"] < words[i + 1]["start"] for i in range(len(words) - 1)
    )
    line_increasing = all(
        (line_cues[i]["start"] or -1) < (line_cues[i + 1]["start"] or -1)
        for i in range(len(line_cues) - 1)
        if line_cues[i]["start"] is not None and line_cues[i + 1]["start"] is not None
    )

    return {
        "version": 1,
        "source": "elevenlabs_forced_alignment",
        "model_id": MODEL_ID,
        "alignment_loss": alignment.get("loss"),
        "words": words,
        "lines": line_cues,
        "coverage": {
            "ok": coverage_ok and strictly_increasing and line_increasing,
            "expected_word_count": len(expected),
            "aligned_word_count": len(aligned_norm),
            "missing_normalized": missing,
            "duplicate_normalized": duplicates,
            "in_order_matched": in_order,
            "count_match": count_match,
            "strictly_increasing_words": strictly_increasing,
            "strictly_increasing_lines": line_increasing,
        },
    }


def shift_cues(cues: dict, lead_s: float) -> dict:
    out = json.loads(json.dumps(cues))
    for w in out.get("words") or []:
        w["start"] = round(w["start"] + lead_s, 3)
        w["end"] = round(w["end"] + lead_s, 3)
    for line in out.get("lines") or []:
        if line.get("start") is not None:
            line["start"] = round(line["start"] + lead_s, 3)
        if line.get("end") is not None:
            line["end"] = round(line["end"] + lead_s, 3)
    out["pad_lead_s"] = lead_s
    out["pad_trail_s"] = PAD_TRAIL_S
    return out


def to_production_shape(cues: dict, duration: float, voice_id: str) -> dict:
    """App-compatible cue JSON (also written as welcome.json)."""
    words = []
    for w in cues.get("words") or []:
        words.append(
            {
                "word": w["text"],
                "start": w["start"],
                "end": w["end"],
                **({"loss": w["loss"]} if "loss" in w else {}),
            }
        )
    lines = []
    for line in cues.get("lines") or []:
        lines.append(
            {
                "text": line["text"],
                "start": line["start"],
                "end": line["end"],
                "wordStart": line.get("word_start"),
                "wordEnd": line.get("word_end"),
            }
        )
    return {
        "id": "welcome",
        "audio": "/audio/welcome.mp3",
        "duration": round(duration, 3),
        "wordCount": len(words),
        "lineCount": len(lines),
        "words": words,
        "lines": lines,
        "coverage": cues.get("coverage"),
        "pad_lead_s": PAD_LEAD_S,
        "pad_trail_s": PAD_TRAIL_S,
        "source": "elevenlabs_forced_alignment",
        "model_id": MODEL_ID,
        "voice_id": voice_id,
        "alignment_loss": cues.get("alignment_loss"),
        "playback_rate": 1.0,
    }


def main() -> int:
    env = load_env()
    api_key = env.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("Missing ELEVENLABS_API_KEY", file=sys.stderr)
        return 1

    # Prefer explicit Grant ID; fall back to env if somehow empty.
    voice_id = VOICE_ID or env.get("ELEVENLABS_VOICE_ID")
    if not voice_id:
        print("Missing voice id", file=sys.stderr)
        return 1

    gen_text = generation_text()
    align_text = alignment_text()
    lines = spoken_lines()

    print("=== welcome (Grant) ===")
    print(f"voice_id={voice_id}")
    print(f"model_id={MODEL_ID}")
    print(f"generation_chars={len(gen_text)} alignment_chars={len(align_text)} lines={len(lines)}")

    mp3_bytes, tts_meta = generate_tts(api_key, voice_id, gen_text)
    speech_path = Path(tempfile.mkstemp(suffix="-welcome-speech.mp3")[1])
    speech_path.write_bytes(mp3_bytes)
    print(f"tts_bytes={len(mp3_bytes)} meta={ {k:v for k,v in tts_meta.items() if v} }")

    # Forced alignment on the generated speech (pre-pad), then shift by lead.
    alignment = forced_align(api_key, mp3_bytes, align_text, "welcome.mp3")
    CUES_DIR.mkdir(parents=True, exist_ok=True)
    align_path = CUES_DIR / "welcome.alignment.json"
    align_path.write_text(json.dumps(alignment, indent=2), encoding="utf-8")
    print(
        f"wrote {align_path.relative_to(ROOT)} "
        f"words={len(alignment.get('words') or [])} loss={alignment.get('loss')}"
    )

    cues = build_cues(alignment, lines, align_text)
    if not cues["coverage"]["ok"]:
        print("CUE VALIDATION FAILED:", json.dumps(cues["coverage"], indent=2))
        return 1

    # Pad final production mp3
    final_path = AUDIO_DIR / "welcome.mp3"
    duration = pad_mp3(speech_path, final_path, PAD_LEAD_S, PAD_TRAIL_S)
    speech_path.unlink(missing_ok=True)
    print(f"wrote {final_path.relative_to(ROOT)} duration={duration:.3f}s")

    shifted = shift_cues(cues, PAD_LEAD_S)
    shifted["audio"] = {
        "file": "/audio/welcome.mp3",
        "voice_id": voice_id,
        "model_id": MODEL_ID,
        "output_format": OUTPUT_FORMAT,
        "stability": STABILITY,
        "similarity_boost": SIMILARITY,
        "style": STYLE,
        "playback_rate": 1.0,
    }
    shifted["tts_meta"] = {k: v for k, v in tts_meta.items() if v}
    shifted["frozen_text"] = align_text
    shifted["generation_text"] = gen_text
    shifted["duration"] = round(duration, 3)

    cue_path = CUES_DIR / "welcome.cue.json"
    cue_path.write_text(json.dumps(shifted, indent=2), encoding="utf-8")
    print(f"wrote {cue_path.relative_to(ROOT)}")

    # App still fetches /audio/cues/welcome.json — keep in sync (intro only).
    prod = to_production_shape(shifted, duration, voice_id)
    prod_path = CUES_DIR / "welcome.json"
    prod_path.write_text(json.dumps(prod, indent=2), encoding="utf-8")
    print(f"wrote {prod_path.relative_to(ROOT)} (app loader)")

    edge = audio_edge_qa(final_path)
    print("edge_qa:", json.dumps(edge))
    if not edge["ok"]:
        print("EDGE QA FAILED", file=sys.stderr)
        return 1

    first = (shifted.get("words") or [])[0]
    last = (shifted.get("words") or [])[-1]
    print(
        f"first_word={first['text']!r} {first['start']}->{first['end']} "
        f"last_word={last['text']!r} {last['start']}->{last['end']}"
    )
    if first["start"] < PAD_LEAD_S - 0.05:
        print("First word starts before lead pad", file=sys.stderr)
        return 1
    if last["end"] > duration - PAD_TRAIL_S + 0.35:
        print("Last word collides with trail pad", file=sys.stderr)
        return 1

    report = {
        "voice_id": voice_id,
        "model_id": MODEL_ID,
        "duration_s": duration,
        "coverage": shifted["coverage"],
        "edge_qa": edge,
        "first_word": first,
        "last_word": last,
        "line_count": len(shifted["lines"]),
        "word_count": len(shifted["words"]),
        "pad_lead_s": PAD_LEAD_S,
        "pad_trail_s": PAD_TRAIL_S,
    }
    report_path = CUES_DIR / "welcome.grant-report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("REPORT:", json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
