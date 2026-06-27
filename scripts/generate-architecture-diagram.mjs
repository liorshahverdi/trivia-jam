import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const graph = JSON.parse(readFileSync('graphify-out/graph.json', 'utf8'));
const nodes = graph.nodes ?? [];
const links = graph.links ?? [];
const productionNodes = nodes.filter((n) => !String(n.source_file ?? '').startsWith('qa-artifacts/'));
const packageCounts = productionNodes.reduce((acc, n) => {
  const file = String(n.source_file ?? '');
  const key = file.startsWith('packages/client/') ? 'client'
    : file.startsWith('packages/server/') ? 'server'
    : file.startsWith('packages/shared/') ? 'shared'
    : file.startsWith('packages/tools/') ? 'tools'
    : file.startsWith('scripts/') ? 'scripts'
    : file === 'package.json' || file.endsWith('tsconfig.json') || file === 'tsconfig.base.json' ? 'workspace'
    : file.startsWith('docs/') ? 'docs'
    : 'other';
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

const outDir = 'docs/architecture';
mkdirSync(outDir, { recursive: true });

const W = 1800;
const H = 1420;
const now = new Date().toISOString();
const graphStats = `${productionNodes.length} production AST nodes / ${links.length} links • graphify update . --no-cluster • ${now}`;

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function rect({id,x,y,w,h,title,subtitle,kind='external',items=[]}) {
  const colors = {
    frontend: ['rgba(8,51,68,.48)', '#22d3ee'],
    backend: ['rgba(6,78,59,.48)', '#34d399'],
    database: ['rgba(76,29,149,.48)', '#a78bfa'],
    cloud: ['rgba(120,53,15,.34)', '#fbbf24'],
    security: ['rgba(136,19,55,.42)', '#fb7185'],
    bus: ['rgba(251,146,60,.34)', '#fb923c'],
    shared: ['rgba(30,64,175,.40)', '#60a5fa'],
    tools: ['rgba(88,28,135,.42)', '#c084fc'],
    disabled: ['rgba(51,65,85,.32)', '#64748b'],
    external: ['rgba(30,41,59,.55)', '#94a3b8'],
  };
  const [fill, stroke] = colors[kind] ?? colors.external;
  const lines = [`<g id="${esc(id)}">`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#0f172a"/>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>`,
    `<text x="${x+14}" y="${y+24}" class="title" fill="${stroke}">${esc(title)}</text>`,
    `<text x="${x+14}" y="${y+42}" class="sub">${esc(subtitle)}</text>`];
  items.slice(0, 8).forEach((it, idx) => lines.push(`<text x="${x+16}" y="${y+64+idx*16}" class="item">• ${esc(it)}</text>`));
  lines.push('</g>');
  return lines.join('\n');
}
function boundary(x,y,w,h,label,stroke='#fbbf24') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="none" stroke="${stroke}" stroke-width="1.4" stroke-dasharray="8 6" opacity=".85"/><text x="${x+16}" y="${y+24}" class="boundary" fill="${stroke}">${esc(label)}</text>`;
}
function arrow(id,x1,y1,x2,y2,label,color='#38bdf8',dash='') {
  const midx=(x1+x2)/2, midy=(y1+y2)/2;
  return `<path id="${esc(id)}" d="M ${x1} ${y1} C ${midx} ${y1}, ${midx} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#arrow)" opacity=".9"/><text x="${midx-70}" y="${midy-8}" class="edge" fill="${color}">${esc(label)}</text>`;
}
function line(id,x1,y1,x2,y2,label,color='#94a3b8',dash='') {
  const midx=(x1+x2)/2, midy=(y1+y2)/2;
  return `<line id="${esc(id)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#arrow)" opacity=".9"/><text x="${midx-60}" y="${midy-8}" class="edge" fill="${color}">${esc(label)}</text>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.6"/></pattern>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/></marker>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&amp;display=swap');
      text{font-family:'JetBrains Mono',monospace}.h1{font-size:28px;font-weight:700;fill:#e2e8f0}.h2{font-size:13px;fill:#94a3b8}.title{font-size:14px;font-weight:700}.sub{font-size:10px;fill:#cbd5e1}.item{font-size:10px;fill:#e2e8f0}.edge{font-size:10px;font-weight:600}.boundary{font-size:13px;font-weight:700}.tiny{font-size:9px;fill:#94a3b8}.legend{font-size:11px;fill:#e2e8f0}
    </style>
  </defs>
  <rect width="${W}" height="${H}" fill="#020617"/><rect width="${W}" height="${H}" fill="url(#grid)" opacity=".7"/>
  <text x="40" y="50" class="h1">Trivia Jam — AST-Grounded Architecture</text>
  <text x="40" y="76" class="h2">${esc(graphStats)}</text>

  <!-- Boundaries -->
  ${boundary(30,105,420,1120,'Client workspace: packages/client','#22d3ee')}
  ${boundary(490,105,520,1120,'Server workspace: packages/server','#34d399')}
  ${boundary(1045,105,335,1120,'Shared workspace: packages/shared','#60a5fa')}
  ${boundary(1415,105,350,1120,'Tools / Ops / Deploy','#c084fc')}

  <!-- Edges behind boxes -->
  ${arrow('browser-pages',220,170,220,250,'loads React app','#22d3ee')}
  ${arrow('client-socket',450,452,490,445,'Socket.IO events','#38bdf8')}
  ${arrow('handler-room',690,445,690,560,'room mutations','#34d399')}
  ${arrow('handler-loop',770,445,770,560,'start game','#34d399')}
  ${arrow('loop-picker',770,705,770,815,'selectQuestions()','#34d399')}
  ${arrow('picker-json',1010,855,1045,780,'read JSON packs','#a78bfa')}
  ${arrow('shared-client',1045,308,450,308,'typed events / types','#60a5fa','5 5')}
  ${arrow('shared-server',1045,380,1010,380,'typed events / types','#60a5fa','5 5')}
  ${arrow('state-client',255,565,255,680,'restore / mutate state','#22d3ee')}
  ${arrow('audio-client',360,565,360,855,'sound hooks','#22d3ee')}
  ${arrow('tools-json',1465,522,1300,780,'write current-events.json','#c084fc')}
  ${arrow('rss-tools',1580,350,1580,505,'fetch articles','#fbbf24')}
  ${arrow('gen-tools',1710,350,1710,505,'generate questions','#fbbf24')}
  ${line('deploy-client',1595,970,1595,930,'','#fbbf24','4 4')}
  ${line('deploy-server',1650,970,1650,930,'','#fbbf24','4 4')}
  ${line('legacy-disabled',870,1035,870,1135,'disabled / not startup','#64748b','6 6')}

  <!-- Client -->
  ${rect({id:'gh-pages',x:75,y:125,w:305,h:75,title:'GitHub Pages static site',subtitle:'public browser entrypoint',kind:'cloud',items:['Vite-built client dist/','Host screen and player screen load here']})}
  ${rect({id:'app',x:65,y:250,w:350,h:115,title:'App.tsx router',subtitle:'role + phase switchboard',kind:'frontend',items:['role none → PlayerJoinScreen','host phases → Host* screens','player phases → Player* screens','HostAudio unlocks browser audio']})}
  ${rect({id:'host-screens',x:65,y:390,w:170,h:160,title:'Host screens',subtitle:'host UX components',kind:'frontend',items:['HostLobbyScreen','HostCategoryScreen','HostQuestionScreen','HostResultsScreen','HostLeaderboard','HostFinalScreen']})}
  ${rect({id:'player-screens',x:245,y:390,w:170,h:160,title:'Player screens',subtitle:'mobile/player UX',kind:'frontend',items:['PlayerJoinScreen','PlayerLobbyScreen','PlayerCategoryScreen','PlayerAnswerScreen','PlayerResultScreen','PlayerFinalScreen']})}
  ${rect({id:'store',x:65,y:680,w:180,h:140,title:'gameStore.ts',subtitle:'Zustand client state',kind:'frontend',items:['role, phase, roomCode','players / myPlayer','question, revealData','scores, votes, errors']})}
  ${rect({id:'socket-hook',x:255,y:680,w:160,h:140,title:'useSocket.ts',subtitle:'Socket.IO client adapter',kind:'frontend',items:['createRoom / joinRoom','setMode / categories','startGame / answer / vote','auto reconnect via localStorage']})}
  ${rect({id:'client-components',x:65,y:850,w:170,h:145,title:'Reusable UI',subtitle:'component AST nodes',kind:'frontend',items:['CategoryCard','PlayerAvatar','ProgressBar','RoomCodeDisplay','ScorePopup','TeamBadge','Timer']})}
  ${rect({id:'audio',x:245,y:850,w:170,h:145,title:'Audio subsystem',subtitle:'hooks + browser audio',kind:'frontend',items:['useSoundEffects','sounds.ts','voiceHost.ts','question / answer / countdown SFX']})}

  <!-- Server -->
  ${rect({id:'render',x:590,y:125,w:330,h:75,title:'Render web service',subtitle:'Node server deployment',kind:'cloud',items:['No runtime DB required','HTTP health + Socket.IO endpoint']})}
  ${rect({id:'app-server',x:555,y:250,w:400,h:115,title:'app.ts + index.ts + startup.ts',subtitle:'Express + HTTP + Socket.IO bootstrap',kind:'backend',items:['CORS: GitHub Pages + localhost','GET /health','setupSocketHandlers(io)','startup: JSON-managed questions only']})}
  ${rect({id:'handler',x:530,y:390,w:210,h:150,title:'socket/handler.ts',subtitle:'ClientEvents → ServerEvents',kind:'backend',items:['room:create / join / reconnect','game:setMode / selectCategories','game:start / answer / vote','playAgain / disconnect']})}
  ${rect({id:'room-manager',x:530,y:560,w:210,h:165,title:'roomManager.ts',subtitle:'in-memory room registry',kind:'backend',items:['Map<code, Room>','create / join / reconnect','disconnect grace timers','mode + category selection','canStartGame guard','team assignment / reset']})}
  ${rect({id:'game-loop',x:760,y:560,w:210,h:165,title:'gameLoop.ts',subtitle:'phase state machine',kind:'backend',items:['countdown → question','answer/vote wait loop','reveal → leaderboard','game_over','strips correctIndex for clients']})}
  ${rect({id:'question-picker',x:625,y:815,w:260,h:120,title:'QuestionPicker.ts',subtitle:'JSON-only question selection',kind:'backend',items:['questionCache per category','reads shared/src/questions/*.json','difficulty filter optional','shuffle + slice']})}
  ${rect({id:'scoring',x:530,y:970,w:210,h:110,title:'ScoreCalculator.ts',subtitle:'points + coop target',kind:'backend',items:['difficulty base points','teams speed/streak bonus','coop target calculation']})}
  ${rect({id:'teams',x:760,y:970,w:210,h:110,title:'TeamManager.ts',subtitle:'leaderboards + team scoring',kind:'backend',items:['player leaderboard','red / blue team scores','addTeamScore']})}
  ${rect({id:'legacy-db',x:625,y:1125,w:260,h:70,title:'Legacy DB/crawler modules',subtitle:'present in AST, not startup/runtime path',kind:'disabled',items:['QuestionCrawler / db-seed / db-migrate','CurrentEventsSource DB refresh path disabled']})}

  <!-- Shared -->
  ${rect({id:'types',x:1085,y:185,w:255,h:160,title:'types.ts',subtitle:'domain contracts',kind:'shared',items:['Difficulty / GameMode / Phase','20 Category union','Question / QuestionForClient','Player / Room / RoomState','Reveal / Leaderboard / GameOver']})}
  ${rect({id:'events',x:1085,y:375,w:255,h:135,title:'events.ts',subtitle:'Socket event names',kind:'shared',items:['ClientEvents: create/join/start','answer vs vote split','ServerEvents: phase/question/reveal','leaderboard/gameOver/state/error']})}
  ${rect({id:'constants',x:1085,y:540,w:255,h:115,title:'constants.ts',subtitle:'game constants',kind:'shared',items:['room code length','max players','timers','questions per game','avatars / category metadata']})}
  ${rect({id:'question-packs',x:1085,y:690,w:255,h:260,title:'Question JSON packs',subtitle:'20 committed category files',kind:'database',items:['animals/anime/art/board-games','cartoons/current-events','entertainment/food/gadgets','general/geography/history','math/music/musicals','mythology/science/tech','television/video-games','question-packs.test validates floor']})}

  <!-- Tools / Ops -->
  ${rect({id:'rss',x:1455,y:185,w:130,h:145,title:'RSS feeds',subtitle:'external inputs',kind:'external',items:['NPR','BBC','PBS','NASA','ScienceDaily','Space.com','Smithsonian','The Verge/Ars/HN']})}
  ${rect({id:'generators',x:1600,y:185,w:130,h:145,title:'Generators',subtitle:'bounded AI path',kind:'external',items:['Hermes one-shot','Ollama fallback','OpenAI-compatible legacy','strict JSON only']})}
  ${rect({id:'current-events-tool',x:1455,y:505,w:275,h:215,title:'current-events-static.ts',subtitle:'Current Events JSON refresh',kind:'tools',items:['fetch RSS articles','filter unsafe/stale subjects','generate + validate MCQs','deduplicate','keep fresh ~21 days','top up to ≥20','write current-events.json']})}
  ${rect({id:'tooling',x:1455,y:760,w:275,h:135,title:'Question tooling',subtitle:'packages/tools AST components',kind:'tools',items:['writer.ts read/write category JSON','deduplicator.ts','sources/opentdb.ts','crawl-questions.ts','question-packs.test guardrail']})}
  ${rect({id:'ci-deploy',x:1455,y:970,w:275,h:145,title:'Build / deploy / ops',subtitle:'workspace scripts + hosting',kind:'cloud',items:['npm workspaces','Vite client build','tsc shared/server/tools','GitHub Actions → Pages','Render service → Socket.IO','local cron can refresh JSON + push']})}

  <!-- Notes and legend -->
  <rect x="40" y="1260" width="1720" height="110" rx="12" fill="rgba(15,23,42,.92)" stroke="#334155"/>
  <text x="65" y="1290" class="title" fill="#e2e8f0">Graph-derived notes</text>
  <text x="65" y="1314" class="legend">• AST graph found workspace packages client/server/shared/tools, imports/calls/contains links, and the runtime Socket.IO + JSON-question path.</text>
  <text x="65" y="1334" class="legend">• Render database/crawler files still exist in AST as legacy modules, but startup.ts and QuestionPicker.ts keep production runtime JSON-file managed.</text>
  <text x="65" y="1354" class="legend">• Current Events freshness is an ops/tooling concern: refresh-current-events.ts updates committed JSON; gameplay reads only committed JSON.</text>
  <text x="1260" y="1290" class="tiny">Package AST node counts</text>
  <text x="1260" y="1310" class="tiny">client ${packageCounts.client ?? 0} • server ${packageCounts.server ?? 0} • shared ${packageCounts.shared ?? 0} • tools ${packageCounts.tools ?? 0}</text>
  <text x="1260" y="1330" class="tiny">scripts ${packageCounts.scripts ?? 0} • workspace ${packageCounts.workspace ?? 0} • docs ${packageCounts.docs ?? 0}</text>
</svg>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Trivia Jam Architecture</title>
<style>body{margin:0;background:#020617;color:#e2e8f0;font-family:'JetBrains Mono',ui-monospace,monospace}.wrap{max-width:1840px;margin:0 auto;padding:24px}.card{border:1px solid #1e293b;border-radius:18px;background:#0f172a;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.35)}img,svg{width:100%;height:auto}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px}.meta div{border:1px solid #1e293b;border-radius:12px;padding:14px;background:#111827}.meta h3{margin:0 0 8px;color:#67e8f9}.meta p{margin:0;color:#cbd5e1;font-size:13px;line-height:1.5}@media(max-width:900px){.meta{grid-template-columns:1fr}}</style></head>
<body><div class="wrap"><div class="card">${svg}</div><div class="meta"><div><h3>Source of truth</h3><p>Generated from Graphify AST-only output: ${esc(graphStats)}. No LLM extraction or clustering was used.</p></div><div><h3>Runtime architecture</h3><p>Browser client uses Socket.IO events against the Render Node service. Server state is in-memory per room. Questions are selected from committed JSON packs.</p></div><div><h3>Ops architecture</h3><p>Current Events refresh is outside gameplay: RSS + generator + validator writes current-events.json, then static hosting/server deploys consume the file.</p></div></div></div></body></html>`;

writeFileSync(`${outDir}/trivia-jam-architecture.svg`, svg);
writeFileSync(`${outDir}/trivia-jam-architecture.html`, html);
console.log(`${outDir}/trivia-jam-architecture.svg`);
console.log(`${outDir}/trivia-jam-architecture.html`);
console.log(graphStats);
