const KEY = "life-action-board-v2";
const SUPABASE_URL = "https://xmvvcebjglyyttlceicw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nEHf0fkntvsC_pzDyXqIUw_8vY_fS20";
const colors = { fortune: "#d4a83e", beauty: "#c7665b", soul: "#6f9673", admin: "#668bb3" };
const TIMELINE_HOUR_HEIGHT = 64;
let cloudClient=null, cloudUser=null, cloudReady=false, cloudTimer=null, cloudStatus="本机保存";
const defaults = {
  areas: [
    { id: "fortune", name: "Fortune", cn: "财富", icon: "▣", tasks: [{ id: 1, text: "整理本周收入目标", done: false }, { id: 2, text: "复盘一个增长机会", done: true }, { id: 3, text: "学习 30 分钟理财知识", done: false }] },
    { id: "beauty", name: "Beauty", cn: "美与身体", icon: "✎", tasks: [{ id: 4, text: "完成今日训练", done: true }, { id: 5, text: "记录饮食与饮水", done: false }, { id: 6, text: "晚间护肤", done: false }] },
    { id: "soul", name: "Soul", cn: "精神世界", icon: "◫", tasks: [{ id: 7, text: "阅读 20 页", done: false }, { id: 8, text: "写三行日记", done: true }, { id: 9, text: "无屏幕散步 20 分钟", done: false }] },
    { id: "admin", name: "Adimin", cn: "日常运营", icon: "⌘", tasks: [{ id: 10, text: "处理一个拖延杂事", done: false }, { id: 11, text: "整理桌面与文件", done: false }, { id: 12, text: "检查本周日程", done: true }] }
  ],
  projects: [
    { id: "p1", title: "财富系统搭建", area: "fortune", steps: [{ id: "p1s1", text: "明确目标", status: 2 }, { id: "p1s2", text: "收入盘点", status: 1 }, { id: "p1s3", text: "行动方案", status: 0 }, { id: "p1s4", text: "月末复盘", status: 0 }] },
    { id: "p2", title: "个人形象升级", area: "beauty", steps: [{ id: "p2s1", text: "风格定位", status: 2 }, { id: "p2s2", text: "衣橱整理", status: 1 }, { id: "p2s3", text: "清单补齐", status: 0 }, { id: "p2s4", text: "造型拍摄", status: 0 }] },
    { id: "p3", title: "灵魂滋养计划", area: "soul", steps: [{ id: "p3s1", text: "选择书目", status: 2 }, { id: "p3s2", text: "每日阅读", status: 1 }, { id: "p3s3", text: "摘录思考", status: 0 }, { id: "p3s4", text: "月度输出", status: 0 }] },
    { id: "p4", title: "生活清爽计划", area: "admin", steps: [{ id: "p4s1", text: "收集杂事", status: 2 }, { id: "p4s2", text: "分批处理", status: 0 }, { id: "p4s3", text: "建立清单", status: 0 }, { id: "p4s4", text: "每周清零", status: 0 }] }
  ],
  quick: [{ id: "q1", text: "确认今天最重要的一件事", status: 1, area: "fortune" }]
};

const FBS_PLAN_VERSION = 1;
const FBS_PLAN = {
  fortune: [
    { title:"上班", type:"habit", active:true, steps:["每日上班任务"] },
    { title:"英语教学", type:"target", active:true, steps:["思考制定学习思路与计划","考取雅思 8 分","积累教学经验","持续提升英语能力","成为独立老师"] },
    { title:"投资美股/外汇", type:"habit", active:false, steps:[] },
    { title:"AI 产品设计", type:"target", active:false, steps:[] }
  ],
  beauty: [
    { title:"健康", type:"habit", active:true, steps:["睡眠调理","颈椎操","皮肤管理","精神呵护","针灸","中医养生"] },
    { title:"减肥", type:"habit", active:true, steps:["过午不食","戒糖、少油少盐"] },
    { title:"美容", type:"habit", active:false, steps:[] },
    { title:"穿搭", type:"target", active:false, steps:[] }
  ],
  soul: [
    { title:"看书", type:"habit", active:true, steps:["读《猴面包树的书》"] },
    { title:"听音乐/播客", type:"habit", active:true, steps:["每日音乐 / 播客漫听"] },
    { title:"看电影", type:"habit", active:false, steps:[] },
    { title:"玩游戏", type:"habit", active:false, steps:[] },
    { title:"练字", type:"habit", active:false, steps:[] },
    { title:"古琴", type:"habit", active:false, steps:[] },
    { title:"画画", type:"habit", active:false, steps:[] },
    { title:"唱歌", type:"habit", active:false, steps:[] },
    { title:"舞蹈", type:"habit", active:false, steps:[] },
    { title:"运动", type:"habit", active:true, steps:["居家健身","爬坡","游泳","网球","滑雪","攀岩","拳击","冲浪"] },
    { title:"家居", type:"target", active:false, steps:[] },
    { title:"旅行", type:"target", active:true, steps:["Solo trip","北京周边 Staycation","去西北看大月亮","去沙漠看星空","朝圣之路"] },
    { title:"其他兴趣", type:"target", active:true, steps:["Vibe Coding","个人美甲","AI 视频创作","Drinks"] }
  ],
  admin: [
    { title:"备拍事项", type:"target", active:false, steps:[] },
    { title:"检查日程", type:"habit", active:true, steps:["定期整理灵感（From 小红书）","每月复盘启动事项及时间安排"] }
  ]
};

function applyFbsPlan(targetState){
  if(!targetState?.areas||targetState.fbsPlanVersion>=FBS_PLAN_VERSION)return false;
  const simplify=text=>String(text||"").replace(/[\s/·*《》]/g,"").toLowerCase();
  const aliases={"上班":["工作任务"],"英语教学":["雅思教学"],"健康":["健康管理"],"减肥":["减肥塑形"],"看书":["读书"],"运动":["运动户外"],"旅行":["旅行探索"]};
  Object.entries(FBS_PLAN).forEach(([areaId,directions])=>{
    const area=targetState.areas.find(a=>a.id===areaId);if(!area)return;
    if(!Array.isArray(area.tasks))area.tasks=[];
    directions.forEach((direction,index)=>{
      const names=[direction.title,...(aliases[direction.title]||[])].map(simplify);
      let task=area.tasks.find(t=>names.includes(simplify(t.text)));
      if(!task){
        task={id:`fbs-${areaId}-${index}`,text:direction.title,status:direction.active?1:0,steps:[]};
        area.tasks.push(task);
      }
      task.text=direction.title;
      task.projectType=direction.type;
      if(!Number.isFinite(task.checkins))task.checkins=0;
      if(!Number.isFinite(task.habitGoal))task.habitGoal=30;
      if(!Array.isArray(task.steps))task.steps=[];
      direction.steps.forEach((text,stepIndex)=>{
        if(!task.steps.some(s=>simplify(s.text)===simplify(text)))task.steps.push({id:`fbs-${areaId}-${index}-${stepIndex}`,text,status:0,repeat:"none",notes:"",subtasks:[]});
      });
    });
  });
  targetState.fbsPlanVersion=FBS_PLAN_VERSION;
  return true;
}

let state;
let timelineInitialized=false;
let timelineClockTimer=null;
try { state = JSON.parse(localStorage.getItem(KEY)) || structuredClone(defaults); } catch { state = structuredClone(defaults); }
applyFbsPlan(state);
state.areas.forEach(a => { if (a.id === "life") a.id = "admin"; if (a.id === "admin") a.name = "Adimin"; });
state.projects.forEach(p => { if (p.area === "life") p.area = "admin"; });
state.projects.forEach(p=>{if(!["target","habit"].includes(p.projectType))p.projectType="target";if(!Number.isFinite(p.checkins))p.checkins=0;if(!Number.isFinite(p.habitGoal))p.habitGoal=30;});
state.quick.forEach(q => { if (q.area === "life") q.area = "admin"; });
state.areas.forEach(a => a.tasks.forEach(t => { if (typeof t.status !== "number") t.status = t.done ? 2 : 0; delete t.done; }));
state.areas.forEach(a=>a.tasks.forEach(t=>{if(t.status===2)t.status=1;}));
state.areas.forEach(a => a.tasks.forEach(t => { if (!Array.isArray(t.steps)) t.steps = []; }));
if (!Array.isArray(state.projectOrder)) state.projectOrder = [];
if (!Array.isArray(state.todoOrder)) state.todoOrder = [];
if (!["category","time","manual"].includes(state.todoSortMode)) state.todoSortMode = "manual";
if (!Array.isArray(state.activityLog)) state.activityLog = [];
state.areas.forEach(a=>a.tasks.forEach(t=>{if(!["target","habit"].includes(t.projectType))t.projectType="target";if(!Number.isFinite(t.checkins))t.checkins=0;if(!Number.isFinite(t.habitGoal))t.habitGoal=30;}));
function normalizeRepeat(item){if(!item.repeat)item.repeat="none";if(!Number.isFinite(item.repeatInterval))item.repeatInterval=2;if(!Array.isArray(item.repeatWeekdays))item.repeatWeekdays=[];if(!item.notes)item.notes="";if(!Array.isArray(item.subtasks))item.subtasks=[];}
state.quick.forEach(normalizeRepeat);
state.projects.forEach(p=>p.steps.forEach(normalizeRepeat));
state.areas.forEach(a=>a.tasks.forEach(t=>t.steps.forEach(normalizeRepeat)));
state.quick.forEach(normalizeSubtasks);state.projects.forEach(p=>p.steps.forEach(normalizeSubtasks));state.areas.forEach(a=>a.tasks.forEach(t=>t.steps.forEach(normalizeSubtasks)));
// 每次打开页面默认回到当天；用户本次使用期间仍可自由切换日期。
state.viewDate=localDateISO(new Date());
localStorage.setItem(KEY, JSON.stringify(state));
const $ = s => document.querySelector(s);
const save = () => { localStorage.setItem(KEY, JSON.stringify(state)); render(); scheduleCloudSave(); };
const pct = items => items.length ? Math.round(items.filter(x => x.status === 2).length / items.length * 100) : 0;
const statusText = s => ["未做", "在做", "已完成"][s];
const domainStatusText = s => ["计划中", "推进中"][s];
const allSteps = () => state.projects.flatMap(p=>p.steps.map(s=>({...s,project:p.title,area:p.area,sourceKey:`pstep:${s.id}`})))
  .concat(state.areas.flatMap(a=>a.tasks.flatMap(t=>t.steps.map(s=>({...s,project:t.text,area:a.id,sourceKey:`astep:${s.id}`})))))
  .concat(state.quick.map(q => ({...q, project:q.sourceProject||"独立待办", sourceKey:`quick:${q.id}`})));
