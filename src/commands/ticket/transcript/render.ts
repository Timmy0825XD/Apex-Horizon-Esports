import { FILE_ICON, renderComponents, renderEmbeds } from "./components.js";
import {
  escapeHtml,
  humanFileSize,
  renderDiscordMarkdown,
  safeHttpUrl,
  type AssetResolver,
} from "./markdown.js";
import type {
  RenderedTranscriptPage,
  TranscriptAuthor,
  TranscriptMessage,
  TranscriptSnapshot,
} from "./types.js";

const MAX_PAGE_BYTES = 7 * 1024 * 1024;
/** Room for the page shell (CSS, script, sidebars) that is not part of the message chunks. */
const SHELL_RESERVE_BYTES = 128 * 1024;
const GROUP_WINDOW_MS = 7 * 60 * 1000;
const ORDINARY_TYPES = new Set([0, 19, 20, 23]);

const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap">';

const CSS = `
:root{color-scheme:dark;--rail:#1e1f22;--side:#2b2d31;--chat:#313338;--hover:#2e3035;--input:#383a40;--line:#3f4147;--line-soft:#26272b;--text:#dbdee1;--strong:#f2f3f5;--muted:#949ba4;--faint:#6d6f78;--link:#00a8fc;--blurple:#5865f2;--mention-bg:rgba(88,101,242,.3);--mention-fg:#c9cdfb;--green:#23a55a;--secondary:#4e5058;--success:#248046;--danger:#da373c;--spine:#4e5058;--card:#2b2d31;--flash:rgba(250,168,26,.14);--font:"gg sans","Noto Sans","Helvetica Neue",Helvetica,Arial,sans-serif;--mono:Consolas,"Andale Mono WT","Andale Mono","Lucida Console",monospace}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:var(--rail);color:var(--text);font-family:var(--font);font-size:16px;line-height:1.375}a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}button{font:inherit;color:inherit}:focus-visible{outline:2px solid var(--blurple);outline-offset:2px}
.app{display:grid;grid-template-columns:240px minmax(0,1fr) 240px;height:100vh;height:100dvh;position:relative;overflow:hidden}
.side{background:var(--side);display:flex;flex-direction:column;min-width:0;overflow:hidden}.side-head{height:48px;flex:none;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid var(--rail);font-weight:600;color:var(--strong);font-size:15px;white-space:nowrap;overflow:hidden}.side-head span{overflow:hidden;text-overflow:ellipsis}.side-body{overflow:auto;padding:16px 8px;display:grid;gap:18px;align-content:start}
.cap{font-size:12px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--muted);padding:0 8px 4px;overflow-wrap:anywhere}
.guild-icon{width:24px;height:24px;border-radius:8px;flex:none;object-fit:cover;background:var(--blurple);display:grid;place-items:center;color:#fff;font-size:11px;font-weight:700}
.facts{display:grid;gap:2px}.fact{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:baseline;padding:5px 8px;font-size:14px}.fact>span:first-child{color:var(--muted)}.fact>span:last-child{text-align:right;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.fact code{font-family:var(--mono);font-size:12px}
.parts{display:grid;gap:2px}.part{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;color:var(--muted);font-size:15px;font-weight:500}.part:hover{background:var(--hover);color:var(--text);text-decoration:none}.part.current{background:var(--input);color:var(--strong)}.part small{margin-left:auto;font-size:12px;color:var(--faint);font-variant-numeric:tabular-nums}.hash{color:var(--faint);font-weight:400}
.member-group{display:grid;gap:1px}.member{display:flex;align-items:center;gap:12px;padding:5px 8px;border-radius:4px}.member:hover{background:var(--hover)}.member .avatar{width:32px;height:32px;font-size:13px}.member div{min-width:0}.member b{display:block;font-weight:500;font-size:15px;color:var(--author-color,var(--text));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.member small{display:block;font-size:12px;color:var(--muted)}
.main{display:flex;flex-direction:column;min-width:0;background:var(--chat)}
.channel-head{height:48px;flex:none;display:flex;align-items:center;gap:8px;padding:0 8px 0 16px;border-bottom:1px solid var(--rail);box-shadow:0 1px 0 rgba(4,4,5,.2)}.channel-head .hash{font-size:24px;line-height:1}.channel-head h1{margin:0;font-size:16px;font-weight:600;color:var(--strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.topic{flex:1;min-width:0;color:var(--muted);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:1px solid var(--line);padding-left:12px;margin-left:4px}.head-tools{display:flex;align-items:center;gap:6px;margin-left:auto;flex:none}
.icon-button{width:32px;height:32px;display:none;place-items:center;border:0;background:transparent;color:var(--muted);border-radius:4px;cursor:pointer;flex:none}.icon-button:hover{color:var(--strong)}.icon-button svg{width:22px;height:22px}
.search{display:flex;align-items:center;gap:4px;background:var(--rail);border-radius:4px;height:26px;width:180px;padding:0 6px;transition:width .15s}.search:focus-within{width:240px}.search input{border:0;background:transparent;color:var(--text);font:inherit;font-size:13px;width:100%;min-width:0;outline:none}.search input::placeholder{color:var(--muted)}.search-count{font-size:11px;color:var(--muted);white-space:nowrap;font-variant-numeric:tabular-nums}.search svg{width:16px;height:16px;flex:none;fill:var(--muted)}
.scroller{flex:1;overflow-y:auto;overflow-x:hidden;padding-bottom:24px}
.welcome{padding:32px 16px 8px}.welcome-icon{width:68px;height:68px;border-radius:50%;background:var(--secondary);display:grid;place-items:center;color:#fff;font-size:40px;font-weight:300;margin-bottom:8px}.welcome h2{margin:0;font-size:32px;line-height:1.25;font-weight:700;color:var(--strong);overflow-wrap:anywhere}.welcome p{margin:6px 0 0;color:var(--muted)}
.day{display:flex;align-items:center;justify-content:center;margin:24px 16px 8px;height:0;border-top:1px solid var(--line)}.day span{background:var(--chat);padding:2px 4px;color:var(--muted);font-size:12px;font-weight:600;line-height:13px;margin-top:-1px}
.message{position:relative;padding:2px 48px 2px 72px;margin-top:17px;min-height:44px;overflow-wrap:anywhere}.message:hover{background:var(--hover)}.message.compact{margin-top:0;min-height:0}.message.compact>.avatar,.message.compact>.message-head{display:none}.message.flash{animation:flash 1.6s ease-out}@keyframes flash{0%,40%{background:var(--flash)}100%{background:transparent}}
.avatar{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;flex:none;color:#fff;font-weight:600;font-size:16px;background:var(--blurple) center/cover no-repeat;user-select:none;overflow:hidden}.message>.avatar{position:absolute;left:16px;top:4px}.message.has-context>.avatar{top:26px}
.message-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 .25rem;margin:0;font-size:16px;font-weight:400;line-height:22px}.author{font-weight:500;color:var(--author-color,var(--strong))}.app-tag{display:inline-flex;align-items:center;height:15px;padding:0 4px;border-radius:3px;background:var(--blurple);color:#fff;font-size:10px;font-weight:600;line-height:15px;align-self:center}.ts{font-size:12px;font-weight:500;color:var(--muted);margin-left:.25rem}.hover-ts{display:none;position:absolute;left:0;top:4px;width:56px;padding-right:4px;text-align:right;font-size:11px;line-height:22px;color:var(--muted);font-variant-numeric:tabular-nums}.message.compact:hover>.hover-ts{display:block}
.content{color:var(--text)}.edited{font-size:10px;color:var(--muted);margin-left:3px}
.mention,.command-mention{display:inline;padding:0 2px;border-radius:3px;background:var(--mention-bg);color:var(--mention-fg);font-weight:500}.mention:hover{background:var(--blurple);color:#fff}.role-mention{background:color-mix(in srgb,var(--mention-color,#5865f2) 18%,transparent);color:var(--mention-color,var(--mention-fg))}.role-mention:hover{background:color-mix(in srgb,var(--mention-color,#5865f2) 35%,transparent);color:var(--mention-color,#fff)}
.emoji{width:1.375em;height:1.375em;vertical-align:-.3em;object-fit:contain}.inline-code{font-family:var(--mono);font-size:.85em;padding:.1em .3em;border-radius:4px;background:var(--card);border:1px solid var(--line-soft)}pre{max-width:90%;margin:6px 0 0;padding:8px;border-radius:4px;background:var(--card);border:1px solid var(--line-soft);font-family:var(--mono);font-size:14px;white-space:pre-wrap;overflow-x:auto}pre code{font-family:inherit}.code-language{display:block;color:var(--muted);font-size:11px;margin-bottom:4px}
.spoiler{background:var(--rail);color:transparent;border-radius:3px;cursor:pointer}.spoiler.shown,.spoiler:focus{background:var(--input);color:inherit}.blockquote{display:inline-block;border-left:4px solid var(--secondary);padding-left:12px}.subtext{font-size:13px;color:var(--muted)}.md-heading{display:inline-block;font-weight:700;color:var(--strong);margin:4px 0}.md-heading-1{font-size:1.5em}.md-heading-2{font-size:1.25em}.md-heading-3{font-size:1em}
.context{position:relative;display:flex;align-items:center;gap:4px;height:22px;font-size:14px;line-height:18px;color:var(--muted);white-space:nowrap;overflow:hidden}.context:before{content:"";position:absolute;left:-38px;top:10px;width:30px;height:12px;border-left:2px solid var(--spine);border-top:2px solid var(--spine);border-top-left-radius:6px}.context .avatar{width:16px;height:16px;font-size:9px}.context b{flex:none;font-weight:500;color:var(--author-color,var(--strong))}.context .command{color:var(--link);font-weight:500}.reply-preview{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--muted)}a.reply-preview:hover{color:var(--strong);text-decoration:none}.reply-preview *{display:inline!important;font-size:inherit!important;margin:0!important;padding:0!important;border:0!important;background:none!important}.reply-preview br{display:none!important}.reply-preview img{width:1em;height:1em}.reply-missing{font-style:italic}
.message.system{min-height:0;margin-top:8px;color:var(--muted)}.system-icon{position:absolute;left:28px;top:5px;width:16px;height:16px}.system-icon.join{color:var(--green)}.system b{color:var(--strong);font-weight:500}
.forward{margin-top:4px;padding-left:12px;border-left:4px solid var(--secondary);display:grid;gap:2px}.forward-label{display:flex;align-items:center;gap:4px;font-size:14px;font-style:italic;color:var(--muted)}.forward-label svg{width:16px;height:16px}.forward-time{font-size:12px;color:var(--muted)}
.attachments,.stickers{display:grid;gap:4px;justify-items:start;margin-top:4px}.attachments>a{line-height:0;max-width:100%}.attachment-image{display:block;max-width:min(550px,100%);max-height:350px;width:auto;height:auto;border-radius:8px;object-fit:contain;cursor:zoom-in}.sticker{width:160px;height:160px;object-fit:contain}
.file-card,.v2-file,.omitted{display:flex;align-items:center;gap:10px;width:min(432px,100%);padding:16px;border:1px solid var(--line-soft);border-radius:8px;background:var(--card);line-height:1.25}.file-card:hover,.v2-file:hover{text-decoration:none;border-color:var(--line)}.file-icon{width:30px;height:40px;flex:none}.file-card>span{min-width:0;display:grid}.file-name{color:var(--link);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-meta{font-size:12px;color:var(--muted)}.omitted{color:var(--muted);font-size:14px}
.reactions{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.reaction{display:inline-flex;align-items:center;gap:6px;height:26px;padding:2px 6px;border-radius:8px;border:1px solid transparent;background:var(--card);color:var(--muted);font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}.reaction .emoji{width:16px;height:16px;vertical-align:0}.reaction.mine{background:var(--mention-bg);border-color:var(--blurple);color:var(--mention-fg)}
.embed{position:relative;display:grid;gap:8px;max-width:516px;margin-top:4px;padding:8px 16px 16px 12px;background:var(--card);border-left:4px solid var(--embed-color,var(--rail));border-radius:4px;font-size:14px;overflow:hidden}.embed:after{content:"";display:block;clear:both}.embed-author{display:flex;align-items:center;gap:8px;margin-top:8px;font-weight:600;color:var(--strong)}.embed-author-icon{width:24px;height:24px;border-radius:50%;object-fit:cover}.embed-title{margin-top:8px;font-size:16px;font-weight:600;color:var(--strong)}a.embed-title{color:var(--link)}.embed-description{white-space:normal}.embed-fields{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px}.embed-field{grid-column:span 12;min-width:0}.embed-field.inline{grid-column:span 4}.embed-field strong{display:block;margin-bottom:2px;color:var(--strong);font-weight:600}.embed-image{display:block;max-width:100%;max-height:300px;border-radius:4px}.embed-thumbnail{position:absolute;top:16px;right:16px;max-width:80px;max-height:80px;border-radius:4px;object-fit:contain}.embed:has(.embed-thumbnail){padding-right:112px;min-height:112px}.embed-footer{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;color:var(--muted)}.embed-footer-icon{width:20px;height:20px;border-radius:50%}
.v2-container{position:relative;display:grid;gap:8px;max-width:600px;margin-top:4px;padding:16px;background:var(--card);border:1px solid var(--line-soft);border-radius:8px;overflow:hidden;font-size:15px}.v2-container.accent{padding-left:20px}.v2-container.accent:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--v2-color)}.v2-section{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}.v2-section-content{display:grid;gap:8px;min-width:0}.v2-thumbnail{width:85px;height:85px;border-radius:8px;object-fit:cover}.v2-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:4px}.v2-media{display:block;width:100%;max-height:350px;border-radius:8px;object-fit:cover}.v2-space{height:8px}.v2-container hr{width:100%;margin:4px 0;border:0;border-top:1px solid var(--line)}
.component-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}.component-button{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 16px;border-radius:8px;background:var(--secondary);color:#fff;font-size:14px;font-weight:500;white-space:nowrap}.component-button:hover{text-decoration:none;filter:brightness(1.1)}.component-button.style-1{background:var(--blurple)}.component-button.style-3{background:var(--success)}.component-button.style-4{background:var(--danger)}.component-button.disabled{opacity:.5;cursor:not-allowed;filter:none}.button-icon{width:14px;height:14px}
.component-select{width:min(400px,100%);border:1px solid var(--rail);border-radius:8px;background:var(--rail);font-size:14px}.component-select summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;color:var(--muted);cursor:pointer;list-style:none}.component-select summary::-webkit-details-marker{display:none}.select-chevron{width:20px;height:20px;flex:none}.component-options{display:grid;padding:4px;border-top:1px solid var(--line-soft)}.component-options span{padding:8px;border-radius:4px;color:var(--text)}.component-options span:hover{background:var(--hover)}
.tools{position:absolute;right:14px;top:-16px;z-index:3;display:none;background:var(--chat);border:1px solid var(--line-soft);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.2)}.message:hover>.tools,.message:focus-within>.tools,.message.open>.tools{display:flex}.tools button{width:32px;height:30px;display:grid;place-items:center;border:0;background:transparent;color:var(--muted);border-radius:6px;cursor:pointer}.tools button:hover{background:var(--hover);color:var(--strong)}.tools svg{width:18px;height:18px}
.details{position:absolute;right:14px;top:18px;z-index:4;display:none;width:min(320px,calc(100% - 28px));padding:8px;border-radius:8px;background:var(--rail);box-shadow:0 8px 24px rgba(0,0,0,.4);font-size:12px}.message.open>.details{display:grid;gap:2px}.details strong{padding:2px 6px 4px;color:var(--strong);font-size:12px}.details div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:6px;padding:4px 6px;border-radius:4px}.details div:hover{background:var(--hover)}.details span{color:var(--muted)}.details code{font-family:var(--mono);color:var(--text);overflow-wrap:anywhere}
.composer{flex:none;display:flex;align-items:center;gap:10px;height:44px;margin:0 16px 24px;padding:0 16px;border-radius:8px;background:var(--input);color:var(--muted);font-size:15px}.composer svg{width:18px;height:18px;flex:none}
.end{display:flex;align-items:center;gap:12px;margin:28px 16px 0;color:var(--muted);font-size:13px;text-align:center}.end:before,.end:after{content:"";flex:1;border-top:1px dashed var(--line)}.empty{padding:40px 16px;color:var(--muted);text-align:center}
.searching .message:not(.hit){opacity:.35}
.scrim{display:none}
@media(max-width:1100px){.app{grid-template-columns:240px minmax(0,1fr)}.members{position:absolute;top:0;right:0;bottom:0;width:260px;z-index:8;transform:translateX(100%);transition:transform .2s;box-shadow:-8px 0 24px rgba(0,0,0,.3)}.app.show-members .members{transform:none}.icon-button.members-toggle{display:grid}}
@media(max-width:760px){.app{grid-template-columns:minmax(0,1fr)}.info{position:absolute;top:0;left:0;bottom:0;width:260px;z-index:8;transform:translateX(-100%);transition:transform .2s;box-shadow:8px 0 24px rgba(0,0,0,.3)}.app.show-info .info{transform:none}.icon-button.info-toggle{display:grid}.topic{display:none}.search{width:120px}.search:focus-within{width:160px}.message{padding-left:64px;padding-right:12px}.message>.avatar{left:12px}.system-icon{left:24px}.hover-ts{width:52px}.welcome h2{font-size:24px}.embed-field.inline{grid-column:span 12}.tools{right:8px}}
.app.show-members .scrim,.app.show-info .scrim{display:block;position:absolute;inset:0;z-index:7;background:rgba(0,0,0,.5)}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const SCRIPT = `
(()=>{
const time=d=>d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const sameDay=(a,b)=>a.toDateString()===b.toDateString();
const relative=d=>{const s=Math.round((d.getTime()-Date.now())/1000),a=Math.abs(s),u=a<60?"second":a<3600?"minute":a<86400?"hour":"day",n=u==="second"?s:u==="minute"?Math.round(s/60):u==="hour"?Math.round(s/3600):Math.round(s/86400);return new Intl.RelativeTimeFormat("en",{numeric:"auto"}).format(n,u)};
const head=d=>{const now=new Date(),y=new Date(now);y.setDate(now.getDate()-1);return sameDay(d,now)?"Today at "+time(d):sameDay(d,y)?"Yesterday at "+time(d):d.toLocaleDateString([],{day:"2-digit",month:"2-digit",year:"numeric"})+" "+time(d)};
const discord={t:d=>time(d),T:d=>d.toLocaleTimeString(),d:d=>d.toLocaleDateString(),D:d=>d.toLocaleDateString([],{dateStyle:"long"}),f:d=>d.toLocaleString([],{dateStyle:"long",timeStyle:"short"}),F:d=>d.toLocaleString([],{dateStyle:"full",timeStyle:"short"}),R:relative};
const formats={head,time,date:d=>d.toLocaleDateString([],{dateStyle:"medium"}),full:d=>d.toLocaleString([],{dateStyle:"medium",timeStyle:"short"})};
document.querySelectorAll("time").forEach(n=>{const d=new Date(n.dateTime);if(Number.isNaN(d.getTime()))return;const f=n.classList.contains("discord-time")?(discord[n.dataset.style]||discord.f):(formats[n.dataset.fmt]||formats.full);n.textContent=f(d);n.title=d.toLocaleString([],{dateStyle:"full",timeStyle:"medium"})});
const messages=[...document.querySelectorAll(".message")];let last="";
messages.forEach((m,i)=>{const t=m.querySelector("time.ts");if(!t)return;const d=new Date(t.dateTime);const key=d.toDateString();if(key!==last){const sep=document.createElement("div");sep.className="day";sep.setAttribute("role","separator");const s=document.createElement("span");s.textContent=d.toLocaleDateString([],{dateStyle:"long"});sep.appendChild(s);m.before(sep);m.classList.remove("compact")}if(i===0)m.classList.remove("compact");last=key});
const app=document.querySelector(".app");
document.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",()=>app.classList.toggle(b.dataset.toggle)));
document.querySelector(".scrim").addEventListener("click",()=>app.classList.remove("show-members","show-info"));
const flash=id=>{const m=document.getElementById(id);if(!m)return false;m.scrollIntoView({block:"center"});m.classList.remove("flash");void m.offsetWidth;m.classList.add("flash");return true};
document.querySelectorAll("a.reply-preview").forEach(a=>a.addEventListener("click",e=>{if(flash(a.getAttribute("href").slice(1)))e.preventDefault()}));
if(location.hash)flash(location.hash.slice(1));
document.querySelectorAll(".spoiler").forEach(s=>{const t=()=>s.classList.toggle("shown");s.addEventListener("click",t);s.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();t()}})});
const close=()=>document.querySelectorAll(".message.open").forEach(m=>m.classList.remove("open"));
document.querySelectorAll(".details-button").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();const m=b.closest(".message"),was=m.classList.contains("open");close();m.classList.toggle("open",!was)}));
document.querySelectorAll(".link-button").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();const url=location.href.split("#")[0]+"#"+b.closest(".message").id;if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>{b.title="Link copied"},()=>{b.title=url});else b.title=url}));
document.addEventListener("click",close);document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
const q=document.getElementById("search"),count=document.querySelector(".search-count"),scroller=document.querySelector(".scroller");let hits=[],index=-1;
q.addEventListener("input",()=>{const v=q.value.trim().toLowerCase();messages.forEach(m=>m.classList.remove("hit"));if(!v){scroller.classList.remove("searching");count.textContent="";hits=[];return}hits=messages.filter(m=>m.textContent.toLowerCase().includes(v));hits.forEach(m=>m.classList.add("hit"));scroller.classList.add("searching");index=-1;count.textContent=hits.length+(hits.length===1?" result":" results")});
q.addEventListener("keydown",e=>{if(e.key==="Enter"&&hits.length){index=(index+1)%hits.length;flash(hits[index].id)}if(e.key==="Escape"){q.value="";q.dispatchEvent(new Event("input"))}});
})();
`;

const ICONS = {
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.6 13.4a1 1 0 0 1 0-1.4l3-3a1 1 0 1 1 1.4 1.4l-3 3a1 1 0 0 1-1.4 0ZM7 17a3 3 0 0 1 0-4.2l2-2 1.4 1.4-2 2a1 1 0 0 0 1.4 1.4l2-2 1.4 1.4-2 2A3 3 0 0 1 7 17Zm10-10a3 3 0 0 1 0 4.2l-2 2-1.4-1.4 2-2a1 1 0 0 0-1.4-1.4l-2 2L10.8 9l2-2A3 3 0 0 1 17 7Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>',
  members:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.5 8a3 3 0 1 0-2.7-4.3c-.2.4.06.86.44 1.12a5 5 0 0 1 2.14 3.08c.01.06.06.1.12.1ZM18.44 17.27c.15.43.54.73 1 .73h1.06c.83 0 1.5-.67 1.5-1.5a7.5 7.5 0 0 0-6.5-7.43c-.55-.08-.99.38-1.1.92-.06.3-.15.6-.26.87-.23.58-.05 1.3.47 1.63a9.53 9.53 0 0 1 3.83 4.78ZM12.5 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2 20.5a7.5 7.5 0 0 1 15 0c0 .83-.67 1.5-1.5 1.5h-12A1.5 1.5 0 0 1 2 20.5Z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 9V7a5 5 0 0 0-10 0v2a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3ZM9 7a3 3 0 1 1 6 0v2H9V7Z"/></svg>',
  forward: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.7 7.3a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4l3.3-3.3H11a6 6 0 0 0-6 6v2a1 1 0 1 1-2 0v-2a8 8 0 0 1 8-8h7.6l-3.3-3.3a1 1 0 1 1 1.4-1.4l5 5Z"/></svg>',
};

const SYSTEM_ICONS: Record<string, string> = {
  pin: '<path fill="currentColor" d="M19.4 8.6 15.4 4.6a1 1 0 0 0-1.6.3l-1.4 3-3.2 1.1a1 1 0 0 0-.4 1.6l2.2 2.2-4.7 4.7 1.4 1.4 4.7-4.7 2.2 2.2a1 1 0 0 0 1.6-.4l1.1-3.2 3-1.4a1 1 0 0 0 .3-1.6Z"/>',
  join: '<path fill="currentColor" d="M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z"/>',
  edit: '<path fill="currentColor" d="M4 17.2V20h2.8l8.3-8.3-2.8-2.8L4 17.2ZM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7L20.7 7Z"/>',
  boost: '<path fill="#ff73fa" d="m12 2 6 6v8l-6 6-6-6V8l6-6Zm0 4-3 3v6l3 3 3-3V9l-3-3Z"/>',
  thread: '<path fill="currentColor" d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>',
  info: '<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/>',
};

interface AuthorEntry {
  index: number;
  author: TranscriptAuthor;
  messages: number;
}

interface RenderContext {
  snapshot: TranscriptSnapshot;
  resolveAsset: AssetResolver;
  authors: Map<string, AuthorEntry>;
  byId: Map<string, TranscriptMessage>;
}

function resolveFrom(assets: Map<string, string>): AssetResolver {
  return (url) => {
    const direct = assets.get(url);
    if (direct) {
      return direct;
    }
    try {
      return assets.get(new URL(url).href) ?? "";
    } catch {
      return "";
    }
  };
}

function validColor(color: string | null | undefined): string | null {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : null;
}

function colorStyle(color: string | null | undefined): string {
  const valid = validColor(color);
  return valid ? ` style="--author-color:${valid}"` : "";
}

function initial(name: string): string {
  return escapeHtml((Array.from(name.trim())[0] ?? "?").toUpperCase());
}

function hueOf(id: string): number {
  try {
    return Number(BigInt(id) % 360n);
  } catch {
    return 230;
  }
}

function collectAuthors(snapshot: TranscriptSnapshot): Map<string, AuthorEntry> {
  const authors = new Map<string, AuthorEntry>();
  for (const message of snapshot.messages) {
    const entry = authors.get(message.author.id);
    if (entry) {
      entry.messages += 1;
      entry.author = message.author;
    } else {
      authors.set(message.author.id, { index: authors.size, author: message.author, messages: 1 });
    }
  }
  return authors;
}

/** One CSS rule per author so each avatar is embedded once per page, not once per message. */
function avatarCss(authors: Map<string, AuthorEntry>, resolveAsset: AssetResolver): string {
  return [...authors.values()]
    .map(({ index, author }) => {
      const source = safeHttpUrl(author.avatarUrl);
      const rendered = source ? resolveAsset(source) : "";
      return rendered && !/["\\<>\s]/.test(rendered)
        ? `.av-${index}{background-image:url("${rendered}");color:transparent}`
        : `.av-${index}{background-color:hsl(${hueOf(author.id)} 45% 42%)}`;
    })
    .join("");
}

function avatar(entry: AuthorEntry | undefined, name: string): string {
  return entry
    ? `<span class="avatar av-${entry.index}" aria-hidden="true">${initial(name)}</span>`
    : `<span class="avatar" aria-hidden="true">${initial(name)}</span>`;
}

function timeTag(iso: string, format: string, className = ""): string {
  return `<time${className ? ` class="${className}"` : ""} datetime="${escapeHtml(iso)}" data-fmt="${format}">${escapeHtml(iso)}</time>`;
}

function renderReply(message: TranscriptMessage, ctx: RenderContext): string {
  const reply = message.reply;
  if (!reply) return "";
  const original = ctx.byId.get(reply.messageId);
  const author = original?.author;
  const name = author?.displayName ?? reply.authorName;
  if (!name) {
    return `<div class="context">${avatar(undefined, "?")}<span class="reply-preview reply-missing">Original message was deleted or is not in this transcript</span></div>`;
  }
  const preview = reply.content
    ? renderDiscordMarkdown(reply.content, ctx.snapshot.mentions, ctx.resolveAsset)
    : '<span class="reply-missing">Click to see the original message</span>';
  return `<div class="context">${avatar(author ? ctx.authors.get(author.id) : undefined, name)}<b${colorStyle(author?.color)}>@${escapeHtml(name)}</b><a class="reply-preview" href="#message-${escapeHtml(reply.messageId)}">${preview}</a></div>`;
}

function renderInteraction(message: TranscriptMessage, ctx: RenderContext): string {
  const interaction = message.interaction;
  if (!interaction) return "";
  const entry = ctx.authors.get(interaction.userId);
  return `<div class="context">${avatar(entry, interaction.userName)}<b${colorStyle(entry?.author.color)}>${escapeHtml(interaction.userName)}</b><span>used</span><span class="command">/${escapeHtml(interaction.name)}</span></div>`;
}

function renderForwards(message: TranscriptMessage, ctx: RenderContext): string {
  const { mentions } = ctx.snapshot;
  return message.forwards
    .map((forwarded) => {
      const body = forwarded.content
        ? `<div class="content">${renderDiscordMarkdown(forwarded.content, mentions, ctx.resolveAsset)}</div>`
        : "";
      const when = forwarded.createdAt
        ? timeTag(forwarded.createdAt, "full", "forward-time")
        : '<span class="forward-time">Original unavailable</span>';
      return `<div class="forward"><div class="forward-label">${ICONS.forward}Forwarded message</div>${body}${renderEmbeds(forwarded.embeds, mentions, ctx.resolveAsset)}${renderComponents(forwarded.components, mentions, ctx.resolveAsset)}${renderAttachments(forwarded.attachments, ctx.resolveAsset)}${renderStickers(forwarded.stickers, ctx.resolveAsset)}${when}</div>`;
    })
    .join("");
}

function renderAttachments(attachments: TranscriptMessage["attachments"], resolveAsset: AssetResolver): string {
  if (!attachments.length) return "";
  const content = attachments
    .map((attachment) => {
      const url = safeHttpUrl(attachment.url);
      if (!url) return "";
      if (attachment.image) {
        const renderedUrl = resolveAsset(url);
        if (renderedUrl) {
          const size =
            attachment.width && attachment.height ? ` width="${attachment.width}" height="${attachment.height}"` : "";
          return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img class="attachment-image" src="${escapeHtml(renderedUrl)}" alt="${escapeHtml(attachment.description ?? attachment.name)}"${size} loading="lazy"></a>`;
        }
      }
      return `<a class="file-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${FILE_ICON}<span><span class="file-name">${escapeHtml(attachment.name)}</span><span class="file-meta">${humanFileSize(attachment.size)}</span></span></a>`;
    })
    .join("");
  return content ? `<div class="attachments">${content}</div>` : "";
}

