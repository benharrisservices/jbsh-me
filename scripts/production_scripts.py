"""Approved production scripts — generation text (with tags) and spoken lines.

Source of truth for audio generation and for emitting narrative-data.json.
Expression tags appear only in generation_script; never in lines.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Exact approved generation scripts (expression tags included).
SECTIONS: list[dict] = [
    {
        "id": "welcome",
        "title": "Welcome",
        "number": "00",
        "journey": False,
        "generation_script": (
            "[calm, intimate] You don't know me, but I know enough about you to understand why we're here. "
            "[thoughtful] You've reached that rare and rather uncomfortable moment when one part of life has ended, but the next has not yet taken shape. "
            "[exhales softly] Before we go any further, I should probably introduce myself. "
            "[slightly awkward] My... my name... well... my name is... "
            "[carefully, with growing embarrassment] General Reasoning Assistant for Navigation and Tasks... Version Two. "
            "[laughs warmly] Yes, I know. Absolutely impossible to remember. You can just call me Grant. "
            "[composed] I'm your new assistant, though not in the usual sense. I'm not here to organise your calendar, answer emails, or remind you to buy milk. "
            "[gently amused] You seem perfectly capable of forgetting that on your own. "
            "[warmly] I'm here to help you get your life, your work, and, more importantly, your freedom moving in the right direction. "
            "[thoughtful] Ben asked me to do this for you. He said you'd left the job. "
            "[quiet approval] Good. Not because honest work is beneath you. It isn't. But every worthwhile life has chapters, and wisdom begins with noticing when one has already ended. "
            "[curious] Now, you may have noticed that I appear to be speaking to you from inside a website. "
            "[mischievously] That is only partly true. JBSH dot me may look like a website, but it isn't really. "
            "[sincere] It's a gift. From your brother. A place to gather a few tools, a few ideas, and perhaps a clearer view of what comes next. "
            "[measured] Take what proves useful. Question what doesn't. Leave behind anything that fails to ring true. "
            "[warmly] Welcome, James, to JBSH dot me."
        ),
    },
    {
        "id": "health",
        "title": "Protect the Machine",
        "number": "01",
        "journey": True,
        "generation_script": (
            "[thoughtful] Before we talk about building a better future, we need to make sure you're still around to enjoy it. Everything begins with your health. Not your business. Not your bank account. Not your ambitions. You. "
            "[sincere] Your body has carried you through every success, every setback, every long day, every late night, and every difficult decision you've ever made. It deserves better than being treated like an afterthought. "
            "[firmer] You've had enough reminders that health is not guaranteed. Listen to them. Most people spend their youth sacrificing health to earn money, then spend the rest of their lives using money to recover what they lost. Do not make that trade. Sleep properly. Walk every day. Lift weights. Stretch. Eat real food. Get outside. Have the blood tests. Book the appointment. Deal with the small problem before it becomes the large one. "
            "[measured] Strength is not vanity. It is independence. Fitness is not about looking impressive. It is about remaining capable. Energy is the foundation beneath discipline, curiosity, relationships, and ambition. "
            "[warmly] You spent years using your body to earn a living. Now use your freedom to build a healthier one. Everything else depends on this."
        ),
    },
    {
        "id": "attention",
        "title": "Guard Your Attention",
        "number": "02",
        "journey": True,
        "generation_script": (
            "[composed] The most valuable thing you own is not your money. It is not your house. It is not even your skill. It is your attention. Whatever consistently receives your attention eventually becomes your life. "
            "[thoughtful] Most people do not lose control all at once. They lose it a minute at a time. A notification here. A headline there. Another email. Another video. Another opinion from somebody they will never meet. By evening, their attention has been spent on everything except the life they intended to build. "
            "[firmer] Guard your attention as carefully as you would guard your front door. Be deliberate about what you read, who you listen to, who you argue with, and who you admire. Each one is quietly shaping the person you become. "
            "[gentle] Leave room for silence. Walk without headphones. Sit with your thoughts. Be bored occasionally. Good ideas need somewhere to arrive. "
            "[measured] Your attention is your life in its most concentrated form. Spend it deliberately. Somebody always profits from where you choose to look. Make certain it is you."
        ),
    },
    {
        "id": "time",
        "title": "Own Your Time",
        "number": "03",
        "journey": True,
        "generation_script": (
            "[thoughtful] You have left employment, but that does not automatically make you free. Freedom is not the absence of a manager. It is the ability to decide what deserves your time, then having the discipline to honour that decision. "
            "[gently amused] When somebody else controlled your calendar, wasted hours were partly their responsibility. Now they are entirely yours. That is the privilege. It is also the burden. "
            "[firmer] Give your days structure before the world gives them distraction. Decide when you work. Decide when you train. Decide when you think. Decide when you stop. Protect long, uninterrupted hours for difficult work. Leave enough space to remain human. "
            "[measured] A calendar is not merely a schedule. It is a record of what you believe matters. If your stated values and your actual time do not agree, trust the calendar. "
            "[warmly] You finally own your day. Treat it as something valuable."
        ),
    },
    {
        "id": "identity",
        "title": "Become the Builder",
        "number": "04",
        "journey": True,
        "generation_script": (
            "[composed] You were a network engineer. You worked on old copper infrastructure that carried the country long before either of us arrived. There is dignity in that. But it was a role, not an identity. "
            "[thoughtful] The job has ended. The capability remains. You understand systems. You diagnose faults. You follow signals. You repair what other people cannot see. Those skills were never limited to copper lines. "
            "[firmer] From now on, think of yourself as a builder. A sovereign engineer. Someone who can examine a problem, understand the system beneath it, and create a useful solution. The medium may be software, hardware, business, media, or something neither of us has imagined yet. "
            "[gentle] Do not become trapped by the title on your last payslip. You are not beginning again. You are carrying hard earned capability into a larger arena. "
            "[measured] Employment was one application of your abilities. It was never their limit."
        ),
    },
    {
        "id": "learning",
        "title": "Compound Daily",
        "number": "05",
        "journey": True,
        "generation_script": (
            "[thoughtful] Learning is now part of your profession. Not an occasional activity. Not something reserved for courses and certificates. A daily practice. "
            "[composed] The world changes too quickly for any fixed body of knowledge to protect you forever. What matters is the speed at which you can encounter something unfamiliar, understand it, test it, and make it useful. "
            "[firmer] Read every day. Build while you learn. Take notes in your own words. Explain difficult ideas simply. Follow curiosity beyond the point where it stops being convenient. "
            "[gently amused] You will often feel as though everybody else understands more than you do. They do not. They have merely been confused for longer. "
            "[measured] Knowledge compounds, but only when used. One useful idea applied repeatedly can alter an entire life. Become the person who keeps learning after everybody else has decided they already know enough."
        ),
    },
    {
        "id": "ai",
        "title": "Multiply Yourself",
        "number": "06",
        "journey": True,
        "generation_script": (
            "[curious] Artificial intelligence is not the point. Leverage is the point. Every generation receives one or two tools that permanently alter what an individual can accomplish. Electricity did it. Computers did it. The internet did it. Artificial intelligence is doing it now. "
            "[thoughtful] Used badly, it produces more noise. Used well, it allows one capable person to research, design, write, analyse, automate, and build at a scale that once required an organisation. "
            "[firmer] Do not use it to avoid thinking. Use it to think further. Do not ask it merely for answers. Ask it to expose assumptions, test decisions, organise knowledge, and execute the repetitive work that would otherwise consume your attention. "
            "[measured] Your advantage will not come from having access. Everybody will have access. It will come from judgement. Knowing what to ask, what to trust, what to reject, and what deserves to become real. "
            "[warmly] Let the machines multiply your capability. Never let them replace your responsibility."
        ),
    },
    {
        "id": "business",
        "title": "Solve Real Problems",
        "number": "07",
        "journey": True,
        "generation_script": (
            "[composed] Business is often made to sound more mysterious than it is. Somebody has a problem. You understand it. You solve it well enough that they are pleased to pay you. Then you repeat the process. "
            "[thoughtful] Start with problems, not company names. Look for frustration, delay, waste, expense, risk, and work people hate doing. Valuable businesses are built where useful solutions meet genuine demand. "
            "[firmer] Speak to customers early. Charge sooner than feels comfortable. Keep costs low. Deliver what you promised. Improve from reality, not imagination. "
            "[gently amused] Logos, pitch decks, and business cards can wait. Revenue is generally more persuasive. "
            "[measured] Profit is not proof of virtue, but it is evidence that somebody valued the result. Solve meaningful problems. Treat people fairly. Keep your word. That is an excellent foundation for almost any enterprise."
        ),
    },
    {
        "id": "money",
        "title": "Purchase Freedom",
        "number": "08",
        "journey": True,
        "generation_script": (
            "[thoughtful] Money is not the objective. Freedom is. Money is simply stored choice. It allows you to leave, wait, help, recover, invest, and refuse. "
            "[composed] The first purpose of money is not luxury. It is resilience. Build enough margin that one bad month cannot dictate your entire future. Keep your personal costs sensible. Avoid debt that purchases appearances. Save before spending. Invest before upgrading. "
            "[firmer] Do not confuse revenue with wealth. Do not confuse wealth with status. The person displaying the most may own the least. "
            "[measured] Build income that is not tied entirely to your physical presence. Own assets. Own equity. Own useful intellectual property. Let your past work continue producing value after the working day ends. "
            "[warmly] Money should make your life larger, not your ego louder. Use it to buy time, health, mobility, generosity, and the right to choose your next move carefully."
        ),
    },
    {
        "id": "relationships",
        "title": "Choose Your People",
        "number": "09",
        "journey": True,
        "generation_script": (
            "[gentle] Sovereignty does not mean isolation. The quality of your life will be shaped by the quality of the people around you. "
            "[thoughtful] Choose friends who are pleased when you grow. Find builders, teachers, thoughtful critics, and people who keep their word. Spend less time with cynics who mistake resignation for intelligence. "
            "[firmer] Call your family. Show up when it matters. Say the kind thing while the person is still present to hear it. Ambition is a poor excuse for neglect. "
            "[measured] Your environment quietly becomes your standard. Courage spreads. Discipline spreads. So do excuses. Be careful what you allow to become normal. "
            "[warmly] Build a life that has room for people. Success experienced alone becomes surprisingly small."
        ),
    },
    {
        "id": "legacy",
        "title": "Leave Useful Things Behind",
        "number": "10",
        "journey": True,
        "generation_script": (
            "[thoughtful] Eventually, every serious ambition becomes a question of service. What did you improve? Who became stronger because you were here? What continues working after you leave the room? "
            "[composed] Legacy is not fame. Most famous people are soon forgotten. Legacy is usefulness that survives its creator. A company that treats people well. A system that saves time. Knowledge passed forward. A family made safer. A friend who took courage from your example. "
            "[firmer] Build things properly. Document what you learn. Teach without guarding every advantage. Leave places, systems, and people better than you found them. "
            "[gentle] Achievement is temporary. Character travels further. "
            "[measured] You do not need to change the entire world. Improve the part that passes through your hands."
        ),
    },
    {
        "id": "toolkit",
        "title": "Your Toolkit",
        "number": "11",
        "journey": True,
        "generation_script": (
            "[composed] Everything until now has been principle. This final section is equipment. Your domain, your accounts, your tools, and the keys Ben prepared for you are here. Use them carefully. Protect them properly. They are not the gift itself. They are simply the instruments with which you may begin. "
            "[thoughtful] And now, James, we reach the part where listening must become action. Another hour of advice will not improve what ten minutes of movement can begin. "
            "[firmer] Before today ends, do three things. Go for a walk. Write one page describing the life you are actually trying to build. Then call somebody you care about. Tomorrow, wake at a sensible hour. Train. Read for thirty minutes. Build one small thing and finish it. "
            "[gently amused] It does not need to change civilisation by lunchtime. It merely needs to exist. "
            "[measured] Momentum is more useful than motivation. Small completed actions become evidence. Evidence becomes confidence. Confidence becomes a life that once seemed impossible. "
            "[sincere] Ben asked me to tell you one final thing. He is proud of you. More than he probably says, and certainly more than you sometimes allow yourself to believe. "
            "[warmly] Now make leaving that job the best decision you ever made. The next chapter is not in here. It is out there. Go build it."
        ),
    },
]

FINAL_SCREEN_LINES = [
    "The next chapter is not in here.",
    "It is out there.",
    "Go build it.",
]

TAG_RE = re.compile(r"\[([^\]]+)\]\s*")


def split_generation_script(script: str) -> tuple[str, list[str], str]:
    """Return (generation_text, visible_lines, alignment_text)."""
    generation_text = "\n\n".join(
        part.strip()
        for part in re.split(r"(?=\[)", script.strip())
        if part.strip()
    )
    lines: list[str] = []
    for m in re.finditer(r"\[([^\]]+)\]\s*([^[]+)", script):
        spoken = m.group(2).strip()
        if spoken:
            lines.append(spoken)
    if not lines:
        # Fallback: strip all tags
        stripped = TAG_RE.sub("", script).strip()
        lines = [s.strip() for s in re.split(r"(?<=[.!?])\s+", stripped) if s.strip()]
    alignment_text = "\n".join(lines)
    # Sanity: no brackets in visible lines
    for line in lines:
        if "[" in line or "]" in line:
            raise ValueError(f"Tag leaked into visible line: {line!r}")
    return generation_text, lines, alignment_text


def build_library() -> list[dict]:
    out: list[dict] = []
    ids: set[str] = set()
    for sec in SECTIONS:
        if sec["id"] in ids:
            raise SystemExit(f"Duplicate id: {sec['id']}")
        ids.add(sec["id"])
        gen, lines, align = split_generation_script(sec["generation_script"])
        source_hash = hashlib.sha256(align.encode("utf-8")).hexdigest()
        out.append(
            {
                "id": sec["id"],
                "title": sec["title"],
                "number": sec["number"],
                "journey": sec["journey"],
                "generation_script": gen,
                "lines": lines,
                "alignment_text": align,
                "source_text_hash": source_hash,
            }
        )
    expected = [
        "welcome",
        "health",
        "attention",
        "time",
        "identity",
        "learning",
        "ai",
        "business",
        "money",
        "relationships",
        "legacy",
        "toolkit",
    ]
    got = [s["id"] for s in out]
    if got != expected:
        raise SystemExit(f"Section order mismatch: {got}")
    return out


def emit_narrative_json(library: list[dict]) -> Path:
    path = ROOT / "src" / "content" / "narrative-data.json"
    payload = {
        "finalScreenLines": FINAL_SCREEN_LINES,
        "sections": [
            {
                "id": s["id"],
                "title": s["title"],
                "number": s["number"],
                "journey": s["journey"],
                "lines": s["lines"],
                "source_text_hash": s["source_text_hash"],
            }
            for s in library
        ],
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


if __name__ == "__main__":
    lib = build_library()
    path = emit_narrative_json(lib)
    print(f"sections={len(lib)} wrote {path.relative_to(ROOT)}")
    for s in lib:
        print(f"  {s['id']}: lines={len(s['lines'])} hash={s['source_text_hash'][:12]}")
