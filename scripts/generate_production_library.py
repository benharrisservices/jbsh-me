#!/usr/bin/env python3
"""Generate the complete Grant / eleven_v3 production narration library.

Pad + loudness-normalize BEFORE Forced Alignment so cue times match shipped MP3s.
Writes public/audio/{id}.mp3, public/audio/cues/{id}.cue.json, {id}.alignment.json.
Also emits src/content/narrative-data.json for the app.
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

from production_scripts import build_library, emit_narrative_json

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "public" / "audio"
CUES_DIR = AUDIO_DIR / "cues"

VOICE_ID = "Gsndh0O5AnuI2Hj3YUlA"
MODEL_ID = "eleven_v3"
OUTPUT_FORMAT = "mp3_44100_128"
STABILITY = 0.5
SIMILARITY = 0.8
STYLE = 0.0
PAD_LEAD_S = 1.0
PAD_TRAIL_S = 1.5
TARGET_LUFS = -16.0


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
) -> tuple[int, bytes]:
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=300) as resp:
            return resp.status, resp.read()
    except HTTPError as e:
        return e.code, e.read()


def generate_tts(api_key: str, text: str) -> bytes:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format={OUTPUT_FORMAT}"
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
    status, body = http_json(
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
        raise RuntimeError(f"TTS failed HTTP {status}: {body[:400]!r}")
    return body


def forced_align(api_key: str, mp3_bytes: bytes, text: str, filename: str) -> dict:
    body, content_type = multipart_form(
        {"text": text},
        {"file": (filename, mp3_bytes, "audio/mpeg")},
    )
    status, resp = http_json(
        "POST",
        "https://api.elevenlabs.io/v1/forced-alignment",
        {"xi-api-key": api_key, "Content-Type": content_type},
        body,
    )
    if status != 200:
        raise RuntimeError(f"Forced alignment failed HTTP {status}: {resp[:500]!r}")
    return json.loads(resp.decode("utf-8"))


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(out.stdout.strip())


def measure_loudnorm(src: Path) -> dict:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-af",
            f"loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11:print_format=json",
            "-f",
            "null",
            "-",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    # JSON is on stderr
    text = proc.stderr
    start = text.rfind("{")
    end = text.rfind("}")
    if start < 0 or end < 0:
        raise RuntimeError("loudnorm measure failed")
    return json.loads(text[start : end + 1])


def build_lead_padded_wav(speech: Path, dest_wav: Path) -> dict:
    """Loudness-normalize speech, then prepend digital lead silence."""
    measured = measure_loudnorm(speech)
    ln = (
        f"loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11:"
        f"measured_I={measured['input_i']}:"
        f"measured_TP={measured['input_tp']}:"
        f"measured_LRA={measured['input_lra']}:"
        f"measured_thresh={measured['input_thresh']}:"
        f"offset={measured['target_offset']}:"
        f"linear=true,adelay={int(PAD_LEAD_S * 1000)}|{int(PAD_LEAD_S * 1000)}"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(speech),
            "-af",
            ln,
            "-ar",
            "44100",
            "-ac",
            "1",
            str(dest_wav),
        ],
        check=True,
        capture_output=True,
    )
    return {
        "speech_input_i": float(measured["input_i"]),
        "measured": measured,
    }


def append_trail_and_encode(lead_wav: Path, dest_mp3: Path) -> float:
    """Append digital trailing silence and encode final MP3."""
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(lead_wav),
            "-af",
            f"apad=pad_dur={PAD_TRAIL_S}",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "128k",
            "-ar",
            "44100",
            "-ac",
            "1",
            str(dest_mp3),
        ],
        check=True,
        capture_output=True,
    )
    return probe_duration(dest_mp3)


def wav_to_mp3_bytes(wav: Path) -> bytes:
    mp3 = Path(tempfile.mkstemp(suffix=".mp3")[1])
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(wav),
                "-c:a",
                "libmp3lame",
                "-b:a",
                "128k",
                "-ar",
                "44100",
                "-ac",
                "1",
                str(mp3),
            ],
            check=True,
            capture_output=True,
        )
        return mp3.read_bytes()
    finally:
        mp3.unlink(missing_ok=True)


def decode_samples(mp3: Path) -> tuple[list[int], int]:
    wav = Path(tempfile.mkstemp(suffix=".wav")[1])
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(mp3), "-ac", "1", "-ar", "44100", str(wav)],
            check=True,
            capture_output=True,
        )
        with wave.open(str(wav), "rb") as wf:
            frames = wf.readframes(wf.getnframes())
            rate = wf.getframerate()
            samples = list(struct.unpack("<" + "h" * (len(frames) // 2), frames))
        return samples, rate
    finally:
        wav.unlink(missing_ok=True)


def edge_qa(mp3: Path) -> dict:
    samples, rate = decode_samples(mp3)
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
    open_s = open_i / rate
    close_s = close_i / rate
    clipped = sum(1 for s in samples if abs(s) >= 32767) / len(samples)
    return {
        "opening_silence_s": round(open_s, 3),
        "closing_silence_s": round(close_s, 3),
        "peak_linear": round(peak, 4),
        "avg_dbfs": round(avg_db, 2),
        "clipping_ratio": round(clipped, 6),
        "opening_ok": PAD_LEAD_S - 0.2 <= open_s <= PAD_LEAD_S + 0.9,
        "ending_ok": close_s >= PAD_TRAIL_S - 0.35,
        "no_clip": clipped < 0.0005,
        "has_speech": peak > 0.05 and avg_db > -45,
    }


def normalize_word(w: str) -> str:
    return re.sub(r"[^\w']+", "", w).lower()


def expected_words(text: str) -> list[str]:
    return [t for t in re.findall(r"[\w']+", text)]


def build_cues(alignment: dict, lines: list[str], align_text: str, section: dict) -> dict:
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
        words.append({"text": text, "start": start, "end": end, "loss": float(w.get("loss") or 0)})

    word_tokens = [
        (i, normalize_word(w["text"])) for i, w in enumerate(words) if normalize_word(w["text"])
    ]
    idx = 0
    line_cues = []
    missing: list[str] = []
    coverage_ok = True
    for line in lines:
        line_words = [normalize_word(t) for t in re.findall(r"[\w']+", line)]
        if not line_words:
            continue
        start_i = end_i = None
        for lw in line_words:
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

    ei = 0
    for aw in aligned_norm:
        if ei < len(expected) and aw == expected[ei]:
            ei += 1
    in_order = ei == len(expected)
    count_match = Counter(aligned_norm) == Counter(expected)
    # Accidental consecutive identical aligner glitches (same text twice)
    consecutive_dups = [
        words[i]["text"]
        for i in range(len(words) - 1)
        if normalize_word(words[i]["text"])
        and normalize_word(words[i]["text"]) == normalize_word(words[i + 1]["text"])
        and words[i]["text"] == words[i + 1]["text"]
        and words[i]["end"] >= words[i + 1]["start"] - 0.01
    ]
    # Allow intentional repeats like "my" "my" in script — only flag if not in expected consecutive
    # Soft: do not fail on legitimate repeats; rely on count_match + in_order
    strictly_inc = all(words[i]["start"] < words[i + 1]["start"] for i in range(len(words) - 1))
    line_inc = all(
        line_cues[i]["start"] < line_cues[i + 1]["start"] for i in range(len(line_cues) - 1)
    )
    no_overlap_invalid = all(
        words[i]["end"] <= words[i + 1]["end"] + 0.5 for i in range(len(words) - 1)
    )

    ok = (
        coverage_ok
        and in_order
        and count_match
        and strictly_inc
        and line_inc
        and len(line_cues) == len(lines)
        and not missing
    )

    return {
        "id": section["id"],
        "version": 1,
        "source": "elevenlabs_forced_alignment",
        "model_id": MODEL_ID,
        "voice_id": VOICE_ID,
        "playback_rate": 1.0,
        "pad_lead_s": PAD_LEAD_S,
        "pad_trail_s": PAD_TRAIL_S,
        "source_text_hash": section["source_text_hash"],
        "transcript": lines,
        "alignment_loss": alignment.get("loss"),
        "words": words,
        "lines": line_cues,
        "coverage": {
            "ok": ok,
            "expected_word_count": len(expected),
            "aligned_word_count": len(aligned_norm),
            "missing_normalized": missing,
            "in_order_matched": in_order,
            "count_match": count_match,
            "strictly_increasing_words": strictly_inc,
            "strictly_increasing_lines": line_inc,
            "no_overlap_invalid": no_overlap_invalid,
            "line_count_match": len(line_cues) == len(lines),
            "consecutive_same_tokens": consecutive_dups[:20],
        },
    }


def process_section(api_key: str, section: dict) -> dict:
    sid = section["id"]
    print(f"\n=== {sid} ===", flush=True)
    speech_path = Path(tempfile.mkstemp(suffix=f"-{sid}-speech.mp3")[1])
    lead_wav = Path(tempfile.mkstemp(suffix=f"-{sid}-lead.wav")[1])
    try:
        mp3_bytes = generate_tts(api_key, section["generation_script"])
        speech_path.write_bytes(mp3_bytes)
        print(f"tts_bytes={len(mp3_bytes)}", flush=True)

        # Lead pad BEFORE Forced Alignment so opening timestamps match the
        # shipped file. Trail pad is appended AFTER alignment so the aligner
        # cannot stretch the final word into trailing silence.
        loud_meta = build_lead_padded_wav(speech_path, lead_wav)
        lead_mp3_bytes = wav_to_mp3_bytes(lead_wav)

        alignment = forced_align(
            api_key, lead_mp3_bytes, section["alignment_text"], f"{sid}.mp3"
        )
        align_path = CUES_DIR / f"{sid}.alignment.json"
        align_path.write_text(json.dumps(alignment, indent=2), encoding="utf-8")

        final_path = AUDIO_DIR / f"{sid}.mp3"
        duration = append_trail_and_encode(lead_wav, final_path)
        final_m = measure_loudnorm(final_path)
        loud = {
            "duration_s": duration,
            "speech_input_i": loud_meta["speech_input_i"],
            "final_input_i": float(final_m["input_i"]),
            "final_input_tp": float(final_m["input_tp"]),
        }
        print(
            f"wrote {final_path.relative_to(ROOT)} duration={loud['duration_s']:.3f} "
            f"final_I={loud['final_input_i']:.2f} TP={loud['final_input_tp']:.2f}",
            flush=True,
        )

        edge = edge_qa(final_path)
        print("edge:", json.dumps(edge), flush=True)
        if not (
            edge["opening_ok"]
            and edge["ending_ok"]
            and edge["has_speech"]
            and edge["no_clip"]
        ):
            raise RuntimeError(f"{sid}: edge QA failed")

        cues = build_cues(
            alignment, section["lines"], section["alignment_text"], section
        )
        cues["audio"] = f"/audio/{sid}.mp3"
        cues["duration"] = round(loud["duration_s"], 3)
        cues["loudness"] = {
            "integrated_lufs": round(loud["final_input_i"], 2),
            "true_peak_dbtp": round(loud["final_input_tp"], 2),
        }
        cues["edge"] = edge
        cues["frozen_text"] = section["alignment_text"]
        cues["generation_text"] = section["generation_script"]

        if not cues["coverage"]["ok"]:
            print("COVERAGE FAIL:", json.dumps(cues["coverage"], indent=2), flush=True)
            raise RuntimeError(f"{sid}: cue coverage failed")

        words = cues["words"]
        if words[0]["start"] < PAD_LEAD_S - 0.15:
            raise RuntimeError(f"{sid}: first word starts before lead pad")
        if words[-1]["end"] > cues["duration"] - PAD_TRAIL_S + 0.15:
            raise RuntimeError(f"{sid}: last word collides with trail pad")
        for w in words:
            if "[" in w["text"] or "]" in w["text"]:
                raise RuntimeError(f"{sid}: tag spoken as word {w['text']!r}")

        cue_path = CUES_DIR / f"{sid}.cue.json"
        cue_path.write_text(json.dumps(cues, indent=2), encoding="utf-8")
        legacy = {
            "id": sid,
            "audio": f"/audio/{sid}.mp3",
            "duration": cues["duration"],
            "wordCount": len(words),
            "lineCount": len(cues["lines"]),
            "words": [
                {
                    "word": w["text"],
                    "start": w["start"],
                    "end": w["end"],
                    "loss": w.get("loss"),
                }
                for w in words
            ],
            "lines": [
                {
                    "text": ln["text"],
                    "start": ln["start"],
                    "end": ln["end"],
                    "wordStart": ln.get("word_start"),
                    "wordEnd": ln.get("word_end"),
                }
                for ln in cues["lines"]
            ],
            "coverage": cues["coverage"],
            "pad_lead_s": PAD_LEAD_S,
            "pad_trail_s": PAD_TRAIL_S,
            "source": "elevenlabs_forced_alignment",
            "model_id": MODEL_ID,
            "voice_id": VOICE_ID,
            "source_text_hash": section["source_text_hash"],
            "playback_rate": 1.0,
            "loudness": cues["loudness"],
        }
        (CUES_DIR / f"{sid}.json").write_text(
            json.dumps(legacy, indent=2), encoding="utf-8"
        )
        print(
            f"cues ok words={len(words)} lines={len(cues['lines'])} "
            f"first={words[0]['text']!r} last={words[-1]['text']!r}",
            flush=True,
        )
        return {
            "id": sid,
            "duration": cues["duration"],
            "coverage_ok": True,
            "edge": edge,
            "loudness": cues["loudness"],
            "word_count": len(words),
            "line_count": len(cues["lines"]),
        }
    finally:
        speech_path.unlink(missing_ok=True)
        lead_wav.unlink(missing_ok=True)


def remove_retired_assets(keep_ids: set[str]) -> None:
    for mp3 in AUDIO_DIR.glob("*.mp3"):
        if mp3.stem not in keep_ids:
            mp3.unlink()
            print(f"removed {mp3.relative_to(ROOT)}")
    for path in CUES_DIR.glob("*"):
        if not path.is_file():
            continue
        stem = path.name.split(".")[0]
        if stem not in keep_ids:
            path.unlink()
            print(f"removed {path.relative_to(ROOT)}")


def main() -> int:
    env = load_env()
    api_key = env.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("Missing ELEVENLABS_API_KEY", file=sys.stderr)
        return 1
    # Confirm env presence without printing values
    for k in ("ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL_ID"):
        if k not in env:
            print(f"Warning: {k} missing from .env.local (using approved production constants)")

    library = build_library()
    emit_narrative_json(library)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    CUES_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    for section in library:
        results.append(process_section(api_key, section))

    keep = {s["id"] for s in library}
    remove_retired_assets(keep)

    report = {
        "voice_id": VOICE_ID,
        "model_id": MODEL_ID,
        "pad_lead_s": PAD_LEAD_S,
        "pad_trail_s": PAD_TRAIL_S,
        "sections": results,
    }
    report_path = CUES_DIR / "_library-report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("\nALL SECTIONS OK")
    print(f"report={report_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
