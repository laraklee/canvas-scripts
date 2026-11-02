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
| BioGrading | Lara | Gemini skill `@grading` (all three courses) | Skill created 11/1; not yet tested on an anonymized assignment |
| Maui GMO "Persona" Interviews | Biology 9 students (shared by link) | Flint activity | Not started |
| Comment proofing | Lara | Gemini skill | Not started; instructions not yet copied here |
| Bio problem set Gems (several) | Biology 9 students | Flint activities (one per problem set) | Not started; list each one and copy its instructions here |

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
