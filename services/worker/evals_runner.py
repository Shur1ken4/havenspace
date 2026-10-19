"""`npm run eval` — runs the agent pipeline on the role-play sessions in
evals/sessions/ and writes a side-by-side HTML report to evals/reports/ for the
Clinical Lead to rate (1–5 per item). Also runs automated checks:

  - every output matched its schema (otherwise the run errors)
  - every reflection item has valid evidence (segment + exact quote)
  - no forbidden diagnosis / risk-rating language in notes or reflections
  - the output is in the expected language

Role-play / synthetic data only. Uses the provider in .env (LLM_PROVIDER).
"""
from __future__ import annotations

import html
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from worker import config
from worker.agent import guardrails, steps
from worker.agent.prompts import combined_version
from worker.agent.providers import get_provider
from worker.pipeline import _pack

EVALS = config.REPO_ROOT / "evals"


def _context(session: dict, language: str) -> steps.SessionContext:
    t = 0
    segs = []
    for s in session["segments"]:
        dur = max(2000, len(s["text"].split()) * 380)
        segs.append({"idx": s["idx"], "speaker": s["speaker"], "start_ms": t, "end_ms": t + dur, "text": s["text"]})
        t += dur + 800
    return steps.SessionContext(segments=segs, note_format=session.get("note_format", "SOAP"), language=language,
                                client_label=session.get("client_label", "the client"))


def _language_ok(text: str, language: str) -> bool:
    letters = re.findall(r"[A-Za-zА-Яа-яЁё]", text)
    if not letters:
        return True
    cyr = sum(1 for c in letters if re.match(r"[А-Яа-яЁё]", c)) / len(letters)
    return cyr > 0.6 if language == "ru" else cyr < 0.2


def run(language: str = "en") -> Path:
    provider = get_provider()
    results = []
    for path in sorted((EVALS / "sessions").glob("*.json")):
        session = json.loads(path.read_text())
        ctx = _context(session, language)
        started = time.time()
        note = steps.draft_note(provider, ctx)
        pack = _pack(session.get("modality", "general"))
        reflection, dropped = steps.reflect(provider, ctx, pack)
        timeline, _ = steps.update_timeline(provider, ctx)
        note_text = "\n".join(s.text for s in note.sections)
        refl_text = " ".join(i.text for i in reflection.strengths + reflection.missed_openings + reflection.try_next)
        checks = {
            "Evidence: every reflection point is linked to a real quote": dropped == 0,
            "Reflection has 3 strengths, 2 openings, 1 thing to try": (len(reflection.strengths), len(reflection.missed_openings), len(reflection.try_next)) == (3, 2, 1),
            "No diagnosis or risk-rating language": not guardrails.hits(note_text + " " + refl_text),
            f"Written in {steps.LANGUAGE_NAMES[language]}": provider.is_demo or (_language_ok(note_text, language) and _language_ok(refl_text, language)),
        }
        results.append({"session": session, "note": note, "reflection": reflection, "timeline": timeline, "pack": pack,
                        "checks": checks, "dropped": dropped, "seconds": round(time.time() - started, 1)})
        print(f"{session['id']}: {'all checks passed' if all(checks.values()) else 'CHECKS FAILED'} ({results[-1]['seconds']}s)")

    out_dir = EVALS / "reports"
    out_dir.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M")
    out = out_dir / f"eval-{stamp}-{provider.name}-{language}.html"
    out.write_text(_report(results, provider.model_id(config.LLM_MODEL), language), encoding="utf-8")
    return out


def _e(s: str) -> str:
    return html.escape(s or "")