// 将此前重复任务已经保存的完成日期补入行动记录，旧努力也尽量保留下来。
allSteps().forEach(item=>(item.completions||[]).forEach(date=>{if(!state.activityLog.some(x=>x.key===item.sourceKey&&x.date===date))state.activityLog.push({id:`legacy-${item.sourceKey}-${date}`,key:item.sourceKey,date,text:item.text||"完成任务",area:item.area,completedAt:`${date}T23:59:00`});}));
localStorage.setItem(KEY, JSON.stringify(state));

function sourceItem(key) {
  const [type,...rest]=String(key).split(":"); const id=rest.join(":");
  if(type==="pstep") return state.projects.flatMap(p=>p.steps).find(s=>String(s.id)===id);
  if(type==="atask") return state.areas.flatMap(a=>a.tasks).find(t=>String(t.id)===id);
  if(type==="astep") return findAreaProjectStep(id)?.step;
  if(type==="quick") return state.quick.find(q=>String(q.id)===id);
}

function normalizeSubtasks(item){item.subtasks=(item.subtasks||[]).map((s,i)=>typeof s==="string"?{id:`sub${Date.now()}${i}`,text:s,done:false}:s);}
function updateCloudButton(){const button=$("#cloudAccount");if(!button)return;button.classList.toggle("connected",!!cloudUser);button.classList.toggle("syncing",cloudStatus==="同步中");button.querySelector("span").textContent=cloudUser?`${cloudStatus} · ${cloudUser.email||"已登录"}`:"登录并同步";}
function scheduleCloudSave(){if(!cloudReady||!cloudUser||!cloudClient)return;clearTimeout(cloudTimer);cloudStatus="等待同步";updateCloudButton();cloudTimer=setTimeout(pushCloudState,700);}
async function pushCloudState(){if(!cloudReady||!cloudUser)return;cloudStatus="同步中";updateCloudButton();const {error}=await cloudClient.from("user_boards").upsert({user_id:cloudUser.id,data:state,updated_at:new Date().toISOString()},{onConflict:"user_id"});cloudStatus=error?"同步失败":"已同步";updateCloudButton();if(error)console.error("Cloud sync failed",error.message);}
async function loadCloudState(){if(!cloudUser)return;cloudStatus="同步中";updateCloudButton();const {data,error}=await cloudClient.from("user_boards").select("data").eq("user_id",cloudUser.id).maybeSingle();if(error){cloudStatus="需要初始化数据库";updateCloudButton();return;}if(data?.data?.areas){state=data.data;if(!Array.isArray(state.activityLog))state.activityLog=[];if(!Array.isArray(state.todoOrder))state.todoOrder=[];if(!["category","time","manual"].includes(state.todoSortMode))state.todoSortMode="manual";state.projects.forEach(p=>{if(!["target","habit"].includes(p.projectType))p.projectType="target";if(!Number.isFinite(p.checkins))p.checkins=0;if(!Number.isFinite(p.habitGoal))p.habitGoal=30;p.steps.forEach(normalizeRepeat);});state.areas.forEach(a=>a.tasks.forEach(t=>{if(!["target","habit"].includes(t.projectType))t.projectType="target";if(!Number.isFinite(t.checkins))t.checkins=0;if(!Number.isFinite(t.habitGoal))t.habitGoal=30;(t.steps||[]).forEach(normalizeRepeat);}));state.quick.forEach(normalizeRepeat);state.viewDate=localDateISO(new Date());timelineInitialized=false;localStorage.setItem(KEY,JSON.stringify(state));cloudReady=true;render();cloudStatus="已同步";updateCloudButton();}else{cloudReady=true;await pushCloudState();}}
async function initCloud(){if(!window.supabase?.createClient){cloudStatus="云服务未加载";updateCloudButton();return;}cloudClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);const {data}=await cloudClient.auth.getSession();cloudUser=data.session?.user||null;updateCloudButton();if(cloudUser)await loadCloudState();cloudClient.auth.onAuthStateChange(async(_event,session)=>{cloudUser=session?.user||null;cloudReady=false;updateCloudButton();if(cloudUser)await loadCloudState();});}
function openCloudAccount(){if(cloudUser){$("#modalBody").innerHTML=`<div class="modal-head cloud-modal-head"><span>CLOUD SYNC</span><h2>云端同步</h2><p>${escapeHtml(cloudUser.email||"")} · ${cloudStatus}</p></div><div class="cloud-actions"><button type="button" data-cloud-sync>立即同步</button><button type="button" class="secondary" data-cloud-signout>退出登录</button></div>`;}else{$("#modalBody").innerHTML=`<div class="modal-head cloud-modal-head"><span>CLOUD SYNC</span><h2>登录同步</h2><p>使用同一个邮箱账号，即可在电脑和手机之间同步看板。</p></div><div class="cloud-form"><label><span>邮箱</span><input id="cloudEmail" type="email" autocomplete="email" placeholder="your@email.com"></label><label><span>密码</span><input id="cloudPassword" type="password" autocomplete="current-password" placeholder="至少 6 位密码"></label><div><button type="button" data-cloud-signin>登录</button><button type="button" class="secondary" data-cloud-signup>注册</button></div><small id="cloudMessage"></small></div>`;}if(!$("#modal").open)$("#modal").showModal();}
async function cloudAuth(mode){const email=$("#cloudEmail").value.trim(),password=$("#cloudPassword").value,message=$("#cloudMessage");if(!email||password.length<6){message.textContent="请输入有效邮箱和至少 6 位密码";return;}message.textContent="处理中…";const result=mode==="signup"?await cloudClient.auth.signUp({email,password}):await cloudClient.auth.signInWithPassword({email,password});if(result.error){message.textContent=result.error.message;return;}if(mode==="signup"&&!result.data.session){message.textContent="注册成功，请检查邮箱确认后再登录。";}else{$("#modal").close();}}
function localDateISO(date){const d=new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function shiftDate(date,days){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return localDateISO(d);}
function weekdayText(date){return `周${["日","一","二","三","四","五","六"][new Date(`${date}T12:00:00`).getDay()]}`;}
function isAnytime(todo,date=state.viewDate){const hasExactTime=Boolean(todo.scheduledHour||(todo.due?.includes("T")&&todo.due.slice(11,16))),dateValue=taskDate(todo),repeating=todo.repeat&&todo.repeat!=="none";return todo.status===1&&!hasExactTime&&(!dateValue||dateValue===date||(repeating&&occursOn(todo,date)));}
function occursOn(todo,date){
  if(todo.status===2)return false;
  const today=localDateISO(new Date());
  const base=todo.due?.slice(0,10)||todo.scheduledDate||today;
  if(date<base)return false;
  if((todo.completions||[]).includes(date))return false;
  // 单次任务只在原定日期出现；只有原定日期真正过完后，才作为遗留待办进入后续日期。
  if(!todo.repeat||todo.repeat==="none")return date===base||(base<today&&date>base);
  const d=new Date(`${date}T12:00:00`),b=new Date(`${base}T12:00:00`);
  if(todo.repeat==="daily")return true;
  if(todo.repeat==="weekdays")return d.getDay()>0&&d.getDay()<6;
  if(todo.repeat==="weekly")return d.getDay()===b.getDay();
  if(todo.repeat==="monthly")return d.getDate()===b.getDate();
  if(todo.repeat==="customDays")return Math.floor((d-b)/86400000)%Math.max(1,todo.repeatInterval||2)===0;
  if(todo.repeat==="customWeekdays")return (todo.repeatWeekdays||[]).map(Number).includes(d.getDay());
  return false;
}

function render() {
  if(applyFbsPlan(state)){localStorage.setItem(KEY,JSON.stringify(state));scheduleCloudSave();}
  const all=allSteps(), anytime=all.filter(x=>isAnytime(x,state.viewDate));
  const steps = all.filter(x=>occursOn(x,state.viewDate)&&!isAnytime(x,state.viewDate));
  const counts = [0,1,2].map(n => steps.filter(x => x.status === n).length);
  const scheduledCount = steps.filter(x => x.status === 1 && isTaskScheduled(x,state.viewDate)).length;
  const completedCount = state.activityLog.filter(x=>x.date===state.viewDate).length;
  $("#dateLabel").innerHTML=`<span class="date-nav"><button class="date-arrow" data-date-shift="-1" aria-label="前一天">‹</button><label class="date-core"><span class="date-display">${state.viewDate.replaceAll("-","/")} ${weekdayText(state.viewDate)}</span><input id="calendarDate" type="date" value="${state.viewDate}" aria-label="选择日期"></label><button class="date-arrow" data-date-shift="1" aria-label="后一天">›</button></span><button class="date-today" data-date-today>今天</button>`;
  $("#statDoing").textContent = counts[1]; $("#statScheduled").textContent = scheduledCount; $("#statDone").textContent = completedCount;
  $("#sideDone").textContent = completedCount; $("#sideDoing").textContent = counts[1];
  $("#loadTime").textContent = `${counts[1]} 项进行中`;
  const isToday=state.viewDate===localDateISO(new Date());
  $(".focus-panel h2").textContent = isToday?"今日待办":"当日待办";
  $(".timeline-panel h2").textContent = isToday?"今日时间轴":"当日时间轴";
  $(".projects-panel h2").textContent = "目标与习惯";
  $("[data-add='quick']").textContent = "＋ 添加待办";
  $("#todoSortMode").value=state.todoSortMode;
  $("#sideAreas").innerHTML = state.areas.map(a => `<p><i class="dot" style="background:${colors[a.id]}"></i>${a.name}<b>${a.tasks.filter(t=>t.status===1).length}</b></p>`).join("");
  $(".side-projects-summary h4").textContent="目标与习惯";
  const sideProjects=state.projects.map(p=>({key:`p:${p.id}`,name:p.title,area:p.area,type:p.projectType||"target",done:p.steps.filter(s=>s.status===2).length,total:p.steps.length,checkins:p.checkins||0})).concat(state.areas.flatMap(a=>a.tasks.filter(t=>t.status===1).map(t=>({key:`a:${t.id}`,name:t.text,area:a.id,type:t.projectType||"target",done:t.steps.filter(s=>s.status===2).length,total:t.steps.length,checkins:t.checkins||0}))));
  const sideRank=new Map(state.projectOrder.map((key,index)=>[key,index]));sideProjects.sort((a,b)=>(sideRank.get(a.key)??9999)-(sideRank.get(b.key)??9999));
  const sideGroup=(type,title)=>{const rows=sideProjects.filter(p=>p.type===type);return `<section class="side-project-group side-${type}-group"><header><span>${title}</span><b>${rows.length}</b></header>${rows.length?rows.map(p=>`<button type="button" class="side-project-${p.type}" data-side-project="${p.key}" title="${escapeHtml(p.name)}"><i class="dot" style="--c:${colors[p.area]||colors.admin}"></i><span>${escapeHtml(p.name)}</span><b>${p.type==="habit"?`${p.checkins}次`:`${p.done}/${p.total}`}</b></button>`).join(""):`<small>暂无${title}</small>`}</section>`;};
  $("#sideProjects").innerHTML=sideProjects.length?sideGroup("target","目标")+sideGroup("habit","习惯"):`<small>暂无目标或习惯</small>`;
  $(".areas-panel h2").textContent="人生版图";
  $(".areas-panel header small").textContent="直接看见每个领域正在经营什么";
  $(".areas-panel header>span").textContent="长期方向 · 当前重点 · 持续投入";
  $(".signals-panel h2").textContent="数据概览";
  renderTimeline(steps); renderFocus(steps,anytime); renderProjects(); renderAreas(); renderSignals(steps);
  $(".refine-head")?.remove(); $("#refineList")?.remove();
}

function renderTimeline(steps) {
  const active = steps.filter(x => x.status === 1 && x.scheduledHour && isTaskScheduled(x,state.viewDate));
  const layout=new Map();
  const intervals=active.map(item=>{const start=Number(item.scheduledHour.slice(0,2))*60+Number(item.scheduledHour.slice(3));return {item,start,end:start+(item.duration||1)*60,col:0};}).sort((a,b)=>a.start-b.start||a.end-b.end);
  let cluster=[];
  const finishCluster=()=>{if(!cluster.length)return;const lanes=[];cluster.forEach(entry=>{let col=lanes.findIndex(end=>end<=entry.start);if(col<0)col=lanes.length;lanes[col]=entry.end;entry.col=col;});const cols=Math.max(1,lanes.length);cluster.forEach(entry=>layout.set(entry.item.sourceKey,{col:entry.col,cols}));cluster=[];};
  intervals.forEach(entry=>{const clusterEnd=cluster.length?Math.max(...cluster.map(x=>x.end)):-1;if(cluster.length&&entry.start>=clusterEnd)finishCluster();cluster.push(entry);});finishCluster();
  const hours = Array.from({length:24},(_,hour)=>`${String(hour).padStart(2,"0")}:00`);
  $("#timeline").innerHTML = hours.map(h => {
    const items=active.filter(x=>x.scheduledHour===h);
    const cards=items.map(item=>{const duration=item.duration||1,timing=timelineTaskTiming(h,duration),note=item.notes?`<small class="timeline-note">${escapeHtml(item.notes)}</small>`:"",lane=layout.get(item.sourceKey)||{col:0,cols:1};return `<article class="time-task parallel ${timing.className} ${item.notes?"has-note":"no-note"}" draggable="true" data-todo-key="${item.sourceKey}" style="--c:${colors[item.area] || colors.admin};--duration:${duration};--lane-left:${lane.col/lane.cols*100}%;--lane-width:${100/lane.cols}%" data-timeline-key="${item.sourceKey}"><button class="timeline-complete" data-complete-action="${item.sourceKey}" aria-label="完成日程"><i></i></button><button class="timeline-task-main" data-edit-action="${item.sourceKey}"><i></i><span><b>${escapeHtml(item.text)}${timing.label?`<em class="timeline-status">${timing.label}</em>`:""}</b><small>${escapeHtml(item.project)} · ${h}–${formatEndTime(h,duration)} · ${duration}h</small>${note}</span></button><span class="resize-handle" data-resize-key="${item.sourceKey}" title="上下拖动调整时长"><i></i></span></article>`;}).join("");
    return `<div class="time-row timeline-drop" data-hour="${h}"><time>${h}</time>${cards?`<div class="timeline-lanes">${cards}</div>`:`<span class="drop-hint">拖入待办</span>`}</div>`;
  }).join("")+`<div id="nowMarker" class="now-marker" hidden><time></time><i></i></div>`;
  updateNowMarker();clearInterval(timelineClockTimer);timelineClockTimer=setInterval(()=>{updateNowMarker();if(state.viewDate===localDateISO(new Date()))renderTimeline(allSteps().filter(x=>occursOn(x,state.viewDate)));},60000);
  if(!timelineInitialized){const now=new Date(),isToday=state.viewDate===localDateISO(now),position=isToday?(now.getHours()+now.getMinutes()/60)*TIMELINE_HOUR_HEIGHT-160:8*TIMELINE_HOUR_HEIGHT;$("#timeline").scrollTop=Math.max(0,position);timelineInitialized=true;}
}

function timelineTaskTiming(start,duration){
  if(state.viewDate!==localDateISO(new Date()))return {className:"",label:""};
  const now=new Date(),current=now.getHours()*60+now.getMinutes(),begin=Number(start.slice(0,2))*60+Number(start.slice(3)),end=begin+duration*60;
  if(current>end)return {className:"timeline-overdue",label:"已超时"};
  if(current>=begin&&end-current<=30)return {className:"timeline-active",label:"进行中"};
  if(current>=begin)return {className:"timeline-active",label:"进行中"};
  if(begin-current<=30&&begin-current>=0)return {className:"timeline-upcoming",label:"即将开始"};
  return {className:"",label:""};
}

function updateNowMarker(){
  const marker=$("#nowMarker");if(!marker)return;
  const now=new Date(),isToday=state.viewDate===localDateISO(now);marker.hidden=!isToday;if(!isToday)return;
  const minutes=now.getHours()*60+now.getMinutes(),hourHeight=$("#timeline .time-row")?.getBoundingClientRect().height||TIMELINE_HOUR_HEIGHT;marker.style.top=`${minutes/60*hourHeight}px`;marker.querySelector("time").textContent=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
}

function formatEndTime(start,duration){ const total=Number(start.slice(0,2))*60+Number(start.slice(3))+duration*60; return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; }

function taskDate(todo){return todo.due?.slice(0,10)||todo.scheduledDate||"";}
function isCarriedOver(todo,date=state.viewDate){const base=taskDate(todo),today=localDateISO(new Date());return (!todo.repeat||todo.repeat==="none")&&Boolean(base)&&base<today&&date>base;}
// 只有设置了具体执行时间、真正进入时间轴，才算“已安排”。
function isTaskScheduled(todo,date=state.viewDate){if(isCarriedOver(todo,date))return false;return Boolean(todo.scheduledHour||(todo.due?.includes("T")&&todo.due.slice(11,16)));}
function isTaskOverdue(todo,date=state.viewDate){
  if(todo.status!==1)return false;
  if(isCarriedOver(todo,date))return true;
  if(!isTaskScheduled(todo,date))return false;
  const dueDate=taskDate(todo),today=localDateISO(new Date());
  const repeating=todo.repeat&&todo.repeat!=="none";
  if(date!==today)return false;
  if(!repeating&&dueDate!==today)return false;
  const time=todo.due?.includes("T")?todo.due.slice(11,16):todo.scheduledHour;
  if(!time)return false;
  const now=new Date(),current=now.getHours()*60+now.getMinutes();
  const end=Number(time.slice(0,2))*60+Number(time.slice(3))+(todo.duration||1)*60;
  return current>end;
}

function sortTodos(items){
  const rank=new Map(state.todoOrder.map((key,index)=>[key,index]));
  const doing=items.filter(x=>x.status===1);
  if(state.todoSortMode==="category"){
    const areaRank={fortune:0,beauty:1,soul:2,admin:3};
    doing.sort((a,b)=>(areaRank[a.area]??9)-(areaRank[b.area]??9)||(a.project||"").localeCompare(b.project||"","zh-CN")||(a.text||"").localeCompare(b.text||"","zh-CN"));
  }else if(state.todoSortMode==="time"){
    const timeKey=x=>isTaskScheduled(x,state.viewDate)?(x.scheduledHour||(x.due?.includes("T")?x.due.slice(11,16):"23:59")):"99:99";
    doing.sort((a,b)=>timeKey(a).localeCompare(timeKey(b))||(a.text||"").localeCompare(b.text||"","zh-CN"));
  }else doing.sort((a,b)=>(rank.get(a.sourceKey)??9999)-(rank.get(b.sourceKey)??9999));
  state.todoOrder=state.todoSortMode==="manual"?[...new Set([...doing.map(x=>x.sourceKey),...state.todoOrder])]:[...new Set([...state.todoOrder,...doing.map(x=>x.sourceKey)])];
  return doing;
}

function todoCardHtml(x,inAnytime=false){
    const overdue=isTaskOverdue(x),unscheduled=!isTaskScheduled(x,state.viewDate);
    const alert=overdue?`<em class="todo-alert overdue-alert">! 已逾期</em>`:unscheduled&&!inAnytime?`<em class="todo-alert unscheduled-alert">待排期</em>`:"";
    return `<article class="focus-item todo-card ${overdue?"is-overdue":unscheduled?"is-unscheduled":""}" draggable="true" data-todo-key="${x.sourceKey}" style="--c:${colors[x.area] || colors.admin}"><div class="todo-card-top"><span class="todo-grip" title="拖拽排序或安排时间">⠿</span><button class="todo-check" data-complete-action="${x.sourceKey}" aria-label="完成待办"><i></i></button><button class="todo-main" data-edit-action="${x.sourceKey}"><span><span class="todo-title-line"><b>${escapeHtml(x.text)}</b>${alert}</span><small>${todoMeta(x)}</small></span></button><button class="todo-delete" data-delete-todo="${x.sourceKey}" aria-label="删除待办">×</button></div>${x.notes?`<button class="todo-note" data-edit-action="${x.sourceKey}"><i>备注</i><span>${escapeHtml(x.notes)}</span></button>`:""}${x.subtasks?.length?`<div class="todo-subtasks"><div class="todo-subtasks-head"><span>子任务</span><b>${x.subtasks.filter(s=>s.done).length}/${x.subtasks.length}</b></div>${x.subtasks.map(s=>`<button class="todo-subtask ${s.done?"done":""}" data-toggle-subtask="${x.sourceKey}" data-subtask-id="${s.id}"><i>${s.done?"✓":""}</i><span>${escapeHtml(s.text)}</span></button>`).join("")}</div>`:""}</article>`;
}

function renderFocus(steps,anytime){
  const day=sortTodos(steps),floating=sortTodos(anytime),dayLabel=state.viewDate===localDateISO(new Date())?"今日待办":"当日待办";
  const group=(title,items,kind,isFloating=false)=>`<section class="todo-group ${kind}"><header><b>${title}</b><span>${items.length}</span></header>${items.length?items.map(x=>todoCardHtml(x,isFloating)).join(""):`<div class="todo-group-empty">暂无事项</div>`}</section>`;
  $("#focusList").innerHTML=group(dayLabel,day,"day-todos")+group("随时待办",floating,"anytime-todos",true);
}

function repeatLabel(todo){if(todo.repeat==="customDays")return `每 ${todo.repeatInterval||2} 天`;if(todo.repeat==="customWeekdays")return (todo.repeatWeekdays||[]).map(n=>`周${["日","一","二","三","四","五","六"][n]}`).join("、");return {daily:"每天",weekdays:"工作日",weekly:"每周",monthly:"每月"}[todo.repeat];}
function todoMeta(todo){const bits=[];bits.push(todo.project||todo.sourceProject||"独立待办");if(isCarriedOver(todo,state.viewDate))bits.push(`原定 ${taskDate(todo)} · 待重新安排`);else bits.push(todo.due?todo.due.replace("T"," "):todo.scheduledHour||"未安排时间");if(todo.repeat&&todo.repeat!=="none")bits.push(repeatLabel(todo));if(todo.subtasks?.length)bits.push(`${todo.subtasks.filter(s=>s.done).length}/${todo.subtasks.length} 子任务`);return bits.join(" · ");}

function projectMetric(project){if(project.projectType==="habit"){const count=project.checkins||0;return {html:`<strong class="habit-total"><span>累计</span><b>${count}</b><em>次</em></strong>`,width:0,kind:"习惯"};}const progress=pct(project.steps);return {html:`<strong>${progress}%</strong>`,width:progress,kind:"目标"};}

function renderProjects() {
  const items = state.projects.map(p => ({ key:`p:${p.id}`, type:"project", data:p }))
    .concat(state.areas.flatMap(a => a.tasks.filter(t=>t.status===1).map(t => ({ key:`a:${t.id}`, type:"area", data:t, area:a }))));
  const rank = new Map(state.projectOrder.map((key,index)=>[key,index]));
  items.sort((a,b)=>(rank.get(a.key)??9999)-(rank.get(b.key)??9999));
  state.projectOrder = [...new Set([...items.map(x=>x.key), ...state.projectOrder])];
  const cardHtml = item => {
    if (item.type === "project") {
      const p=item.data, metric=projectMetric(p);
      const done=p.steps.filter(s=>s.status===2).length,total=p.steps.length,value=p.projectType==="habit"?(p.checkins||0):done,progressLabel=p.projectType==="habit"?"持续积累":`${value}/${total}`;
      return `<article class="project-card project-summary-card classic-project-card ${p.projectType==="habit"?"habit-project":"target-project"}" data-order-key="${item.key}" style="--c:${colors[p.area]}"><span class="drag-handle" draggable="true" data-drag-key="${item.key}" title="拖拽调整顺序">⠿</span><div class="project-title"><b>${escapeHtml(p.title)}</b>${metric.html}</div><div class="project-source"><i>${metric.kind}</i> · ${state.areas.find(a=>a.id===p.area)?.name||p.area}</div><div class="progress project-emphasis-progress"><i style="width:${metric.width}%"></i><b>${progressLabel}</b></div><button class="project-edit" data-project="${p.id}" aria-label="查看${escapeHtml(p.title)}详情"></button></article>`;
    }
    const t=item.data, a=item.area, metric=projectMetric(t);
    const done=t.steps.filter(s=>s.status===2).length,total=t.steps.length,value=t.projectType==="habit"?(t.checkins||0):done,progressLabel=t.projectType==="habit"?"持续积累":`${value}/${total}`;
    return `<article class="project-card project-summary-card classic-project-card ${t.projectType==="habit"?"habit-project":"target-project"}" data-order-key="${item.key}" style="--c:${colors[a.id]}"><span class="drag-handle" draggable="true" data-drag-key="${item.key}" title="拖拽调整顺序">⠿</span><div class="project-title"><b>${escapeHtml(t.text)}</b>${metric.html}</div><div class="project-source"><i>${metric.kind}</i> · ${a.name}</div><div class="progress project-emphasis-progress"><i style="width:${metric.width}%"></i><b>${progressLabel}</b></div><button class="project-edit" data-area-project="${t.id}" aria-label="查看${escapeHtml(t.text)}详情"></button></article>`;
  };
  const group=(type,title,caption)=>{const groupItems=items.filter(item=>(item.data.projectType||"target")===type);return `<section class="project-type-group ${type}-group"><header><div><b>${title}</b><small>${caption}</small></div><span>${groupItems.length}</span></header><div class="project-type-grid">${groupItems.length?groupItems.map(cardHtml).join(""):`<div class="project-group-empty">暂无${title}</div>`}</div></section>`;};
  $("#projectGrid").innerHTML = group("target","目标进展","看结果与下一步")+group("habit","习惯打卡","看累计投入，不以完成消失");
}

function renderAreas() {
  $("#areaGrid").innerHTML = state.areas.map(a => {
    const active=a.tasks.filter(t=>t.status===1).length,total=a.tasks.length,ratio=total?Math.round(active/total*100):0;
    return `<button class="area-card area-plan-card area-summary-only no-area-progress" data-area="${a.id}" style="--c:${colors[a.id]}"><div class="area-card-head"><i class="area-icon area-icon-${a.id}"><span></span></i><span><b>${a.name}</b><small>${a.cn}</small></span></div><div class="area-active-summary"><i></i><b>${active} 项推进中</b></div><footer><span>共 ${total} 个长期方向</span><b>查看详情</b></footer><span class="ring" style="--p:${ratio*3.6}deg"></span></button>`;
  }).join("");
}

function renderSignals(steps) {
  const targets=state.projects.filter(p=>p.projectType!=="habit"),projectAverage=targets.length?Math.round(targets.reduce((n,p)=>n+pct(p.steps),0)/targets.length):0;
  const habits=state.projects.filter(p=>p.projectType==="habit").reduce((n,p)=>n+(p.checkins||0),0)+state.areas.flatMap(a=>a.tasks).filter(t=>t.projectType==="habit").reduce((n,t)=>n+(t.checkins||0),0);
  const selectedDone=state.activityLog.filter(x=>x.date===state.viewDate).length,rows=[["今",selectedDone,"当日完成"],["目",`${projectAverage}%`,"目标平均进度"],["习",habits,"累计习惯打卡"],["开",allSteps().filter(x=>x.status===1).length,"开放任务"]];
  $(".signals-panel h2").textContent="数据概览";$(".signals-panel header span").textContent=`${state.viewDate.replaceAll("-","/")} ${weekdayText(state.viewDate)}`;
  $("#signals").innerHTML=rows.map(r=>`<div><i>${r[0]}</i><span><b>${r[1]}</b><small>${r[2]}</small></span></div>`).join("");
}

function habitContextForItem(todo){const project=state.projects.find(p=>p.steps.includes(todo));if(project?.projectType==="habit")return {owner:project,area:project.area};for(const area of state.areas){const task=area.tasks.find(t=>t.steps?.includes(todo));if(task?.projectType==="habit")return {owner:task,area:area.id};}return null;}
function completeTodo(key){
  const todo=sourceItem(key);if(!todo)return;
  const date=state.viewDate||localDateISO(new Date());
  const habit=habitContextForItem(todo);
  if(habit){habit.owner.checkins=(habit.owner.checkins||0)+1;todo.status=1;}else if(todo.repeat&&todo.repeat!=="none"){if(!Array.isArray(todo.completions))todo.completions=[];if(!todo.completions.includes(date))todo.completions.push(date);}else todo.status=2;
  if(!Array.isArray(state.activityLog))state.activityLog=[];
  if(habit||!state.activityLog.some(x=>x.key===key&&x.date===date))state.activityLog.push({id:`log${Date.now()}`,key:habit?`habit:${habit.owner.id}:${key}:${Date.now()}`:key,date,text:habit?`${habit.owner.text||habit.owner.title} · ${todo.text}`:todo.text||"完成任务",area:habit?.area||actionContext(key).area,completedAt:new Date().toISOString()});
  // 先持久化，再播放清晰的完成反馈，最后统一刷新待办与时间轴。
  localStorage.setItem(KEY,JSON.stringify(state));scheduleCloudSave();
  const remaining=allSteps().filter(x=>occursOn(x,date)&&x.status===1&&!isAnytime(x,date));
  $("#statDoing").textContent=remaining.length;
  $("#statScheduled").textContent=remaining.filter(x=>isTaskScheduled(x,date)).length;
  $("#statDone").textContent=state.activityLog.filter(x=>x.date===date).length;
  $("#sideDoing").textContent=remaining.length;$("#sideDone").textContent=state.activityLog.filter(x=>x.date===date).length;
  $("#loadTime").textContent=`${remaining.length} 项进行中`;
  const cards=[...document.querySelectorAll("[data-todo-key]")].filter(el=>el.dataset.todoKey===key);
  cards.forEach(el=>el.classList.add("completing"));
  setTimeout(render,520);
}

function cycleStep(id) {
  let changed,habitOwner,habitArea;
  for (const p of state.projects) { const s=p.steps.find(x=>x.id===id); if(s){if(p.projectType==="habit"&&s.status===1){p.checkins=(p.checkins||0)+1;s.status=1;habitOwner=p;habitArea=p.area;}else s.status=(s.status+1)%3;changed=s;break;} }
  if (!changed) { const t=state.areas.flatMap(a=>a.tasks).find(x=>String(x.id)===String(id)); if(t){ t.status=(t.status+1)%3; changed=t; } }
  if (!changed) { const found=findAreaProjectStep(id); if(found){if(found.task.projectType==="habit"&&found.step.status===1){found.task.checkins=(found.task.checkins||0)+1;found.step.status=1;habitOwner=found.task;habitArea=found.area.id;}else found.step.status=(found.step.status+1)%3;changed=found.step; } }
  if (!changed) { const q=state.quick.find(x=>x.id===id); if(q){ q.status=(q.status+1)%3; changed=q; } }
  if (changed) {
    if(habitOwner){const date=localDateISO(new Date());state.activityLog.push({id:`habit${Date.now()}`,key:`habit:${habitOwner.id}:${changed.id}`,date,text:`${habitOwner.text||habitOwner.title} · ${changed.text}`,area:habitArea||"admin",completedAt:new Date().toISOString()});}
    save();
    const modalStep = document.querySelector(`#modal [data-step="${id}"]`);
    if (modalStep) { const project=state.projects.find(p=>p.steps.includes(changed)); if(project)openProject(project.id); }
  }
}

function openArea(id) {
  const a=state.areas.find(x=>x.id===id);
  const active=a.tasks.filter(t=>t.status===1).length;
  $("#modalBody").innerHTML=`<section class="detail-hero area-detail-hero compact-area-hero" style="--c:${colors[id]}"><div class="detail-kicker"><i class="area-icon area-icon-${a.id}"><span></span></i><span>${a.name}<small>${a.cn}</small></span></div><h2>${a.cn}长期计划</h2><div class="detail-summary"><span><b>${a.tasks.length}</b><small>长期方向</small></span><span><b>${active}</b><small>正在推进</small></span><span><b>${a.tasks.length-active}</b><small>计划储备</small></span></div></section><div class="detail-section-title"><div><b>方向管理</b><small>选择当前投入，继续拆解具体步骤</small></div><span>${a.tasks.length} 项</span></div><div class="area-manage-grid">${a.tasks.map(t=>`<article class="area-manage-card ${t.status===1?"active":"planned"}" draggable="true" data-modal-type="area" data-modal-parent="${a.id}" data-modal-key="${t.id}" style="--c:${colors[id]}"><header><i class="area-row-dot"></i><button type="button" class="area-row-status" data-area-step="${t.id}">${domainStatusText(t.status)}</button><span class="modal-grip">⠿</span></header><input class="step-name-input" value="${escapeHtml(t.text)}" data-edit-area-task="${t.id}" aria-label="长期方向名称"><footer><span>${t.steps.length} 个步骤</span><button type="button" class="area-row-open" data-area-project="${t.id}">查看详情 <i>›</i></button></footer><button type="button" class="direction-delete" data-delete-task="${t.id}" aria-label="删除方向">×</button></article>`).join("")}</div><div class="add-row detail-add-row"><input id="newTask" placeholder="添加新的长期方向"><button type="button" data-add-task="${id}">添加方向</button></div>`;
  if (!$("#modal").open) $("#modal").showModal();
}

function projectDetailBody(item,area,isAreaProject=false){
  const metric=projectMetric(item),done=item.steps.filter(s=>s.status===2).length,doing=item.steps.filter(s=>s.status===1).length,pending=item.steps.filter(s=>s.status===0).length;
  const stepAttr=isAreaProject?"data-area-project-step":"data-step",editAttr=isAreaProject?"data-edit-area-project-step":"data-edit-step",deleteAttr=isAreaProject?"data-delete-area-project-step":"data-delete-step",modalType=isAreaProject?"areaProject":"project";
  return `<section class="detail-hero project-detail-hero" style="--c:${colors[area.id]}"><div class="detail-kicker"><span class="detail-type-dot"></span><span>${area.name}<small>${item.projectType==="habit"?"HABIT PROJECT":"GOAL PROJECT"}</small></span></div><div class="project-name-row"><input class="project-name-input" value="${escapeHtml(item.title||item.text)}" ${isAreaProject?`data-edit-area-project="${item.id}"`:`data-edit-project-name="${item.id}"`} aria-label="项目名称"><button type="button" class="delete-project" ${isAreaProject?`data-delete-area-project="${item.id}"`:`data-delete-project="${item.id}"`}>删除</button></div><div class="detail-progress-line"><span><i style="width:${metric.width}%"></i></span>${metric.html}</div><div class="detail-summary"><span><b>${doing}</b><small>正在推进</small></span><span><b>${pending}</b><small>下一步</small></span><span><b>${done}</b><small>已完成</small></span></div><div class="project-settings"><label><span>项目类型</span><select ${isAreaProject?`data-edit-area-project-type="${item.id}"`:`data-edit-project-type="${item.id}"`}><option value="target" ${item.projectType==="target"?"selected":""}>目标</option><option value="habit" ${item.projectType==="habit"?"selected":""}>习惯</option></select></label><label class="habit-goal-setting ${item.projectType==="habit"?"visible":""}"><span>阶段打卡目标</span><input type="number" min="1" value="${item.habitGoal||30}" ${isAreaProject?`data-edit-area-habit-goal="${item.id}"`:`data-edit-habit-goal="${item.id}"`}></label></div></section><div class="detail-section-title"><div><b>${item.projectType==="habit"?"打卡动作":"推进路径"}</b><small>点状态切换 · 拖动调整顺序</small></div><span>${item.steps.length} 项</span></div><div class="modal-steps detail-step-grid collapsible-completed">${item.steps.map((s,index)=>`<article class="modal-sort-item detail-step-card ${s.status===2?"completed-step":""}" draggable="true" data-modal-type="${modalType}" data-modal-parent="${item.id}" data-modal-key="${s.id}" style="--c:${colors[area.id]}"><span class="modal-grip">⠿</span><b class="step-index">${String(index+1).padStart(2,"0")}</b><div><input class="step-name-input" value="${escapeHtml(s.text)}" ${editAttr}="${s.id}" aria-label="步骤名称"><small>${statusText(s.status)}</small></div><button type="button" class="step-status-orb s${s.status}" ${stepAttr}="${s.id}" aria-label="切换状态"><i>${s.status===2?"✓":s.status===1?"•":""}</i></button><button type="button" class="direction-delete" ${deleteAttr}="${s.id}" aria-label="删除步骤">×</button></article>`).join("")}</div>`;
}

function addStepDetailButtons(prefix){
  document.querySelectorAll("#modalBody .detail-step-card").forEach(card=>{
    const stepId=card.dataset.modalKey;
    const remove=card.querySelector(".direction-delete");
    if(stepId&&remove&&!card.querySelector(".step-detail-open"))remove.insertAdjacentHTML("beforebegin",`<button type="button" class="step-detail-open" data-edit-action="${prefix}:${stepId}" aria-label="查看待办详情" title="查看待办详情"><i></i></button>`);
  });
  const grid=document.querySelector("#modalBody .detail-step-grid"),done=grid?.querySelectorAll(".completed-step").length||0;
  if(grid&&done&&!grid.previousElementSibling?.matches("[data-toggle-completed]"))grid.insertAdjacentHTML("beforebegin",`<button type="button" class="completed-steps-toggle compact-completed-toggle" data-toggle-completed aria-expanded="false"><span>已完成</span><b>${done}</b><i>展开</i></button>`);
}

function openProject(id) {
  const p=state.projects.find(x=>x.id===id);
  const area=state.areas.find(a=>a.id===p.area)||state.areas[3];
  $("#modalBody").innerHTML=projectDetailBody(p,area)+`<div class="add-row detail-add-row"><input id="newStep" placeholder="添加一个清晰、可执行的步骤"><button type="button" data-add-step="${id}">添加步骤</button></div>`;
  addStepDetailButtons("pstep");
  if (!$("#modal").open) $("#modal").showModal();
}

function openAreaProject(taskId) {
  const area=state.areas.find(a=>a.tasks.some(t=>String(t.id)===String(taskId)));
  const task=area?.tasks.find(t=>String(t.id)===String(taskId));
  if (!task) return;
  $("#modalBody").innerHTML=projectDetailBody(task,area,true)+`<div class="add-row detail-add-row"><input id="newAreaProjectStep" placeholder="添加一个清晰、可执行的步骤"><button type="button" data-add-area-project-step="${task.id}">添加步骤</button></div>`;
  addStepDetailButtons("astep");
  if (!$("#modal").open) $("#modal").showModal();
}

function findAreaProjectStep(stepId) {
  for (const area of state.areas) for (const task of area.tasks) {
    const step=task.steps.find(s=>String(s.id)===String(stepId));
    if (step) return {area,task,step};
  }
}

function escapeHtml(value) { return String(value).replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

function actionContext(key){
  if(!key)return {item:null,area:"admin",project:"独立待办"};
  const item=sourceItem(key); const [type]=key.split(":");
  if(type==="pstep"){const p=state.projects.find(p=>p.steps.includes(item));return {item,area:p?.area||"admin",project:p?.title||"项目步骤"};}
  if(type==="astep"){const found=findAreaProjectStep(key.split(":").slice(1).join(":"));return {item,area:found?.area.id||"admin",project:found?.task.text||"项目步骤"};}
  return {item,area:item?.area||"admin",project:item?.sourceProject||"独立待办"};
}

function openTodoEditor(key=""){
  const context=actionContext(key), todo=context.item;
  const data=todo||{text:"",due:"",repeat:"none",notes:"",subtasks:[],area:"admin"};
  const subtaskRows=(data.subtasks||[]).map(s=>subtaskEditorRow(s)).join("");
  const dateValue=data.due?.slice(0,10)||data.scheduledDate||"", timeValue=data.due?.includes("T")?data.due.slice(11,16):(data.scheduledHour||"");
  const weekdayChecks=[1,2,3,4,5,6,0].map(n=>`<label><input type="checkbox" value="${n}" data-repeat-weekday ${(data.repeatWeekdays||[]).map(Number).includes(n)?"checked":""}><span>${["日","一","二","三","四","五","六"][n]}</span></label>`).join("");
  $("#modalBody").innerHTML=`<div class="modal-head todo-editor-head" style="--c:${colors[context.area]||colors.admin}"><span>TASK DETAILS</span><h2>${todo?"编辑任务":"新建待办"}</h2><p>${key&&!key.startsWith("quick:")?`来自项目：${escapeHtml(context.project)}。把大步骤继续细化为可执行的子任务。`:"不设日期会进入随时待办；设置日期后进入对应日期。"}</p></div><div class="todo-form"><label><span>任务标题</span><input id="todoTitle" value="${escapeHtml(data.text)}" placeholder="例如：游泳"></label><div class="schedule-fields"><label><span>日期</span><div class="schedule-input"><input id="todoDate" type="date" value="${dateValue}"><button type="button" data-clear-todo-date>清除</button></div></label><label><span>时间 <small>选填</small></span><div class="schedule-input"><input id="todoTime" type="time" value="${timeValue}"><button type="button" data-clear-todo-time>清除</button></div></label><label><span>重复</span><select id="todoRepeat"><option value="none">不重复</option><option value="daily">每天</option><option value="weekdays">工作日</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="customDays">每隔几天</option><option value="customWeekdays">每周指定日期</option></select></label></div><div class="custom-repeat" id="customRepeat"><div class="repeat-interval"><span>每</span><input id="repeatInterval" type="number" min="2" max="365" value="${Math.max(2,data.repeatInterval||2)}"><span>天重复</span></div><div class="repeat-weekdays">${weekdayChecks}</div></div><label><span>备注</span><textarea id="todoNotes" rows="3" placeholder="地点、准备物品、联系方式……">${escapeHtml(data.notes||"")}</textarea></label><div class="subtask-editor"><div class="subtask-editor-title"><span>子任务</span><small>逐条添加具体动作</small></div><div id="todoSubtaskRows" class="subtask-editor-list">${subtaskRows}</div><div class="subtask-add-row"><input id="newSubtaskInput" placeholder="输入一个子任务"><button type="button" data-add-subtask-row>＋ 添加</button></div></div><button type="button" class="todo-save" data-save-action="${key}" data-action-area="${context.area}" data-action-project="${escapeHtml(context.project)}">${todo?"保存任务":"加入待办"}</button></div>`;
  $("#todoRepeat").value=data.repeat||"none";
  updateRepeatEditorVisibility();
  if(!$("#modal").open)$("#modal").showModal();
  $("#todoTitle").focus();
}

function updateRepeatEditorVisibility(){const value=$("#todoRepeat")?.value,box=$("#customRepeat");if(!box)return;box.classList.toggle("show-interval",value==="customDays");box.classList.toggle("show-weekdays",value==="customWeekdays");}

function subtaskEditorRow(subtask={id:"",text:"",done:false}){return `<div class="subtask-editor-row" data-subtask-row data-subtask-id="${subtask.id||`sub${Date.now()}`}" data-subtask-done="${subtask.done?"1":"0"}"><i class="subtask-row-dot"></i><input data-subtask-text value="${escapeHtml(subtask.text||"")}" placeholder="子任务内容"><button type="button" data-remove-subtask-row aria-label="删除子任务">×</button></div>`;}

function openNewProject(){
  $("#modalBody").innerHTML=`<div class="modal-head"><span>NEW PROJECT</span><h2>新建项目</h2><p>目标用于推进结果，习惯用于持续累计打卡。</p></div><div class="form-stack"><input id="projectName" placeholder="项目名称"><select id="projectArea">${state.areas.map(a=>`<option value="${a.id}">${a.name} · ${a.cn}</option>`).join("")}</select><select id="projectType"><option value="target">目标项目</option><option value="habit">习惯项目</option></select><label class="new-habit-goal"><span>阶段打卡目标</span><input id="projectHabitGoal" type="number" min="1" value="30"></label><button type="button" data-create-project>创建项目</button></div>`; $("#modal").showModal();
}

const MOBILE_VIEW_KEY="daily-dashboard-mobile-view";
const MOBILE_PROJECT_TYPE_KEY="daily-dashboard-mobile-project-type";
function setMobileView(view,scroll=true){
  const allowed=["areas","projects","inbox","today"],next=allowed.includes(view)?view:"areas";
  document.body.dataset.mobileView=next;
  localStorage.setItem(MOBILE_VIEW_KEY,next);
  document.querySelectorAll(".nav-item").forEach(item=>item.classList.toggle("active",item.dataset.view===next));
  if(scroll)window.scrollTo({top:0,behavior:"smooth"});
}

function setMobileProjectType(type){
  const next=type==="habit"?"habit":"target";
  document.body.dataset.mobileProjectType=next;
  localStorage.setItem(MOBILE_PROJECT_TYPE_KEY,next);
  document.querySelectorAll("[data-mobile-project-type]").forEach(button=>button.classList.toggle("active",button.dataset.mobileProjectType===next));
}

document.addEventListener("click", e => {
  const mobileProjectType=e.target.closest("[data-mobile-project-type]");
  if(mobileProjectType){setMobileProjectType(mobileProjectType.dataset.mobileProjectType);return;}
  if(e.target.closest("#cloudAccount")){openCloudAccount();return;}
  if(e.target.matches("[data-cloud-signin]")){cloudAuth("signin");return;}
  if(e.target.matches("[data-cloud-signup]")){cloudAuth("signup");return;}
  if(e.target.matches("[data-cloud-sync]")){pushCloudState();return;}
  if(e.target.matches("[data-cloud-signout]")){cloudClient?.auth.signOut();cloudUser=null;cloudReady=false;cloudStatus="本机保存";updateCloudButton();$("#modal").close();return;}
  const nav=e.target.closest(".nav-item");
  if(nav){
    if(window.matchMedia("(max-width: 700px)").matches){setMobileView(nav.dataset.view);return;}
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x===nav));
    const targets={today:".timeline-panel",projects:".projects-panel",areas:".areas-panel",inbox:".focus-panel"};
    document.querySelector(targets[nav.dataset.view])?.scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  const sideProject=e.target.closest("[data-side-project]");
  if(sideProject){const card=[...document.querySelectorAll("[data-order-key]")].find(x=>x.dataset.orderKey===sideProject.dataset.sideProject);if(card){card.scrollIntoView({behavior:"smooth",block:"center"});card.classList.add("sidebar-highlight");setTimeout(()=>card.classList.remove("sidebar-highlight"),1100);}return;}
  if(e.target.matches("[data-date-shift]")){state.viewDate=shiftDate(state.viewDate,Number(e.target.dataset.dateShift));timelineInitialized=false;save();return;}
  if(e.target.matches("[data-date-today]")){state.viewDate=localDateISO(new Date());timelineInitialized=false;save();return;}
  const completedToggle=e.target.closest("[data-toggle-completed]");
  if(completedToggle){const list=completedToggle.nextElementSibling,expanded=completedToggle.getAttribute("aria-expanded")!=="true";completedToggle.setAttribute("aria-expanded",String(expanded));completedToggle.querySelector("i").textContent=expanded?"收起":"展开";list?.classList.toggle("show-completed",expanded);return;}
  const step=e.target.closest("[data-step]"); if(step) return cycleStep(step.dataset.step);
  const areaProjectStep=e.target.closest("[data-area-project-step]");
  if(areaProjectStep){const found=findAreaProjectStep(areaProjectStep.dataset.areaProjectStep);if(found){cycleStep(areaProjectStep.dataset.areaProjectStep);if($("#modal").open)openAreaProject(found.task.id);}return;}
  const areaProject=e.target.closest("[data-area-project]"); if(areaProject) return openAreaProject(areaProject.dataset.areaProject);
  const area=e.target.closest("[data-area]"); if(area) return openArea(area.dataset.area);
  const project=e.target.closest("[data-project]"); if(project) return openProject(project.dataset.project);
  if(e.target.matches('[data-add="project"]')) return openNewProject();
  if(e.target.matches('[data-add="quick"]')) return openTodoEditor();
  const editAction=e.target.closest("[data-edit-action]"); if(editAction) return openTodoEditor(editAction.dataset.editAction);
  if(e.target.matches("[data-clear-todo-time]")){$("#todoTime").value="";e.target.textContent="已清除";return;}
  if(e.target.matches("[data-clear-todo-date]")){$("#todoDate").value="";$("#todoTime").value="";e.target.textContent="已清除";return;}
  if(e.target.matches("[data-add-subtask-row]")){const input=$("#newSubtaskInput"),text=input.value.trim();if(text){$("#todoSubtaskRows").insertAdjacentHTML("beforeend",subtaskEditorRow({id:`sub${Date.now()}`,text,done:false}));input.value="";input.focus();}return;}
  if(e.target.matches("[data-remove-subtask-row]")){e.target.closest("[data-subtask-row]")?.remove();return;}
  const subtask=e.target.closest("[data-toggle-subtask]");if(subtask){const todo=sourceItem(subtask.dataset.toggleSubtask);const item=todo?.subtasks.find(s=>String(s.id)===String(subtask.dataset.subtaskId));if(item){item.done=!item.done;save();}return;}
  const completeAction=e.target.closest("[data-complete-action]");if(completeAction){completeTodo(completeAction.dataset.completeAction);return;}
  if(e.target.matches("[data-save-action]")){const title=$("#todoTitle").value.trim();if(!title)return;let key=e.target.dataset.saveAction,todo=key?sourceItem(key):null;if(!todo){todo={id:"q"+Date.now(),status:1,area:e.target.dataset.actionArea||"admin",sourceProject:e.target.dataset.actionProject||"独立待办",subtasks:[]};state.quick.push(todo);key=`quick:${todo.id}`;}todo.text=title;const date=$("#todoDate").value,time=$("#todoTime").value;if(date){todo.due=time?`${date}T${time}`:date;todo.scheduledDate=date;}else{delete todo.due;delete todo.scheduledDate;}if(time){todo.scheduledHour=`${time.slice(0,2)}:00`;}else{delete todo.scheduledHour;delete todo.duration;}todo.repeat=$("#todoRepeat").value;todo.repeatInterval=Math.max(2,Number($("#repeatInterval")?.value)||2);todo.repeatWeekdays=[...document.querySelectorAll("[data-repeat-weekday]:checked")].map(x=>Number(x.value));if(todo.repeat==="customWeekdays"&&!todo.repeatWeekdays.length)todo.repeatWeekdays=[new Date(`${state.viewDate}T12:00:00`).getDay()];if(todo.repeat!=="none"&&!taskDate(todo))todo.scheduledDate=state.viewDate;todo.notes=$("#todoNotes").value.trim();const pending=$("#newSubtaskInput")?.value.trim();if(pending)$("#todoSubtaskRows").insertAdjacentHTML("beforeend",subtaskEditorRow({id:`sub${Date.now()}`,text:pending,done:false}));todo.subtasks=[...document.querySelectorAll("#todoSubtaskRows [data-subtask-row]")].map(row=>({id:row.dataset.subtaskId,text:row.querySelector("[data-subtask-text]").value.trim(),done:row.dataset.subtaskDone==="1"})).filter(s=>s.text);save();$("#modal").close();return;}
  if(e.target.matches("[data-delete-todo]")){ const key=e.target.dataset.deleteTodo; const [type,...parts]=key.split(":"); const id=parts.join(":"); if(type==="pstep") state.projects.forEach(p=>p.steps=p.steps.filter(s=>String(s.id)!==id)); if(type==="atask") state.areas.forEach(a=>a.tasks=a.tasks.filter(t=>String(t.id)!==id)); if(type==="astep") { const found=findAreaProjectStep(id); if(found) found.task.steps=found.task.steps.filter(s=>String(s.id)!==id); } if(type==="quick") state.quick=state.quick.filter(q=>String(q.id)!==id); state.todoOrder=state.todoOrder.filter(k=>k!==key); save(); return; }
  if(e.target.matches("[data-area-step]")){ const id=e.target.dataset.areaStep; const t=state.areas.flatMap(a=>a.tasks).find(x=>String(x.id)===String(id)); if(t){t.status=(t.status+1)%2;save(); const area=state.areas.find(a=>a.tasks.includes(t)); openArea(area.id);} return; }
  if(e.target.matches("[data-add-task]")){ const input=$("#newTask"); if(input.value.trim()){state.areas.find(a=>a.id===e.target.dataset.addTask).tasks.push({id:Date.now(),text:input.value.trim(),status:0,steps:[]});save();openArea(e.target.dataset.addTask);} }
  if(e.target.matches("[data-delete-task]")){const id=String(e.target.dataset.deleteTask),area=state.areas.find(a=>a.tasks.some(t=>String(t.id)===id));if(!area)return;area.tasks=area.tasks.filter(t=>String(t.id)!==id);state.projectOrder=state.projectOrder.filter(key=>key!==`a:${id}`);save();openArea(area.id);return;}
  if(e.target.matches("[data-add-step]")){ const input=$("#newStep"); const id=e.target.dataset.addStep; if(input.value.trim()){state.projects.find(p=>p.id===id).steps.push({id:"s"+Date.now(),text:input.value.trim(),status:0});save();openProject(id);} }
  if(e.target.matches("[data-delete-step]")){ const id=e.target.dataset.deleteStep; state.projects.forEach(p=>p.steps=p.steps.filter(s=>s.id!==id)); save(); $("#modal").close(); }
  if(e.target.matches("[data-delete-project]")){ const id=e.target.dataset.deleteProject; if(confirm("确定删除这个项目及全部步骤吗？")){state.projects=state.projects.filter(p=>p.id!==id);save();$("#modal").close();} }
  if(e.target.matches("[data-add-area-project-step]")){ const taskId=e.target.dataset.addAreaProjectStep; const input=$("#newAreaProjectStep"); const task=state.areas.flatMap(a=>a.tasks).find(t=>String(t.id)===String(taskId)); if(task&&input.value.trim()){task.steps.push({id:"as"+Date.now(),text:input.value.trim(),status:0});save();openAreaProject(taskId);} }
  if(e.target.matches("[data-delete-area-project-step]")){ const found=findAreaProjectStep(e.target.dataset.deleteAreaProjectStep); if(found){found.task.steps=found.task.steps.filter(s=>String(s.id)!==String(e.target.dataset.deleteAreaProjectStep));save();openAreaProject(found.task.id);} }
  if(e.target.matches("[data-delete-area-project]")){ const id=e.target.dataset.deleteAreaProject; if(confirm("确定删除这个项目吗？它也会从领域仪表盘中删除。")){state.areas.forEach(a=>a.tasks=a.tasks.filter(t=>String(t.id)!==String(id)));state.projectOrder=state.projectOrder.filter(k=>k!==`a:${id}`);save();$("#modal").close();} }
  if(e.target.matches("[data-create-project]")){const name=$("#projectName").value.trim();if(name){state.projects.push({id:"p"+Date.now(),title:name,area:$("#projectArea").value,projectType:$("#projectType").value,checkins:0,habitGoal:Math.max(1,Number($("#projectHabitGoal").value)||30),steps:[]});save();$("#modal").close();}}
});

document.addEventListener("change", e => {
  if(e.target.matches("#calendarDate")){state.viewDate=e.target.value||localDateISO(new Date());timelineInitialized=false;save();return;}
  if(e.target.matches("#todoSortMode")){state.todoSortMode=e.target.value;save();return;}
  if(e.target.matches("#todoRepeat")){updateRepeatEditorVisibility();return;}
  if(e.target.matches("#projectType")){document.querySelector(".new-habit-goal")?.classList.toggle("visible",e.target.value==="habit");return;}
  if(e.target.matches("[data-edit-project-type]")){const p=state.projects.find(x=>x.id===e.target.dataset.editProjectType);if(p){p.projectType=e.target.value;save();openProject(p.id);}return;}
  if(e.target.matches("[data-edit-area-project-type]")){const t=state.areas.flatMap(a=>a.tasks).find(x=>String(x.id)===String(e.target.dataset.editAreaProjectType));if(t){t.projectType=e.target.value;save();openAreaProject(t.id);}return;}
  if(e.target.matches("[data-edit-habit-goal]")){const p=state.projects.find(x=>x.id===e.target.dataset.editHabitGoal);if(p){p.habitGoal=Math.max(1,Number(e.target.value)||30);save();}return;}
  if(e.target.matches("[data-edit-area-habit-goal]")){const t=state.areas.flatMap(a=>a.tasks).find(x=>String(x.id)===String(e.target.dataset.editAreaHabitGoal));if(t){t.habitGoal=Math.max(1,Number(e.target.value)||30);save();}return;}
  if (e.target.matches("[data-edit-project-name]")) {
    const p=state.projects.find(x=>x.id===e.target.dataset.editProjectName);
    if (p && e.target.value.trim()) { p.title=e.target.value.trim(); save(); }
  }
  if (e.target.matches("[data-edit-step]")) {
    const s=state.projects.flatMap(p=>p.steps).find(x=>x.id===e.target.dataset.editStep);
    if (s && e.target.value.trim()) { s.text=e.target.value.trim(); save(); }
  }
  if (e.target.matches("[data-edit-area-task]")) {
    const t=state.areas.flatMap(a=>a.tasks).find(x=>String(x.id)===String(e.target.dataset.editAreaTask));
    if (t && e.target.value.trim()) { t.text=e.target.value.trim(); save(); }
  }
  if (e.target.matches("[data-edit-area-project]")) {
    const t=state.areas.flatMap(a=>a.tasks).find(x=>String(x.id)===String(e.target.dataset.editAreaProject));
    if (t && e.target.value.trim()) { t.text=e.target.value.trim(); save(); }
  }
  if (e.target.matches("[data-edit-area-project-step]")) {
    const found=findAreaProjectStep(e.target.dataset.editAreaProjectStep);
    if (found && e.target.value.trim()) { found.step.text=e.target.value.trim(); save(); }
  }
});

let draggedProjectKey="", draggedTodoKey="", draggedModalItem=null;
document.addEventListener("dragstart", e => {
  const modalItem=e.target.closest("[data-modal-key]");
  if(modalItem){draggedModalItem={type:modalItem.dataset.modalType,parent:modalItem.dataset.modalParent,key:modalItem.dataset.modalKey};modalItem.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",draggedModalItem.key);return;}
  const todo=e.target.closest("[data-todo-key]");
  if(todo){draggedTodoKey=todo.dataset.todoKey;todo.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",draggedTodoKey);return;}
  const handle=e.target.closest("[data-drag-key]");
  if (!handle) return;
  draggedProjectKey=handle.dataset.dragKey;
  handle.closest(".project-card")?.classList.add("dragging");
  e.dataTransfer.effectAllowed="move";
  e.dataTransfer.setData("text/plain",draggedProjectKey);
});
document.addEventListener("dragover", e => {
  const projectTarget=e.target.closest("[data-order-key]");
  if(projectTarget&&draggedProjectKey){document.querySelectorAll(".project-card.drag-over").forEach(x=>x.classList.remove("drag-over"));projectTarget.classList.add("drag-over");}
  const modalTarget=e.target.closest("[data-modal-key]");
  if(modalTarget&&draggedModalItem){document.querySelectorAll(".modal-sort-item.drag-over").forEach(x=>x.classList.remove("drag-over"));modalTarget.classList.add("drag-over");}
  if(projectTarget||modalTarget||e.target.closest("[data-hour]")||e.target.closest("[data-todo-key]")){e.preventDefault();e.dataTransfer.dropEffect="move";}
});
document.addEventListener("drop", e => {
  const modalTarget=e.target.closest("[data-modal-key]");
  if(modalTarget&&draggedModalItem&&modalTarget.dataset.modalType===draggedModalItem.type&&modalTarget.dataset.modalParent===draggedModalItem.parent&&modalTarget.dataset.modalKey!==draggedModalItem.key){
    e.preventDefault(); let list;
    if(draggedModalItem.type==="area") list=state.areas.find(a=>a.id===draggedModalItem.parent)?.tasks;
    if(draggedModalItem.type==="project") list=state.projects.find(p=>p.id===draggedModalItem.parent)?.steps;
    if(draggedModalItem.type==="areaProject") list=state.areas.flatMap(a=>a.tasks).find(t=>String(t.id)===String(draggedModalItem.parent))?.steps;
    if(list){const from=list.findIndex(x=>String(x.id)===String(draggedModalItem.key));const to=list.findIndex(x=>String(x.id)===String(modalTarget.dataset.modalKey));if(from>=0&&to>=0){const [moved]=list.splice(from,1);list.splice(to,0,moved);const info={...draggedModalItem};draggedModalItem=null;save();if(info.type==="area")openArea(info.parent);if(info.type==="project")openProject(info.parent);if(info.type==="areaProject")openAreaProject(info.parent);}}
    return;
  }
  const hour=e.target.closest("[data-hour]");
  if(hour&&draggedTodoKey){e.preventDefault();const item=sourceItem(draggedTodoKey);if(item){item.scheduledHour=hour.dataset.hour;item.scheduledDate=state.viewDate;item.due=`${state.viewDate}T${hour.dataset.hour}`;if(!item.duration)item.duration=1;draggedTodoKey="";save();}return;}
  const todoTarget=e.target.closest("[data-todo-key]");
  if(todoTarget&&draggedTodoKey&&todoTarget.dataset.todoKey!==draggedTodoKey){e.preventDefault();const from=state.todoOrder.indexOf(draggedTodoKey);if(from>=0)state.todoOrder.splice(from,1);const to=state.todoOrder.indexOf(todoTarget.dataset.todoKey);state.todoOrder.splice(to<0?state.todoOrder.length:to,0,draggedTodoKey);state.todoSortMode="manual";draggedTodoKey="";save();return;}
  const target=e.target.closest("[data-order-key]");
  if(!target||!draggedProjectKey||target.dataset.orderKey===draggedProjectKey) return;
  e.preventDefault();
  const sourceIndex=state.projectOrder.indexOf(draggedProjectKey);
  if(sourceIndex>=0) state.projectOrder.splice(sourceIndex,1);
  const targetIndex=state.projectOrder.indexOf(target.dataset.orderKey);
  state.projectOrder.splice(targetIndex<0?state.projectOrder.length:targetIndex,0,draggedProjectKey);
  draggedProjectKey=""; save();
});
document.addEventListener("dragend", e => { e.target.closest(".project-card,.focus-item,.modal-sort-item")?.classList.remove("dragging"); document.querySelectorAll(".project-card.drag-over,.modal-sort-item.drag-over").forEach(x=>x.classList.remove("drag-over")); draggedProjectKey=""; draggedTodoKey=""; draggedModalItem=null; });

// Mobile browsers do not implement HTML5 drag/drop consistently. Keep tap actions
// independent, and use a short long-press on the visible grip for touch sorting.
let mobileTouchSort=null, suppressMobileClickUntil=0;
const mobileSortHandleSelector=".todo-grip,.drag-handle,.modal-grip";
const mobileActionSelector="[data-complete-action],[data-step],[data-area-project-step],[data-area-step],[data-toggle-subtask]";

function moveBefore(list,sourceKey,targetKey,keyOf=x=>String(x.id)){
  const from=list.findIndex(x=>keyOf(x)===String(sourceKey));
  const to=list.findIndex(x=>keyOf(x)===String(targetKey));
  if(from<0||to<0||from===to)return false;
  const [moved]=list.splice(from,1);
  list.splice(to,0,moved);
  return true;
}

function finishMobileSort(sort,target){
  if(!target)return;
  if(sort.type==="todo"){
    const targetKey=target.dataset.todoKey;
    if(targetKey&&targetKey!==sort.key){
      const from=state.todoOrder.indexOf(sort.key);
      if(from>=0)state.todoOrder.splice(from,1);
      const to=state.todoOrder.indexOf(targetKey);
      state.todoOrder.splice(to<0?state.todoOrder.length:to,0,sort.key);
      state.todoSortMode="manual";save();
    }
    return;
  }
  if(sort.type==="project"){
    const targetKey=target.dataset.orderKey;
    if(targetKey&&targetKey!==sort.key){
      const from=state.projectOrder.indexOf(sort.key);
      if(from>=0)state.projectOrder.splice(from,1);
      const to=state.projectOrder.indexOf(targetKey);
      state.projectOrder.splice(to<0?state.projectOrder.length:to,0,sort.key);save();
    }
    return;
  }
  if(sort.type==="modal"&&target.dataset.modalType===sort.modalType&&target.dataset.modalParent===sort.parent){
    let list;
    if(sort.modalType==="area")list=state.areas.find(a=>a.id===sort.parent)?.tasks;
    if(sort.modalType==="project")list=state.projects.find(p=>p.id===sort.parent)?.steps;
    if(sort.modalType==="areaProject")list=state.areas.flatMap(a=>a.tasks).find(t=>String(t.id)===String(sort.parent))?.steps;
    if(list&&moveBefore(list,sort.key,target.dataset.modalKey)){
      save();
      if(sort.modalType==="area")openArea(sort.parent);
      if(sort.modalType==="project")openProject(sort.parent);
      if(sort.modalType==="areaProject")openAreaProject(sort.parent);
    }
  }
}

document.addEventListener("touchstart",e=>{
  if(e.touches.length!==1)return;
  const handle=e.target.closest(mobileSortHandleSelector);if(!handle)return;
  const todo=handle.closest("[data-todo-key]"),project=handle.closest("[data-order-key]"),modalItem=handle.closest("[data-modal-key]");
  const touch=e.touches[0];
  mobileTouchSort={handle,item:todo||project||modalItem,startX:touch.clientX,startY:touch.clientY,x:touch.clientX,y:touch.clientY,active:false,target:null};
  if(todo)Object.assign(mobileTouchSort,{type:"todo",key:todo.dataset.todoKey,selector:"[data-todo-key]"});
  else if(project)Object.assign(mobileTouchSort,{type:"project",key:project.dataset.orderKey,selector:"[data-order-key]"});
  else if(modalItem)Object.assign(mobileTouchSort,{type:"modal",key:modalItem.dataset.modalKey,modalType:modalItem.dataset.modalType,parent:modalItem.dataset.modalParent,selector:"[data-modal-key]"});
  else {mobileTouchSort=null;return;}
  mobileTouchSort.timer=setTimeout(()=>{
    if(!mobileTouchSort)return;
    mobileTouchSort.active=true;mobileTouchSort.item.classList.add("touch-sorting");
    document.body.classList.add("is-touch-sorting");
    navigator.vibrate?.(18);
  },300);
},{passive:true});

document.addEventListener("touchmove",e=>{
  const sort=mobileTouchSort;if(!sort||e.touches.length!==1)return;
  const touch=e.touches[0],distance=Math.hypot(touch.clientX-sort.startX,touch.clientY-sort.startY);
  sort.x=touch.clientX;sort.y=touch.clientY;
  if(!sort.active){if(distance>9){clearTimeout(sort.timer);mobileTouchSort=null;}return;}
  e.preventDefault();
  document.querySelectorAll(".touch-sort-target").forEach(x=>x.classList.remove("touch-sort-target"));
  const candidate=document.elementFromPoint(sort.x,sort.y)?.closest(sort.selector);
  if(candidate&&candidate!==sort.item){sort.target=candidate;candidate.classList.add("touch-sort-target");}
},{passive:false});

function cancelMobileSort(commit){
  const sort=mobileTouchSort;if(!sort)return;
  clearTimeout(sort.timer);
  if(sort.active){
    suppressMobileClickUntil=Date.now()+650;
    if(commit)finishMobileSort(sort,sort.target);
  }
  sort.item?.classList.remove("touch-sorting");
  document.querySelectorAll(".touch-sort-target").forEach(x=>x.classList.remove("touch-sort-target"));
  document.body.classList.remove("is-touch-sorting");mobileTouchSort=null;
}
document.addEventListener("touchend",()=>cancelMobileSort(true),{passive:true});
document.addEventListener("touchcancel",()=>cancelMobileSort(false),{passive:true});

// On iOS a draggable ancestor can swallow the synthetic click. Complete directly
// on touch release, then suppress only the duplicate synthetic click.
document.addEventListener("pointerup",e=>{
  if(e.pointerType!=="touch"||mobileTouchSort?.active)return;
  const action=e.target.closest(mobileActionSelector);if(!action)return;
  e.preventDefault();e.stopPropagation();suppressMobileClickUntil=Date.now()+650;
  if(action.matches("[data-complete-action]")){completeTodo(action.dataset.completeAction);return;}
  if(action.matches("[data-step]")){cycleStep(action.dataset.step);return;}
  if(action.matches("[data-area-project-step]")){const found=findAreaProjectStep(action.dataset.areaProjectStep);if(found){cycleStep(action.dataset.areaProjectStep);if($("#modal").open)openAreaProject(found.task.id);}return;}
  if(action.matches("[data-area-step]")){const t=state.areas.flatMap(a=>a.tasks).find(x=>String(x.id)===String(action.dataset.areaStep));if(t){t.status=(t.status+1)%2;save();const area=state.areas.find(a=>a.tasks.includes(t));openArea(area.id);}return;}
  if(action.matches("[data-toggle-subtask]")){const todo=sourceItem(action.dataset.toggleSubtask),item=todo?.subtasks.find(s=>String(s.id)===String(action.dataset.subtaskId));if(item){item.done=!item.done;save();}}
},{passive:false});

document.addEventListener("click",e=>{
  if(Date.now()>suppressMobileClickUntil)return;
  if(e.target.closest(`${mobileSortHandleSelector},${mobileActionSelector}`)){e.preventDefault();e.stopImmediatePropagation();}
},true);

let resizeState=null;
document.addEventListener("pointerdown", e => {
  const handle=e.target.closest("[data-resize-key]");
  if(!handle) return;
  e.preventDefault(); e.stopPropagation();
  const item=sourceItem(handle.dataset.resizeKey); if(!item) return;
  const card=handle.closest(".time-task");
  const startHour=Number(card.closest("[data-hour]").dataset.hour.slice(0,2));
  resizeState={item,card,startY:e.clientY,startDuration:item.duration||1,maxDuration:Math.max(.5,24-startHour),duration:item.duration||1};
  card.classList.add("resizing"); handle.setPointerCapture?.(e.pointerId);
});
document.addEventListener("pointermove", e => {
  if(!resizeState) return;
  const delta=(e.clientY-resizeState.startY)/TIMELINE_HOUR_HEIGHT;
  resizeState.duration=Math.min(resizeState.maxDuration,Math.max(.5,Math.round((resizeState.startDuration+delta)*2)/2));
  resizeState.card.style.setProperty("--duration",resizeState.duration);
});
document.addEventListener("pointerup", () => {
  if(!resizeState) return;
  resizeState.item.duration=resizeState.duration;
  resizeState.card.classList.remove("resizing"); resizeState=null; save();
});

$("#modal").addEventListener("click", e => { if(e.target===$("#modal")) $("#modal").close(); });
let sideScrollTimer;
$("#sideProjects")?.addEventListener("scroll", e => {
  e.currentTarget.classList.add("is-scrolling");
  clearTimeout(sideScrollTimer);
  sideScrollTimer=setTimeout(()=>e.currentTarget.classList.remove("is-scrolling"),650);
},{passive:true});
render();
initCloud();
if(window.matchMedia("(max-width: 700px)").matches){
  setMobileView(localStorage.getItem(MOBILE_VIEW_KEY)||"areas",false);
  setMobileProjectType(localStorage.getItem(MOBILE_PROJECT_TYPE_KEY)||"target");
}
window.matchMedia("(max-width: 700px)").addEventListener?.("change",event=>{if(event.matches){setMobileView(localStorage.getItem(MOBILE_VIEW_KEY)||"areas",false);setMobileProjectType(localStorage.getItem(MOBILE_PROJECT_TYPE_KEY)||"target");}});
const updateOnlineStatus=()=>document.body.classList.toggle("is-offline",!navigator.onLine);
window.addEventListener("online",updateOnlineStatus);
window.addEventListener("offline",updateOnlineStatus);
updateOnlineStatus();

if("serviceWorker" in navigator&&location.protocol!=="file:"){
  window.addEventListener("load",async()=>{
    try{
      const registration=await navigator.serviceWorker.register("./sw.js");
      await registration.update();
      if(registration.waiting)registration.waiting.postMessage({type:"SKIP_WAITING"});
    }catch(error){console.warn("PWA service worker registration failed",error);}
  });
}
