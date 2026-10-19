// A corpus of SQL injection payloads and awkward strings, used as stored data and as query values.
export const PAYLOADS: string[] = [
  "'", "''", "'''", '"', '`', '\\', "\\'", "\\\\'", "\\''", "\\\\", "'\\", "a\\'b", "a\\\\'b",
  "' OR '1'='1", "' OR 1=1 --", "' OR 1=1 #", "' OR 1=1 /*", "') OR ('1'='1", "')) OR (('1'='1", "' OR ''='",
  "admin'--", "admin' #", "admin'/*", "'; DROP TABLE canary; --", "'; DELETE FROM canary; --", "1; DROP TABLE canary",
  "' UNION SELECT NULL --", "' UNION SELECT id, name FROM t --", "' AND 1=CONVERT(int,(SELECT @@version)) --",
  "'; SELECT pg_sleep(3); --", "' OR pg_sleep(3) IS NULL --", "' OR SLEEP(3) -- ", "' OR SLEEP(3)='", "'; WAITFOR DELAY '0:0:3'; --",
  "' || (SELECT 1) || '", "'||'", "' + '", "'+(SELECT 1)+'", "$$; DROP TABLE canary; $$", "$tag$", "E'\\''", "N'x'",
  '--', '#', '/*', '*/', ';', '/**/', '-- -', '; --',
  '%', '_', '%_%', '[', ']', '[a]', '[^a]', '[%]', '[_]', '^', '\\%', '\\_', '%\\', '_\\',
  '’', 'ʼ', '＇', '‘', '“', '”', '＂', '`', '´', '′',
  'é', 'ß', 'ﬃ', '🐟', '𝕏', 'İ', 'ı', 'Ä', 'á', '​', '﻿',
  '\n', '\r', '\r\n', '\t', '\u0008', '\u001a', '\u000b', ' ', ' ',
  ' ', '', 'NULL', 'null', 'TRUE', '0', '-0', '1e309', 'NaN', '$1', '?', ':p1', '@p1', '?::text',
  "O'Brien", "x' AND 'a' LIKE 'a", "x' ESCAPE '|", "\\' ESCAPE '\\\\'", "a' COLLATE \"C\" --",
  'x'.repeat(300) + "'", "'".repeat(40), '\\'.repeat(41),
];
