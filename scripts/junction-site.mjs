/** Preserve live instruments at build time, but never ship the old scrolling portfolio shell. */
export function extractSection(html,id) {
  if(!/^[a-z][a-z0-9-]*$/.test(id))throw new Error('Invalid section identifier');
  const opening=new RegExp(`<section\\b[^>]*\\bid=["']${id}["'][^>]*>`).exec(html);
  if(!opening)throw new Error(`Missing required station payload: ${id}`);
  const tags=/<\/?section\b[^>]*>/g;tags.lastIndex=opening.index;let depth=0,match;
  while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0)return html.slice(opening.index,tags.lastIndex);}
  throw new Error(`Unclosed station payload: ${id}`);
}
export function junctionPage(shell,archive) {
  if(shell.includes('id="station-payloads"'))return shell;
  const marker='<!-- JUNCTION_ARTIFACTS -->';
  if(!shell.includes(marker))throw new Error('World shell is missing its payload mount');
  const instruments=['model','challenge-two','shaders'].map(id=>extractSection(archive,id)).join('\n');
  const secure=['secure-card','result-overlay'].map(id=>extractSection(archive,id)).join('\n');
  return shell.replace(marker,`<div id="station-payloads" hidden>\n${instruments}\n</div>\n${secure}\n<div id="toast" role="status"></div>`);
}
export function battlefieldChrome(html) {
  return html.replaceAll('./archive.html','./')
    .replace('<a href="./rogue.html" aria-current="page">无尽防线</a>','<a href="./#home">返回世界</a>')
    .replaceAll('档案馆','开源船坞')
    .replace('跳过游戏，浏览作品','直接传送到开源船坞')
    .replace('进入开源船坞、作品与通讯室','返回交汇点、船坞与通讯站');
}