function renderStickers(stickers: TranscriptMessage["stickers"], resolveAsset: AssetResolver): string {
  if (!stickers.length) return "";
  const content = stickers
    .map((sticker) => {
      const url = safeHttpUrl(sticker.url);
      if (!url) return "";
      const renderedUrl = /\.json(?:\?|$)/i.test(url) ? "" : resolveAsset(url);
      return renderedUrl
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img class="sticker" src="${escapeHtml(renderedUrl)}" alt="${escapeHtml(sticker.name)}" title="${escapeHtml(sticker.description ?? sticker.name)}" loading="lazy"></a>`
        : `<a class="omitted" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Sticker: ${escapeHtml(sticker.name)}${sticker.description ? ` — ${escapeHtml(sticker.description)}` : ""}</a>`;
    })
    .join("");
  return content ? `<div class="stickers">${content}</div>` : "";
}

function renderReactions(message: TranscriptMessage, resolveAsset: AssetResolver): string {
  if (!message.reactions.length) return "";
  return `<div class="reactions">${message.reactions
    .map((reaction) => {
      const image = reaction.imageUrl ? resolveAsset(reaction.imageUrl) : "";
      const icon = image
        ? `<img class="emoji" src="${escapeHtml(image)}" alt="${escapeHtml(reaction.label)}">`
        : escapeHtml(reaction.label);
      return `<span class="reaction${reaction.reactedByBot ? " mine" : ""}" title="${escapeHtml(reaction.label)}">${icon}<span>${reaction.count}</span></span>`;
    })
    .join("")}</div>`;
}

function renderTools(message: TranscriptMessage): string {
  const interaction = message.interaction;
  const rows: [string, string][] = [
    ["Message ID", message.id],
    ["User ID", message.author.id],
    ["Username", message.author.username],
    ["Message type", String(message.type)],
  ];
  if (message.editedAt) rows.push(["Edited", message.editedAt]);
  if (interaction) rows.push(["Command", `/${interaction.name}`], ["Interaction ID", interaction.id]);
  return [
    `<div class="tools"><button type="button" class="details-button" aria-label="Message details" title="Message details">${ICONS.info}</button><button type="button" class="link-button" aria-label="Copy message link" title="Copy message link">${ICONS.link}</button></div>`,
    `<div class="details" role="dialog" aria-label="Message details"><strong>Message details</strong>${rows
      .map(([label, value]) => `<div><span>${label}</span><code>${escapeHtml(value)}</code></div>`)
      .join("")}</div>`,
  ].join("");
}

function systemLine(message: TranscriptMessage): { icon: string; html: string } {
  const author = `<b>${escapeHtml(message.author.displayName)}</b>`;
  const labels: Record<number, [string, string]> = {
    1: ["join", `${author} added a recipient.`],
    2: ["info", `${author} removed a recipient.`],
    3: ["info", "A call took place."],
    4: ["edit", `${author} changed the channel name`],
    5: ["edit", `${author} changed the channel icon.`],
    6: ["pin", `${author} pinned a message to this channel.`],
    7: ["join", `${author} joined the server.`],
    8: ["boost", `${author} boosted the server.`],
    9: ["boost", `${author} boosted the server. The server reached boost tier 1.`],
    10: ["boost", `${author} boosted the server. The server reached boost tier 2.`],
    11: ["boost", `${author} boosted the server. The server reached boost tier 3.`],
    12: ["info", `${author} added a followed channel.`],
    18: ["thread", `${author} started a thread`],
    21: ["thread", "Thread starter message."],
    22: ["info", "Discord sent a server invite reminder."],
    24: ["info", "Discord AutoMod took an action."],
    25: ["join", `${author} purchased a role subscription.`],
    27: ["info", "A Stage event started."],
    28: ["info", "A Stage event ended."],
    29: ["info", `${author} became a Stage speaker.`],
    31: ["info", "The Stage topic changed."],
  };
  const [icon, html] = labels[message.type] ?? ["info", `Discord system message (type ${message.type}).`];
  const named = (message.type === 4 || message.type === 18) && message.content;
  return {
    icon,
    html: named ? `${html}: <b>${escapeHtml(message.content)}</b>` : html.endsWith(".") ? html : `${html}.`,
  };
}

function renderSystem(message: TranscriptMessage, ctx: RenderContext): string {
  const line = systemLine(message);
  const { mentions } = ctx.snapshot;
  return [
    `<article class="message system" id="message-${escapeHtml(message.id)}" data-author="${escapeHtml(message.author.id)}">`,
    `<svg class="system-icon ${line.icon}" viewBox="0 0 24 24" aria-hidden="true">${SYSTEM_ICONS[line.icon]}</svg>`,
    `<span>${line.html}</span>`,
    timeTag(message.createdAt, "head", "ts"),
    renderForwards(message, ctx),
    renderEmbeds(message.embeds, mentions, ctx.resolveAsset),
    renderComponents(message.components, mentions, ctx.resolveAsset),
    renderTools(message),
    "</article>",
  ].join("");
}

function renderMessage(message: TranscriptMessage, ctx: RenderContext, compact: boolean): string {
  const ordinary = ORDINARY_TYPES.has(message.type);
  if (!ordinary && (!message.content || message.type === 4 || message.type === 18)) {
    return renderSystem(message, ctx);
  }
  const { mentions } = ctx.snapshot;
  const contextLine = renderInteraction(message, ctx) || renderReply(message, ctx);
  const edited = message.editedAt ? '<span class="edited">(edited)</span>' : "";
  const body = message.content
    ? `<div class="content">${renderDiscordMarkdown(message.content, mentions, ctx.resolveAsset)}${edited}</div>`
    : "";
  const classes = ["message", compact ? "compact" : "", contextLine ? "has-context" : ""].filter(Boolean).join(" ");
  return [
    `<article class="${classes}" id="message-${escapeHtml(message.id)}" data-author="${escapeHtml(message.author.id)}">`,
    contextLine,
    avatar(ctx.authors.get(message.author.id), message.author.displayName),
    `<h3 class="message-head"><span class="author"${colorStyle(message.author.color)}>${escapeHtml(message.author.displayName)}</span>${message.author.bot ? '<span class="app-tag">APP</span>' : ""}${timeTag(message.createdAt, "head", "ts")}</h3>`,
    timeTag(message.createdAt, "time", "hover-ts"),
    renderForwards(message, ctx),
    body,
    renderEmbeds(message.embeds, mentions, ctx.resolveAsset),
    renderComponents(message.components, mentions, ctx.resolveAsset),
    renderAttachments(message.attachments, ctx.resolveAsset),
    renderStickers(message.stickers, ctx.resolveAsset),
    renderReactions(message, ctx.resolveAsset),
    renderTools(message),
    "</article>",
  ].join("");
}

function renderMembers(authors: Map<string, AuthorEntry>): string {
  const groups = new Map<string, AuthorEntry[]>();
  for (const entry of authors.values()) {
    const group = entry.author.bot ? "Apps" : (entry.author.roleName ?? "Members");
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }
  const rank = (name: string) => (name === "Apps" ? 2 : name === "Members" ? 1 : 0);
  return [...groups.entries()]
    .sort(([left], [right]) => rank(left) - rank(right) || left.localeCompare(right))
    .map(
      ([name, entries]) =>
        `<div class="member-group"><div class="cap">${escapeHtml(name)} — ${entries.length}</div>${entries
          .map(
            (entry) =>
              `<div class="member">${avatar(entry, entry.author.displayName)}<div><b${colorStyle(entry.author.color)}>${escapeHtml(entry.author.displayName)}</b><small>${entry.messages} message${entry.messages === 1 ? "" : "s"}</small></div></div>`,
          )
          .join("")}</div>`,
    )
    .join("");
}

interface PageInfo {
  filename: string;
  first: number;
  last: number;
}

interface PageShell {
  snapshot: TranscriptSnapshot;
  resolveAsset: AssetResolver;
  avatarCss: string;
  members: string;
  participants: number;
  pages: PageInfo[];
}

function guildIcon(snapshot: TranscriptSnapshot, resolveAsset: AssetResolver): string {
  const source = snapshot.guildIconUrl ? safeHttpUrl(snapshot.guildIconUrl) : null;
  const rendered = source ? resolveAsset(source) : "";
  return rendered
    ? `<img class="guild-icon" src="${escapeHtml(rendered)}" alt="">`
    : `<span class="guild-icon" aria-hidden="true">${initial(snapshot.guildName)}</span>`;
}

function documentHtml(shell: PageShell, body: string, pageIndex: number): string {
  const { snapshot, pages } = shell;
  const channel = escapeHtml(snapshot.channelName);
  const first = snapshot.messages[0]?.createdAt;
  const last = snapshot.messages.at(-1)?.createdAt;
  const next = pages[pageIndex + 1];
  const partsHtml =
    pages.length > 1
      ? `<div><div class="cap">Parts</div><div class="parts">${pages
          .map(
            (page, index) =>
              `<a class="part${index === pageIndex ? " current" : ""}" href="${escapeHtml(page.filename)}"${index === pageIndex ? ' aria-current="page"' : ""}><span class="hash">#</span>Part ${index + 1}<small>${page.first + 1}–${page.last + 1}</small></a>`,
          )
          .join("")}</div></div>`
      : "";
  const fact = (label: string, value: string) => `<div class="fact"><span>${label}</span><span>${value}</span></div>`;
  const welcome =
    pageIndex === 0
      ? `<div class="welcome"><div class="welcome-icon" aria-hidden="true">#</div><h2>Welcome to #${channel}!</h2><p>This is the start of the <b>#${channel}</b> transcript. Visible state as of ${timeTag(snapshot.generatedAt, "full")}.</p></div>`
      : `<div class="welcome"><h2>#${channel}</h2><p>Part ${pageIndex + 1} of ${pages.length} · continues from <a href="${escapeHtml(pages[pageIndex - 1].filename)}">Part ${pageIndex}</a>.</p></div>`;
  const end = next
    ? `<div class="end">End of part ${pageIndex + 1} · continues in <a href="${escapeHtml(next.filename)}">Part ${pageIndex + 2}</a></div>`
    : '<div class="end">End of transcript</div>';
  const title = `#${snapshot.channelName} — ${snapshot.guildName}`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escapeHtml(title)}</title>${FONT_LINK}<style>${CSS}${shell.avatarCss}</style></head>
<body><div class="app">
<aside class="side info" aria-label="Transcript details"><div class="side-head">${guildIcon(snapshot, shell.resolveAsset)}<span>${escapeHtml(snapshot.guildName)}</span></div><div class="side-body">
<div><div class="cap">Transcript</div><div class="facts">${[
    fact("Channel", `#${channel}`),
    fact("Messages", String(snapshot.messages.length)),
    fact("Participants", String(shell.participants)),
    first ? fact("From", timeTag(first, "date")) : "",
    last ? fact("To", timeTag(last, "date")) : "",
    fact("Generated", timeTag(snapshot.generatedAt, "full")),
  ].join("")}</div></div>
${partsHtml}
<div><div class="cap">IDs</div><div class="facts">${fact("Channel", `<code>${escapeHtml(snapshot.channelId)}</code>`)}${fact("Server", `<code>${escapeHtml(snapshot.guildId)}</code>`)}</div></div>
</div></aside>
<main class="main"><header class="channel-head"><button type="button" class="icon-button info-toggle" data-toggle="show-info" aria-label="Show transcript details">${ICONS.menu}</button><span class="hash" aria-hidden="true">#</span><h1>${channel}</h1>${snapshot.channelTopic ? `<span class="topic" title="${escapeHtml(snapshot.channelTopic)}">${escapeHtml(snapshot.channelTopic)}</span>` : ""}<div class="head-tools"><label class="search"><input id="search" type="search" placeholder="Search" aria-label="Search this transcript"><span class="search-count"></span>${ICONS.search}</label><button type="button" class="icon-button members-toggle" data-toggle="show-members" aria-label="Show participants">${ICONS.members}</button></div></header>
<div class="scroller">${welcome}${body || '<div class="empty">This channel had no visible messages.</div>'}${end}</div>
<div class="composer">${ICONS.lock}Archived transcript · read only</div></main>
<aside class="side members" aria-label="Participants"><div class="side-head">Participants — ${shell.participants}</div><div class="side-body">${shell.members}</div></aside>
<div class="scrim"></div>
</div><script>${SCRIPT}</script></body></html>`;
}

function safeBase(filename: string): string {
  return filename.replace(/\.html?$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim() || "transcript";
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function renderTranscriptPages(
  snapshot: TranscriptSnapshot,
  assets: Map<string, string>,
  filename: string,
): Promise<RenderedTranscriptPage[]> {
  const embeddedResolver = resolveFrom(assets);
  const externalResolver: AssetResolver = (url) => {
    if (assets.has(url)) {
      return url;
    }
    try {
      const href = new URL(url).href;
      return assets.has(href) ? href : "";
    } catch {
      return "";
    }
  };
  const authors = collectAuthors(snapshot);
  const byId = new Map(snapshot.messages.map((message) => [message.id, message]));
  let avatars = avatarCss(authors, embeddedResolver);
  if (Buffer.byteLength(avatars, "utf8") > MAX_PAGE_BYTES / 4) {
    avatars = avatarCss(authors, externalResolver);
  }
  const members = renderMembers(authors);
  const budget =
    MAX_PAGE_BYTES - SHELL_RESERVE_BYTES - Buffer.byteLength(avatars, "utf8") - Buffer.byteLength(members, "utf8");

  const embeddedContext: RenderContext = { snapshot, resolveAsset: embeddedResolver, authors, byId };
  const externalContext: RenderContext = { ...embeddedContext, resolveAsset: externalResolver };
  const chunks: string[] = [];
  let previous: TranscriptMessage | undefined;

  for (const message of snapshot.messages) {
    if (chunks.length > 0 && chunks.length % 25 === 0) {
      await yieldToEventLoop();
    }
    const compact =
      previous !== undefined &&
      previous.author.id === message.author.id &&
      ORDINARY_TYPES.has(previous.type) &&
      !message.reply &&
      !message.interaction &&
      Date.parse(message.createdAt) - Date.parse(previous.createdAt) < GROUP_WINDOW_MS;
    let rendered = renderMessage(message, embeddedContext, compact);
    if (Buffer.byteLength(rendered, "utf8") > budget) {
      rendered = renderMessage(message, externalContext, compact);
    }
    chunks.push(rendered);
    previous = message;
  }

  const bodies: { html: string; first: number; last: number }[] = [];
  let body = "";
  let first = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const next = body + chunks[index];
    if (body && Buffer.byteLength(next, "utf8") > budget) {
      bodies.push({ html: body, first, last: index - 1 });
      body = chunks[index];
      first = index;
    } else {
      body = next;
    }
  }
  bodies.push({ html: body, first, last: Math.max(0, chunks.length - 1) });

  const base = safeBase(filename);
  const pages: PageInfo[] = bodies.map((entry, index) => ({
    filename: bodies.length === 1 ? `${base}.html` : `${base}-part-${index + 1}.html`,
    first: entry.first,
    last: entry.last,
  }));
  const shell: PageShell = {
    snapshot,
    resolveAsset: embeddedResolver,
    avatarCss: avatars,
    members,
    participants: authors.size,
    pages,
  };
  return bodies.map((entry, index) => ({
    filename: pages[index].filename,
    html: documentHtml(shell, entry.html, index),
    firstMessage: entry.first,
    lastMessage: entry.last,
  }));
}