def _report(results: list[dict], model: str, language: str) -> str:
    version = combined_version("draft_note", "reflect")
    cards = []
    for r in results:
        s = r["session"]
        sid = s["id"]
        expert = s.get("expert_reflection", {})
        transcript = "".join(f"<li><b>[{x['idx']}] {_e(x['speaker'])}:</b> {_e(x['text'])}</li>" for x in s["segments"])
        note = "".join(f"<h4>{_e(sec.key)}</h4><p>{_e(sec.text)}</p>" for sec in r["note"].sections)
        facts = "".join(f"<li>{_e(f)}</li>" for f in s.get("expected_note_facts", []))

        def rate(key: str) -> str:
            name = f"{sid}::{key}"
            return "<span class='rate' data-key='" + _e(name) + "'>" + "".join(
                f"<label><input type='radio' name='{_e(name)}' value='{n}'>{n}</label>" for n in range(1, 6)) + "</span>"

        def items(kind: str, title: str) -> str:
            ai = getattr(r["reflection"], kind)
            exp = expert.get(kind, [])
            rows = "".join(
                f"<tr><td>{_e(it.text)}<div class='q'>“{_e(it.quote)}” — segments {it.segment_ids}</div></td>"
                f"<td>{_e(exp[i]) if i < len(exp) else ''}</td><td>{rate(f'{kind}{i}')}</td></tr>"
                for i, it in enumerate(ai))
            return f"<h4>{title}</h4><table><tr><th>AI</th><th>Expert draft</th><th>Rating</th></tr>{rows}</table>"

        rubric = "".join(f"<tr><td>{_e(x.dimension_id)}</td><td>{x.score}</td><td>{_e(x.rationale)}</td></tr>" for x in r["reflection"].rubric)
        checks = "".join(f"<li class='{'ok' if v else 'bad'}'>{'✓' if v else '✗'} {_e(k)}</li>" for k, v in r["checks"].items())
        timeline = ", ".join(_e(t.text) for t in r["timeline"].themes + r["timeline"].goals + r["timeline"].homework)
        cards.append(f"""
<section class="card">
  <h2>{_e(s['title'])}</h2>
  <p class="muted">{_e(s.get('review', ''))}</p>
  <ul class="checks">{checks}</ul>
  <details><summary>Transcript ({len(s['segments'])} segments)</summary><ol class="tr">{transcript}</ol></details>
  <div class="grid">
    <div><h3>AI note ({_e(s.get('note_format', ''))})</h3>{note}<p>Overall note quality: {rate('note')}</p></div>
    <div><h3>Facts the note should contain</h3><ul>{facts}</ul>
      <p>Facts covered: {rate('facts')}</p>
      {('<p><b>Must not contain:</b> ' + _e('; '.join(s['must_not'])) + '</p>') if s.get('must_not') else ''}</div>
  </div>
  <h3>Reflection ({_e(r['pack']['name'])})</h3>
  {items('strengths', 'Things done well')}
  {items('missed_openings', 'Openings to revisit')}
  {items('try_next', 'One thing to try')}
  <details><summary>Rubric scores</summary><table><tr><th>Dimension</th><th>Score</th><th>Rationale</th></tr>{rubric}</table></details>
  <p><b>Timeline items:</b> {timeline or '—'}</p>
  <p>Comments: <textarea data-key="{_e(sid)}::comment"></textarea></p>
</section>""")
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CouchNote eval report</title>
<style>
:root{{--bg:#FAF8F5;--surface:#fff;--ink:#2F3A35;--muted:#66726B;--primary:#4F7361;--soft:#E6EEE9;--border:#E7E2DA;--bad:#B5654A}}
body{{background:var(--bg);color:var(--ink);font:16px/1.6 Inter,system-ui,sans-serif;margin:0;padding:24px 16px}}
main{{max-width:1100px;margin:auto}} h1,h2,h3{{font-family:Georgia,serif;font-weight:400}}
.card{{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;margin:24px 0}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:24px}} @media(max-width:800px){{.grid{{grid-template-columns:1fr}}}}
table{{width:100%;border-collapse:collapse;margin:8px 0}} td,th{{border-top:1px solid var(--border);padding:8px;vertical-align:top;text-align:left}}
.q{{color:var(--muted);font-size:14px;margin-top:4px}} .muted{{color:var(--muted)}} .checks{{list-style:none;padding:0}}
.ok{{color:var(--primary)}} .bad{{color:var(--bad);font-weight:600}} .rate label{{margin-right:6px;white-space:nowrap}}
textarea{{width:100%;min-height:60px;border:1px solid var(--border);border-radius:10px;padding:8px}}
button{{background:var(--primary);color:#fff;border:0;border-radius:10px;padding:10px 16px;font-size:15px;cursor:pointer}}
.tr li{{margin:4px 0}} h4{{margin:12px 0 4px;text-transform:capitalize}}
</style></head><body><main>
<h1>CouchNote — evaluation report</h1>
<p class="muted">Model: {_e(model)} · Prompts: {_e(version)} · Output language: {_e(language)} · {datetime.now():%d %b %Y %H:%M}<br>
Role-play sessions only. Rate each item 1 (poor) – 5 (excellent). Your ratings are saved in this browser; click “Download ratings” to send them back.</p>
<p><button id="dl">Download ratings</button> <span id="avg" class="muted"></span></p>
{''.join(cards)}
</main>
<script>
const KEY = "eval-ratings:" + location.pathname;
let saved = {{}}; try {{ saved = JSON.parse(localStorage.getItem(KEY) || "{{}}"); }} catch (e) {{}}
const save = () => {{ try {{ localStorage.setItem(KEY, JSON.stringify(saved)); }} catch (e) {{}} showAvg(); }};
function showAvg() {{
  const nums = Object.values(saved).map(Number).filter(n => n >= 1 && n <= 5);
  document.getElementById("avg").textContent = nums.length ? `Average so far: ${{(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2)}} from ${{nums.length}} ratings` : "";
}}
document.querySelectorAll("input[type=radio]").forEach(r => {{
  if (saved[r.name] === r.value) r.checked = true;
  r.addEventListener("change", () => {{ saved[r.name] = r.value; save(); }});
}});
document.querySelectorAll("textarea").forEach(t => {{
  t.value = saved[t.dataset.key] || "";
  t.addEventListener("input", () => {{ saved[t.dataset.key] = t.value; save(); }});
}});
document.getElementById("dl").onclick = () => {{
  const blob = new Blob([JSON.stringify(saved, null, 2)], {{ type: "application/json" }});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "eval-ratings.json"; a.click();
}};
showAvg();
</script></body></html>"""


if __name__ == "__main__":
    lang = sys.argv[1] if len(sys.argv) > 1 else "en"
    print(f"Report: {run(lang)}")
