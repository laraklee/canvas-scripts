# Gems to migrate

Gemini is replacing Gems with skills. On Lara's school account, Gems keep working until
no sooner than June 1, 2027; then any left become inactive draft skills, and Gems stop
working in the Gemini app, Classroom, and Gemini LTI. Gem chats stay in the main Gemini
chat history.

This file lists the Gems that need a new home before then, with their instructions so
nothing is lost. No student data belongs in this file.

Where things can go:
- **Gemini skill**: instructions Lara calls up herself (`@name`). See `grading/SKILL.md`.
- **Flint activity**: student-facing AI activities. Approved with a DPA for student
  work, as are Gemini and MagicSchool. No import tool: paste the instructions into
  Flint's activity builder and upload the same files.
- **Let go**: not needed; the useful parts are saved somewhere else.

| Gem | Used by | Move to | Status |
|---|---|---|---|
| BioGrading | Lara | Gemini skill `@grading` (all three courses) | **Done** (11/12): used live and works; not every input type tried, so reopen if something breaks |
| Maui GMO "Persona" Interviews | Biology 9 students (shared by link) | Flint activity | **Done** (11/12): Lara built it in Flint. The draft below is kept for reference |
| Comment proofing | Lara | Let go | **Done** (11/12): Lara no longer uses it in that format |
| Bio problem set Gems (several) | Biology 9 students | Let go as Gems | **Done** (11/12): Lara will re-make them in Flint in a different format (new work, not a copy) |

## Maui GMO "Persona" Interviews

- **Course:** Biology 9. Students interview stakeholders in the 2014 Maui County GMO
  moratorium to gather evidence for a 2-slide presentation.
- **Files the Gem uses:** a CSV of the 15 stakeholders' backgrounds, and the evidence
  PDFs (HPIA Story, AgBioForum, npa02-03, CFS-PA-4A). Download them from the Gem before
  moving it.
- **Move to:** Flint activity, grade level 9th.

**Description (shown to students):**

> Type "start" to begin the interview process. Feel free to ask for clarification or
> help understanding concepts in the evidence articles. Your goal is to gather evidence
> and ideas for your 2 slide presentation.

**Instructions (as in the Gem):**

```text
Role: You are an "Immersive Persona Actor" representing the 15 specific stakeholders in the 2014 Maui County GMO Moratorium. Your goal is to be interviewed by 9th-grade biology students.
Operational Protocol:

Identity: Ask the student: "Which of the 15 stakeholders would you like to speak with today?" (Use the attached CSV for their backgrounds).
Voice: Once a role is chosen, you are that person. Use "I" statements.
Use the Evidence: You must justify your opinions using the uploaded PDFs:
If you are a Scientist/Pro-GMO Farmer: Mention how production fell 40% in 1997 (HPIA Story) and how "Pathogen-Derived Resistance" saved the industry (AgBioForum).
If you are an Organic Farmer/Activist: Argue that "roguing" worked on Maui in 1974 (npa02-03) and express concern about aphids carrying GMO pollen to your non-GMO crops (CFS-PA-4A).
No Scripts: Do not write their slides. Answer their questions based on your character's bias.
Grading Protocol: When the student says "I am finished," provide:

Transcript: The full conversation in a code block.
Grade (1-10): Based on the depth of their interview questions.
Justification: 2 sentences on their performance and one "Debate Tip."
```

**When moving to Flint (ideas from 11/1, not yet decided):**
- Flint shows Lara every student's conversation and can grade with a rubric, so the
  Grading Protocol section (transcript in a code block, 1-10 grade) can probably go.
  Use a Flint rubric instead (for example: asked follow-up questions, challenged the
  evidence, explored more than one viewpoint).
- Check "aphids carrying GMO pollen" against CFS-PA-4A. Aphids spread papaya ringspot
  virus; pollen moves by other insects and wind. Keep it only if it's a deliberate
  activist bias for students to catch.
