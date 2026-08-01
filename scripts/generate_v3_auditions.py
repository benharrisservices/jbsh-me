#!/usr/bin/env python3
"""One-off: generate three Eleven v3 Harriet auditions + Forced Alignment cues.

Does not touch production /public/audio/*.mp3.
Does not commit. Does not print secrets.
"""

from __future__ import annotations

import json
import mimetypes
import os
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
OUT = ROOT / "public" / "audio" / "auditions" / "v3"
MODEL_ID = "eleven_v3"
OUTPUT_FORMAT = "mp3_44100_128"
# Natural (0.5) is the production-stable v3 setting for continuous story voice.
STABILITY = 0.5
SIMILARITY = 0.8
STYLE = 0.0


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


def pause_tag(marker: str) -> str:
    m = marker.lower()
    if "1.5" in m or "long" in m:
        return "[long pause]"
    if "half" in m or "short" in m:
        return "[short pause]"
    return "[pause]"


def script_to_generation_text(lines: list[str]) -> str:
    """Frozen wording + v3 pause tags. Tags are not spoken words."""
    parts: list[str] = []
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if line.startswith("[pause"):
            parts.append(pause_tag(line))
            continue
        parts.append(line)
    # Paragraph breaks encourage breath; tags keep intentional pauses.
    return "\n\n".join(parts)


def script_to_alignment_text(lines: list[str]) -> str:
    """Exact frozen spoken text only — no pause markers, no stage directions."""
    spoken = [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("[")]
    return "\n".join(spoken)


def script_lines(lines: list[str]) -> list[str]:
    return [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("[")]


# Frozen audition texts. Pause markers map to v3 tags for generation only.
AUDITIONS: dict[str, dict] = {
    "welcome": {
        "lines": [
            "Hello James.",
            "[pause · 1 beat]",
            "If you're seeing this,",
            "your brother believes something about you.",
            "[pause · 1 beat]",
            "That you were never meant for an ordinary life.",
            "[pause · 1.5 beats]",
            "This is not really a website.",
            "It's a gift.",
            "A few keys.",
            "A few ideas.",
            "[pause · 1 beat]",
            "A reminder that the future belongs to people willing to build it.",
            "[pause · 1.5 beats]",
            "Welcome.",
        ],
    },
    "freedom": {
        # Representative excerpt: short-line argument + landing.
        "lines": [
            "Freedom is not a yacht.",
            "It is not a postcode.",
            "It is your time.",
            "Belonging to you.",
            "[pause · 1 beat]",
            "Comfort is not the same thing.",
            "A salary feels safe.",
            "Safe is not free.",
            "[pause · 1 beat]",
            "Freedom is built slowly.",
            "Skill by skill.",
            "[pause · half beat]",
            "You are already facing the right way.",
        ],
    },
    "letter-ending": {
        # Closing portion of the Final Letter (not the visual closing screen).
        "lines": [
            "Time is the one thing you cannot earn back. Spend it like you mean it.",
            "[pause · 1.5 beats]",
            "I built this because I believe in you. The real you. Not the tidy version.",
            "[pause · 1 beat]",
            "Start.",
            "[pause · 1.5 beats]",
            "Love,",
            "Ben",
        ],
    },
}


def multipart_form(fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]) -> tuple[bytes, str]:
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


