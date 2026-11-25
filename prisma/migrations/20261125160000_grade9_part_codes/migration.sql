-- Grade 9 (Ganita Manjari) is two books. The relay's chapter list writes them CBG09P1C01-C08 and CBG09P2C09-C14: Part 2 keeps
-- counting from 9, it does not start again. The list here had only Part 1, as G09C01-C08. This gives Part 1 its part code and adds
-- the six Part 2 chapters with the relay's names. No journey or steward named a Grade 9 chapter. Checked against the relay, 25 Nov 2026.
UPDATE "Chapter"
SET code = 'G09P1' || substr(code, 4), part = 'Part I'
WHERE code ~ '^G09C0[1-8]$'
  AND NOT EXISTS (SELECT 1 FROM "Chapter" n WHERE n.code = 'G09P1' || substr("Chapter".code, 4));

UPDATE "WorkItem" SET "groupKey" = 'G09P1' || substr("groupKey", 4) WHERE "groupKey" ~ '^G09C0[1-8]$';

INSERT INTO "Chapter" (id, code, grade, book, part, "chapterNo", title)
VALUES
  (gen_random_uuid()::text, 'G09P2C09', 9, 'Ganita Manjari Part 2 (NCF-SE, 2026)', 'Part II', 9, 'Propositions and their Converses'),
  (gen_random_uuid()::text, 'G09P2C10', 9, 'Ganita Manjari Part 2 (NCF-SE, 2026)', 'Part II', 10, 'How Quantities Combine — Understanding Data'),
  (gen_random_uuid()::text, 'G09P2C11', 9, 'Ganita Manjari Part 2 (NCF-SE, 2026)', 'Part II', 11, 'The World of Algorithms'),
  (gen_random_uuid()::text, 'G09P2C12', 9, 'Ganita Manjari Part 2 (NCF-SE, 2026)', 'Part II', 12, 'Quadrilaterals'),
  (gen_random_uuid()::text, 'G09P2C13', 9, 'Ganita Manjari Part 2 (NCF-SE, 2026)', 'Part II', 13, 'Two Variables, One Line'),
  (gen_random_uuid()::text, 'G09P2C14', 9, 'Ganita Manjari Part 2 (NCF-SE, 2026)', 'Part II', 14, 'Math of Space — Surface Area and Volume')
ON CONFLICT (code) DO NOTHING;
