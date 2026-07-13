# Frozen Prompt — Hacker News Clone

Origin: WebDev Arena (LMArena), where this is one of the platform's canonical example prompts.
The arena blog (https://arena.ai/blog/webdev-arena/) uses the wording "Create a Hacker News clone"
as its worked example, and its most-asked-prompts table lists the same task as `Clone of Hacker News`
(rank #4, 2,740 votes). We freeze the blog's example wording verbatim; the single clause marked
`[ADAPTED]` supplies the delivery format that the arena sandbox provides implicitly (rationale +
citation trail: research/RESEARCH.md, "Adaptation note").

Run best-of-3 with this exact text. Never reword between runs or models.

---

Create a Hacker News clone. Return it as one single self-contained HTML file, using mock data (no backend). `[ADAPTED — the first sentence is the verbatim arena prompt; the second sentence replaces the WebDev Arena sandbox's implicit delivery contract (the arena renders each answer as a standalone web app for side-by-side voting), which a raw one-shot model does not otherwise know.]`

---

Note for the harness: strip the `[ADAPTED — …]` marker before sending; it is a provenance annotation, not prompt text.
