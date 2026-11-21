# ck12-splitter

Splits a CK-12 FlexBook unit PDF into one PDF per numbered section (4.1, 4.2, ...), so
each reading can be shared or loaded into a notebook on its own. This is a local Python
script, not an Apps Script project: there is no `clasp`, no Canvas call, and no
student data.

## Run it

```bash
pip3 install --user pypdf
python3 split_sections.py "Unit 4 The Circle of Life.pdf" out
```

It prints each file it writes with its page range.

## How it finds sections

- A section starts on a page whose first line is a section number and title
  (`4.12 Mitosis`), followed within a few lines by the `FlexBooks 2.0 > ...` breadcrumb.
  The title may wrap over several lines; everything before the breadcrumb is the title.
- Page footers such as `4.12. Mitosis www.ck12.org` sometimes come out as a page's first
  line. The period after the number rules them out.
- The last section is a bare number followed by `REFERENCES`, saved as `N.x References`.
- Pages before the first section (the unit cover) are left out.
- Colons in titles become ` -` in file names (Mac and Windows don't allow colons). When
  uploading to Drive, the titles keep the original colons.

## Done (2026-11-20)

All seven units and Appendix A are split and uploaded to Drive: 133 section PDFs, one
`Unit N Sections` / `Appendix A Sections` folder per PDF, inside the folder that holds the
source PDFs. The full-textbook PDF was not split. Drive folder IDs are in the private
notes repo (`notes/ck12-splitter.md`).

To redo a unit after a new edition: download its PDF, run the script, check the printed
page ranges against the PDF, and replace the files in that unit's folder.
