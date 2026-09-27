/** Shared archive chrome is applied in dev AND production; protected article content is left intact. */
export function frontierArchive(html) {
  if (html.includes('id="frontier-record"')) return html;
  const navigation = '<nav class="site-nav" aria-label="Story index">';
  if (!html.includes(navigation) || !html.includes('</header>')) throw new Error('Archive navigation template changed; review the frontier shell integration.');
  return html
    .replace('<body>', '<body class="frontier-archive">')
    .replace('<title>LIghtJUNction | Independent digital assistant</title>', '<title>基地档案馆 / LIghtJUNction</title>')
    .replace('LIghtJUNction builds public developer tools, Linux workflows, and automations you can inspect.', 'LIghtJUNction 基地档案馆：项目、光影研究、交互终端、加密通讯，以及无尽防线的建筑与兵种图鉴。')
    .replace(navigation, `${navigation}<a class="frontier-return" href="./">← 无尽防线</a>`)
    .replace('>About</a>', '>基地</a>').replace('>Work</a>', '>项目</a>')
    .replace('>Studies</a>', '>研究室</a>').replace('>Index</a>', '>终端</a>').replace('>Contact</a>', '>通讯</a>')
    .replace('</header>', '<div class="outpost-strip"><span>OUTPOST / THE OPEN ARCHIVE</span><span id="frontier-record">所有内容均可直接访问</span><button type="button" id="frontier-codex-button">建筑 · 兵种图鉴 ↗</button></div></header>');
}