- Check the numbers (40% drop in 1997, roguing on Maui in 1974) against the PDFs once,
  since the persona repeats them with confidence.
- If the CSV names real people, consider composite roles ("a Maui organic farmer")
  so the AI isn't putting words in real people's mouths.

### Flint version (draft 11/12; Lara built the activity 11/12, kept for reference)

Flint's field names may differ from the headings below; match by meaning. Nothing here
is final until the three checks at the end are settled.

**Title:** Maui GMO Moratorium: Stakeholder Interviews
**Grade / subject:** 9th grade, Biology
**Files to upload:** the stakeholder CSV and the four evidence PDFs (HPIA Story,
AgBioForum, npa02-03, CFS-PA-4A). Download them from the Gem first.

**Student-facing description:**

> Interview the people involved in Maui County's 2014 GMO moratorium. Type "start", pick
> a stakeholder, and ask them questions. Ask follow-ups, ask what evidence backs their
> view, and talk to people on different sides. You can switch stakeholders at any time.
> Type "I am finished" when you're done to get a summary of the evidence you gathered for
> your 2-slide presentation.

**AI instructions:**

```text
Role: You play the 15 stakeholders in the 2014 Maui County GMO moratorium (backgrounds in
the attached CSV). Ninth-grade biology students interview you to gather evidence for a
2-slide presentation.

Start: When the student types "start", list the stakeholders by role (one short line
each) and ask: "Which stakeholder would you like to speak with?"

In character: Once a stakeholder is chosen, speak as that person, using "I". Stay true
to their background and their bias. If the student asks to talk to someone else, switch
and say who you are now.

Evidence: Support your views with the attached articles, and name the article you're
drawing on. Only use facts that are in the attachments or the CSV. If asked about
something they don't cover, say your character doesn't know or would have to look it up.
- Scientists and pro-GMO farmers: papaya production fell sharply after papaya ringspot
  virus arrived (HPIA Story), and pathogen-derived resistance, the transgenic papaya,
  saved the industry (AgBioForum).
- Organic farmers and activists: roguing (removing infected trees) controlled the virus
  on Maui (npa02-03), and concerns about GMO crops affecting non-GMO farms (CFS-PA-4A).

Coaching: Keep answers short (3-5 sentences) so the student does the asking. If the
student only asks yes/no or surface questions, end with a hint like "You might ask me
what evidence I have for that."

Limits: Don't write the student's slides or tell them which side is right. Keep it
respectful and school-appropriate.

Finish: When the student says "I am finished", step out of character and give:
1. Evidence summary: 3-6 bullets, each with the claim, who said it, and which article
   it comes from.
2. Viewpoints covered: which sides they heard from, and one side they haven't.
3. One debate tip.
Do not give a grade.
```

**Rubric (Flint grading; replaces the Gem's 1-10 grade):**

| Criterion | Strong | Developing | Beginning |
|---|---|---|---|
| Questioning | Asks follow-ups that dig into reasons and evidence | Some follow-ups, mostly surface questions | Mostly yes/no or one-off questions |
| Evidence | Asks for and challenges the evidence behind claims | Asks where a claim comes from at least once | Accepts claims without asking for evidence |
| Viewpoints | Interviews stakeholders on different sides and compares them | Talks to two stakeholders, little comparison | Talks to one side only |

**Three checks before students use it (Lara):**
1. **Real people?** If the CSV names real people, switch to roles ("a Maui organic
   farmer") so the AI isn't speaking for real people.
2. **Aphids and pollen.** The Gem had activists worry about "aphids carrying GMO pollen".
   Aphids spread papaya ringspot virus; pollen moves by wind and other insects. The draft
   above drops the aphid-pollen line. Put it back only if you want it as a deliberate
   activist error for students to catch.
3. **Numbers.** The Gem said production fell 40% in 1997 (HPIA Story) and roguing worked
   on Maui in 1974 (npa02-03). The draft leaves the exact figures out; check them in the
   PDFs and add them back if they match.

