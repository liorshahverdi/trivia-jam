// tsc does not emit the JSON question packs; copy them next to the compiled loader.
import { cpSync } from 'node:fs';

cpSync('src/questions', 'dist/questions', {
  recursive: true,
  filter: (source) => !source.endsWith('.ts'),
});
cpSync('src/question-blocklist.json', 'dist/question-blocklist.json');