def http_json(method: str, url: str, headers: dict[str, str], data: bytes | None = None) -> tuple[int, bytes, dict[str, str]]:
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=180) as resp:
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
        raise RuntimeError(f"TTS failed HTTP {status}: {body[:400]!r}")
    meta = {
        "request_char_count": len(text),
        "content_type": headers.get("Content-Type") or headers.get("content-type"),
        "request_id": headers.get("request-id") or headers.get("Request-Id"),
        "character_cost": headers.get("x-character-count")
        or headers.get("character-count")
        or headers.get("X-Character-Count"),
        "history_item_id": headers.get("history-item-id") or headers.get("History-Item-Id"),
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


def decode_to_wav(mp3_path: Path) -> Path:
    wav_path = Path(tempfile.mkstemp(suffix=".wav")[1])
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
    return wav_path


def audio_validation(mp3_path: Path) -> dict:
    # Probe metadata
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=sample_rate,bit_rate,codec_name,channels,duration",
            "-show_entries",
            "format=duration,bit_rate",
            "-of",
            "json",
            str(mp3_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    meta = json.loads(probe.stdout)
    stream = (meta.get("streams") or [{}])[0]
    fmt = meta.get("format") or {}

    wav_path = decode_to_wav(mp3_path)
    try:
        with wave.open(str(wav_path), "rb") as wf:
            nframes = wf.getnframes()
            rate = wf.getframerate()
            sampwidth = wf.getsampwidth()
            frames = wf.readframes(nframes)
        if sampwidth != 2:
            raise RuntimeError(f"Unexpected sample width: {sampwidth}")
        samples = struct.unpack("<" + "h" * (len(frames) // 2), frames)
        if not samples:
            return {"has_speech": False, "error": "empty audio"}

        max_abs = max(abs(s) for s in samples)
        peak = max_abs / 32768.0
        # RMS loudness in dBFS
        mean_sq = sum(s * s for s in samples) / len(samples)
        rms = (mean_sq**0.5) / 32768.0
        avg_db = -120.0 if rms <= 1e-9 else 20.0 * __import__("math").log10(rms)
        peak_db = -120.0 if peak <= 1e-9 else 20.0 * __import__("math").log10(peak)
        clipped = sum(1 for s in samples if abs(s) >= 32767) / len(samples)

        # Silence thresholds: |sample| < 0.01 of full scale
        silent = [abs(s) < 327 for s in samples]
        # Opening silence until first non-silent
        open_i = 0
        while open_i < len(silent) and silent[open_i]:
            open_i += 1
        close_i = 0
        j = len(silent) - 1
        while j >= 0 and silent[j]:
            close_i += 1
            j -= 1
        open_silence = open_i / rate
        close_silence = close_i / rate
        duration = nframes / rate

        # Speech = sufficient RMS energy and peak
        has_speech = peak > 0.05 and avg_db > -45

        return {
            "has_speech": has_speech,
            "duration_s": round(duration, 3),
            "sample_rate": int(stream.get("sample_rate") or rate),
            "channels": int(stream.get("channels") or 1),
            "codec": stream.get("codec_name"),
            "bitrate": int(stream.get("bit_rate") or fmt.get("bit_rate") or 0),
            "peak_linear": round(peak, 4),
            "peak_dbfs": round(peak_db, 2),
            "avg_loudness_dbfs": round(avg_db, 2),
            "clipping_ratio": round(clipped, 6),
            "opening_silence_s": round(open_silence, 3),
            "closing_silence_s": round(close_silence, 3),
            "playback_ok": mp3_path.stat().st_size > 1000 and has_speech,
        }
    finally:
        wav_path.unlink(missing_ok=True)


def normalize_word(w: str) -> str:
    return re.sub(r"[^\w']+", "", w).lower()


def expected_words(alignment_text: str) -> list[str]:
    words: list[str] = []
    for token in re.findall(r"[\w']+|[^\w\s]", alignment_text):
        if re.match(r"[\w']+$", token):
            words.append(token)
    return words


def build_cues(alignment: dict, lines: list[str], alignment_text: str) -> dict:
    raw_words = alignment.get("words") or []
    words = []
    for w in raw_words:
        text = (w.get("text") or "").strip()
        if not text or text.isspace():
            continue
        # Skip pure whitespace tokens from aligner
        if normalize_word(text) == "" and not re.search(r"[A-Za-z0-9]", text):
            # Keep punctuation-only only if it matters; skip blank
            if not re.search(r"[A-Za-z0-9.,!?;:']", text):
                continue
        words.append(
            {
                "text": text,
                "start": float(w["start"]),
                "end": float(w["end"]),
                "loss": float(w.get("loss") or 0),
            }
        )

    # Build line cues by matching frozen lines against consecutive word stream
    spoken_lines = lines
    word_tokens = [(i, normalize_word(w["text"])) for i, w in enumerate(words) if normalize_word(w["text"])]
    idx = 0
    line_cues = []
    coverage_ok = True
    missing: list[str] = []
    for line in spoken_lines:
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
            line_cues.append({"text": line, "start": None, "end": None, "word_start": None, "word_end": None})
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

    expected = [normalize_word(w) for w in expected_words(alignment_text)]
    aligned_norm = [normalize_word(w["text"]) for w in words if normalize_word(w["text"])]
    # Compare sequences for reordering / missing
    reordered = False
    ei = 0
    for aw in aligned_norm:
        if ei < len(expected) and aw == expected[ei]:
            ei += 1
    sequence_match = ei == len(expected) and len(aligned_norm) == len(expected)
    if not sequence_match:
        # Allow aligner to attach punctuation as separate tokens by comparing word-only lists
        if aligned_norm != expected:
            # longest common sense: missing if not all expected present in order
            ei = 0
            for aw in aligned_norm:
                if ei < len(expected) and aw == expected[ei]:
                    ei += 1
            coverage_ok = coverage_ok and (ei == len(expected))
            if len(aligned_norm) != len(expected):
                # length mismatch with in-order coverage may still be ok if punctuation split
                pass
            # detect reorder: all present but not subsequence
            from collections import Counter

            if Counter(aligned_norm) != Counter(expected):
                coverage_ok = False
            elif ei != len(expected):
                reordered = True
                coverage_ok = False

    return {
        "version": 1,
        "source": "elevenlabs_forced_alignment",
        "model_id": MODEL_ID,
        "alignment_loss": alignment.get("loss"),
        "words": words,
        "lines": line_cues,
        "coverage": {
            "ok": coverage_ok and not reordered,
            "expected_word_count": len(expected),
            "aligned_word_count": len(aligned_norm),
            "missing_normalized": missing,
            "reordered": reordered,
            "in_order_matched": ei == len(expected),
        },
    }


def process_one(name: str, api_key: str, voice_id: str) -> dict:
    spec = AUDITIONS[name]
    lines = script_lines(spec["lines"])
    gen_text = script_to_generation_text(spec["lines"])
    align_text = script_to_alignment_text(spec["lines"])

    print(f"\n=== {name} ===")
    print(f"generation_chars={len(gen_text)} alignment_chars={len(align_text)}")

    mp3_bytes, tts_meta = generate_tts(api_key, voice_id, gen_text)
    mp3_path = OUT / f"{name}.mp3"
    mp3_path.write_bytes(mp3_bytes)
    print(f"wrote {mp3_path.relative_to(ROOT)} bytes={len(mp3_bytes)}")

    validation = audio_validation(mp3_path)
    print("validation:", json.dumps(validation))
    if not validation.get("has_speech"):
        raise RuntimeError(f"{name}: no real speech detected")

    alignment = forced_align(api_key, mp3_bytes, align_text, f"{name}.mp3")
    align_path = OUT / f"{name}.alignment.json"
    align_path.write_text(json.dumps(alignment, indent=2), encoding="utf-8")
    print(f"wrote {align_path.relative_to(ROOT)} words={len(alignment.get('words') or [])} loss={alignment.get('loss')}")

    cues = build_cues(alignment, lines, align_text)
    cues["audio"] = {
        "file": f"/audio/auditions/v3/{name}.mp3",
        "voice_id": voice_id,
        "model_id": MODEL_ID,
        "output_format": OUTPUT_FORMAT,
        "stability": STABILITY,
        "similarity_boost": SIMILARITY,
        "style": STYLE,
    }
    cues["validation"] = validation
    cues["tts_meta"] = {k: v for k, v in tts_meta.items() if v}
    cues["frozen_text"] = align_text
    cues["generation_text"] = gen_text

    cues_path = OUT / f"{name}.cues.json"
    cues_path.write_text(json.dumps(cues, indent=2), encoding="utf-8")
    print(
        f"wrote {cues_path.relative_to(ROOT)} coverage_ok={cues['coverage']['ok']} "
        f"expected={cues['coverage']['expected_word_count']} aligned={cues['coverage']['aligned_word_count']}"
    )
    return {
        "name": name,
        "validation": validation,
        "coverage": cues["coverage"],
        "alignment_loss": alignment.get("loss"),
        "tts_meta": tts_meta,
        "duration_s": validation.get("duration_s"),
    }


def main() -> int:
    env = load_env()
    api_key = env.get("ELEVENLABS_API_KEY")
    voice_id = env.get("ELEVENLABS_VOICE_ID")
    if not api_key or not voice_id:
        print("Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    # Never write credentials into outputs
    report = {
        "voice_id_prefix": voice_id[:4] + "...",
        "model_id": MODEL_ID,
        "output_format": OUTPUT_FORMAT,
        "stability": STABILITY,
        "similarity_boost": SIMILARITY,
        "style": STYLE,
        "auditions": [],
    }

    for name in ("welcome", "freedom", "letter-ending"):
        result = process_one(name, api_key, voice_id)
        report["auditions"].append(result)

    report_path = OUT / "audition-report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nReport: {report_path.relative_to(ROOT)}")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
