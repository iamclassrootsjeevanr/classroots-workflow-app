-- Grades 7 and 8: the chapter list used one number for the whole book (G07C01 to G07C15); the relay and every journey key name the
-- part (G07P1C03). The same chapter then had two rows: the list's row with the name, and a row the relay sync made, named by its code.
-- This renumbers the list to part codes and gives the relay's rows their names. Checked against the relay's chapter list, 25 Nov 2026.
CREATE TEMP TABLE chapter_part_map ("old" TEXT PRIMARY KEY, "new" TEXT NOT NULL, part TEXT NOT NULL, no INT NOT NULL);
INSERT INTO chapter_part_map VALUES
  ('G07C01', 'G07P1C01', 'Part I', 1),
  ('G07C02', 'G07P1C02', 'Part I', 2),
  ('G07C03', 'G07P1C03', 'Part I', 3),
  ('G07C04', 'G07P1C04', 'Part I', 4),
  ('G07C05', 'G07P1C05', 'Part I', 5),
  ('G07C06', 'G07P1C06', 'Part I', 6),
  ('G07C07', 'G07P1C07', 'Part I', 7),
  ('G07C08', 'G07P1C08', 'Part I', 8),
  ('G07C09', 'G07P2C01', 'Part II', 1),
  ('G07C10', 'G07P2C02', 'Part II', 2),
  ('G07C11', 'G07P2C03', 'Part II', 3),
  ('G07C12', 'G07P2C04', 'Part II', 4),
  ('G07C13', 'G07P2C05', 'Part II', 5),
  ('G07C14', 'G07P2C06', 'Part II', 6),
  ('G07C15', 'G07P2C07', 'Part II', 7),
  ('G08C01', 'G08P1C01', 'Part I', 1),
  ('G08C02', 'G08P1C02', 'Part I', 2),
  ('G08C03', 'G08P1C03', 'Part I', 3),
  ('G08C04', 'G08P1C04', 'Part I', 4),
  ('G08C05', 'G08P1C05', 'Part I', 5),
  ('G08C06', 'G08P1C06', 'Part I', 6),
  ('G08C07', 'G08P1C07', 'Part I', 7),
  ('G08C08', 'G08P2C01', 'Part II', 1),
  ('G08C09', 'G08P2C02', 'Part II', 2),
  ('G08C10', 'G08P2C03', 'Part II', 3),
  ('G08C11', 'G08P2C04', 'Part II', 4),
  ('G08C12', 'G08P2C05', 'Part II', 5),
  ('G08C13', 'G08P2C06', 'Part II', 6),
  ('G08C14', 'G08P2C07', 'Part II', 7);

-- 1. A row made by the relay sync takes the list row's name and details.
UPDATE "Chapter" n
SET title = CASE WHEN upper(btrim(n.title)) = upper(n.code) OR btrim(n.title) = '' THEN o.title ELSE n.title END,
    book = COALESCE(n.book, o.book),
    part = m.part,
    "chapterNo" = m.no,
    "teachingMonths" = COALESCE(n."teachingMonths", o."teachingMonths"),
    "ncertUrl" = COALESCE(n."ncertUrl", o."ncertUrl"),
    creator = COALESCE(n.creator, o.creator),
    "expectedCompletion" = COALESCE(n."expectedCompletion", o."expectedCompletion")
FROM chapter_part_map m
JOIN "Chapter" o ON o.code = m."old"
WHERE n.code = m."new";

-- 2. Anything on the list row moves to the kept row; the list row goes.
UPDATE "WorkItem" w
SET "chapterId" = n.id
FROM chapter_part_map m
JOIN "Chapter" o ON o.code = m."old"
JOIN "Chapter" n ON n.code = m."new"
WHERE w."chapterId" = o.id;

DELETE FROM "Chapter" o
USING chapter_part_map m
WHERE o.code = m."old" AND EXISTS (SELECT 1 FROM "Chapter" n WHERE n.code = m."new");

-- 3. Every other list row takes its part code.
UPDATE "Chapter" o
SET code = m."new", part = m.part, "chapterNo" = m.no
FROM chapter_part_map m
WHERE o.code = m."old";

-- 4. A chapter kept on a journey as text follows its chapter's name.
UPDATE "WorkItem" w
SET data = jsonb_set(w.data, '{chapterTitle}', to_jsonb(c.title))
FROM "Chapter" c
WHERE w."chapterId" = c.id AND jsonb_typeof(w.data) = 'object' AND w.data ? 'chapterTitle' AND w.data->>'chapterTitle' <> c.title
  AND c.code IN (SELECT "new" FROM chapter_part_map);

DROP TABLE chapter_part_map;
