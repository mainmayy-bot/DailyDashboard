const KEY = "life-action-board-v2";
const SUPABASE_URL = "https://xmvvcebjglyyttlceicw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nEHf0fkntvsC_pzDyXqIUw_8vY_fS20";
const colors = { fortune: "#d4a83e", beauty: "#c7665b", soul: "#6f9673", admin: "#668bb3" };
const TIMELINE_HOUR_HEIGHT = 48;
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

let state;
let timelineInitialized=false;
try { state = JSON.parse(localStorage.getItem(KEY)) || structuredClone(defaults); } catch { state = structuredClone(defaults); }
state.areas.forEach(a => { if (a.id === "life") a.id = "admin"; if (a.id === "admin") a.name = "Adimin"; });
state.projects.forEach(p => { if (p.area === "life") p.area = "admin"; });
state.quick.forEach(q => { if (q.area === "life") q.area = "admin"; });
state.areas.forEach(a => a.tasks.forEach(t => { if (typeof t.status !== "number") t.status = t.done ? 2 : 0; delete t.done; }));
state.areas.forEach(a=>a.tasks.forEach(t=>{if(t.status===2)t.status=1;}));
state.areas.forEach(a => a.tasks.forEach(t => { if (!Array.isArray(t.steps)) t.steps = []; }));
if (!Array.isArray(state.projectOrder)) state.projectOrder = [];
if (!Array.isArray(state.todoOrder)) state.todoOrder = [];
state.quick.forEach(q=>{if(!q.repeat)q.repeat="none";if(!q.notes)q.notes="";if(!Array.isArray(q.subtasks))q.subtasks=[];});
state.projects.forEach(p=>p.steps.forEach(s=>{if(!s.repeat)s.repeat="none";if(!s.notes)s.notes="";if(!Array.isArray(s.subtasks))s.subtasks=[];}));
state.areas.forEach(a=>a.tasks.forEach(t=>t.steps.forEach(s=>{if(!s.repeat)s.repeat="none";if(!s.notes)s.notes="";if(!Array.isArray(s.subtasks))s.subtasks=[];})));
state.quick.forEach(normalizeSubtasks);state.projects.forEach(p=>p.steps.forEach(normalizeSubtasks));state.areas.forEach(a=>a.tasks.forEach(t=>t.steps.forEach(normalizeSubtasks)));
if(!state.viewDate)state.viewDate=localDateISO(new Date());
localStorage.setItem(KEY, JSON.stringify(state));
const $ = s => document.querySelector(s);
const save = () => { localStorage.setItem(KEY, JSON.stringify(state)); render(); scheduleCloudSave(); };
const pct = items => items.length ? Math.round(items.filter(x => x.status === 2).length / items.length * 100) : 0;
const statusText = s => ["未做", "在做", "已完成"][s];
const domainStatusText = s => ["计划中", "推进中"][s];
const allSteps = () => state.projects.flatMap(p=>p.steps.map(s=>({...s,project:p.title,area:p.area,sourceKey:`pstep:${s.id}`})))
  .concat(state.areas.flatMap(a=>a.tasks.flatMap(t=>t.steps.map(s=>({...s,project:t.text,area:a.id,sourceKey:`astep:${s.id}`})))))
  .concat(state.quick.map(q => ({...q, project:q.sourceProject||"独立待办", sourceKey:`quick:${q.id}`})));

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
async function loadCloudState(){if(!cloudUser)return;cloudStatus="同步中";updateCloudButton();const {data,error}=await cloudClient.from("user_boards").select("data").eq("user_id",cloudUser.id).maybeSingle();if(error){cloudStatus="需要初始化数据库";updateCloudButton();return;}if(data?.data?.areas){state=data.data;localStorage.setItem(KEY,JSON.stringify(state));cloudReady=true;render();cloudStatus="已同步";updateCloudButton();}else{cloudReady=true;await pushCloudState();}}
async function initCloud(){if(!window.supabase?.createClient){cloudStatus="云服务未加载";updateCloudButton();return;}cloudClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);const {data}=await cloudClient.auth.getSession();cloudUser=data.session?.user||null;updateCloudButton();if(cloudUser)await loadCloudState();cloudClient.auth.onAuthStateChange(async(_event,session)=>{cloudUser=session?.user||null;cloudReady=false;updateCloudButton();if(cloudUser)await loadCloudState();});}
function openCloudAccount(){if(cloudUser){$("#modalBody").innerHTML=`<div class="modal-head cloud-modal-head"><span>CLOUD SYNC</span><h2>云端同步</h2><p>${escapeHtml(cloudUser.email||"")} · ${cloudStatus}</p></div><div class="cloud-actions"><button type="button" data-cloud-sync>立即同步</button><button type="button" class="secondary" data-cloud-signout>退出登录</button></div>`;}else{$("#modalBody").innerHTML=`<div class="modal-head cloud-modal-head"><span>CLOUD SYNC</span><h2>登录同步</h2><p>使用同一个邮箱账号，即可在电脑和手机之间同步看板。</p></div><div class="cloud-form"><label><span>邮箱</span><input id="cloudEmail" type="email" autocomplete="email" placeholder="your@email.com"></label><label><span>密码</span><input id="cloudPassword" type="password" autocomplete="current-password" placeholder="至少 6 位密码"></label><div><button type="button" data-cloud-signin>登录</button><button type="button" class="secondary" data-cloud-signup>注册</button></div><small id="cloudMessage"></small></div>`;}if(!$("#modal").open)$("#modal").showModal();}
async function cloudAuth(mode){const email=$("#cloudEmail").value.trim(),password=$("#cloudPassword").value,message=$("#cloudMessage");if(!email||password.length<6){message.textContent="请输入有效邮箱和至少 6 位密码";return;}message.textContent="处理中…";const result=mode==="signup"?await cloudClient.auth.signUp({email,password}):await cloudClient.auth.signInWithPassword({email,password});if(result.error){message.textContent=result.error.message;return;}if(mode==="signup"&&!result.data.session){message.textContent="注册成功，请检查邮箱确认后再登录。";}else{$("#modal").close();}}
function localDateISO(date){const d=new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function shiftDate(date,days){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return localDateISO(d);}
function occursOn(todo,date){
  if(todo.status===2)return false;
  const base=todo.due?.slice(0,10)||todo.scheduledDate||localDateISO(new Date());
  if(date<base)return false;
  if((todo.completions||[]).includes(date))return false;
  // 单次任务在到期日之后继续出现，直到用户真正完成它。
  if(!todo.repeat||todo.repeat==="none")return date>=base;
  const d=new Date(`${date}T12:00:00`),b=new Date(`${base}T12:00:00`);
  if(todo.repeat==="daily")return true;
  if(todo.repeat==="weekdays")return d.getDay()>0&&d.getDay()<6;
  if(todo.repeat==="weekly")return d.getDay()===b.getDay();
  if(todo.repeat==="monthly")return d.getDate()===b.getDate();
  return false;
}

function render() {
  const steps = allSteps().filter(x=>occursOn(x,state.viewDate));
  const counts = [0,1,2].map(n => steps.filter(x => x.status === n).length);
  const scheduledCount = steps.filter(x => x.status === 1 && isTaskScheduled(x)).length;
  $("#dateLabel").innerHTML=`<button data-date-shift="-1" aria-label="前一天">‹</button><input id="calendarDate" type="date" value="${state.viewDate}"><button data-date-shift="1" aria-label="后一天">›</button><button data-date-today>今天</button>`;
  $("#statDoing").textContent = counts[1]; $("#statScheduled").textContent = scheduledCount; $("#statDone").textContent = counts[2];
  $("#sideDone").textContent = counts[2]; $("#sideDoing").textContent = counts[1];
  $("#loadTime").textContent = `${counts[1]} 项进行中`;
  const isToday=state.viewDate===localDateISO(new Date());
  $(".focus-panel h2").textContent = isToday?"今日待办":"当日待办";
  $(".timeline-panel h2").textContent = isToday?"今日时间轴":"当日时间轴";
  $(".projects-panel h2").textContent = "项目管理";
  $("[data-add='quick']").textContent = "＋ 添加待办";
  $("#sideAreas").innerHTML = state.areas.map(a => `<p><i class="dot" style="background:${colors[a.id]}"></i>${a.name}<b>${a.tasks.filter(t=>t.status===1).length}</b></p>`).join("");
  $(".areas-panel h2").textContent="领域仪表盘";
  $(".areas-panel header small").textContent="管理长期方向与持续投入";
  $(".areas-panel header>span").textContent="关注推进状态，而非一次性完成";
  $(".signals-panel h2").textContent="数据概览";
  renderTimeline(steps); renderFocus(steps); renderProjects(); renderAreas(); renderSignals(steps);
  $(".refine-head")?.remove(); $("#refineList")?.remove();
}

function renderTimeline(steps) {
  const active = steps.filter(x => x.status === 1 && x.scheduledHour);
  const hours = Array.from({length:24},(_,hour)=>`${String(hour).padStart(2,"0")}:00`);
  $("#timeline").innerHTML = hours.map(h => { const item=active.find(x=>x.scheduledHour===h), duration=item?.duration||1; return `<div class="time-row timeline-drop" data-hour="${h}"><time>${h}</time>${item ? `<article class="time-task" draggable="true" data-todo-key="${item.sourceKey}" style="--c:${colors[item.area] || colors.admin};--duration:${duration}" data-timeline-key="${item.sourceKey}"><button class="timeline-task-main" data-edit-action="${item.sourceKey}"><i></i><span><b>${escapeHtml(item.text)}</b><small>${escapeHtml(item.project)} · ${h}–${formatEndTime(h,duration)} · ${duration}h</small></span></button><span class="resize-handle" data-resize-key="${item.sourceKey}" title="上下拖动调整时长"><i></i></span></article>` : `<span class="drop-hint">拖入待办</span>`}</div>`; }).join("");
  if(!timelineInitialized){const now=new Date(),isToday=state.viewDate===localDateISO(now),position=isToday?(now.getHours()+now.getMinutes()/60)*TIMELINE_HOUR_HEIGHT-160:8*TIMELINE_HOUR_HEIGHT;$("#timeline").scrollTop=Math.max(0,position);timelineInitialized=true;}
}

function formatEndTime(start,duration){ const total=Number(start.slice(0,2))*60+Number(start.slice(3))+duration*60; return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; }

function taskDate(todo){return todo.due?.slice(0,10)||todo.scheduledDate||"";}
// 只有设置了具体执行时间、真正进入时间轴，才算“已安排”。
function isTaskScheduled(todo){return Boolean(todo.scheduledHour||(todo.due?.includes("T")&&todo.due.slice(11,16)));}
function isTaskOverdue(todo,date=state.viewDate){
  if(todo.status!==1||!isTaskScheduled(todo))return false;
  const dueDate=taskDate(todo),today=localDateISO(new Date());
  const repeating=todo.repeat&&todo.repeat!=="none";
  // 重复任务按当天生成新一轮，不把上一轮的日期继承为逾期。
  if(!repeating&&dueDate<date)return true;
  if(date!==today)return false;
  if(!repeating&&dueDate!==today)return false;
  const time=todo.due?.includes("T")?todo.due.slice(11,16):todo.scheduledHour;
  if(!time)return false;
  const now=new Date(),current=now.getHours()*60+now.getMinutes();
  const end=Number(time.slice(0,2))*60+Number(time.slice(3))+(todo.duration||1)*60;
  return current>end;
}

function renderFocus(steps) {
  const rank=new Map(state.todoOrder.map((key,index)=>[key,index]));
  const doing = steps.filter(x => x.status === 1).sort((a,b)=>(rank.get(a.sourceKey)??9999)-(rank.get(b.sourceKey)??9999));
  state.todoOrder=[...new Set([...doing.map(x=>x.sourceKey),...state.todoOrder])];
  $("#focusList").innerHTML = doing.length ? doing.map(x => {
    const overdue=isTaskOverdue(x),unscheduled=!isTaskScheduled(x);
    const alert=overdue?`<em class="todo-alert overdue-alert">! 已逾期</em>`:unscheduled?`<em class="todo-alert unscheduled-alert">待排期</em>`:"";
    return `<article class="focus-item todo-card ${overdue?"is-overdue":unscheduled?"is-unscheduled":""}" draggable="true" data-todo-key="${x.sourceKey}" style="--c:${colors[x.area] || colors.admin}"><div class="todo-card-top"><span class="todo-grip" title="拖拽排序或安排时间">⠿</span><button class="todo-check" data-complete-action="${x.sourceKey}" aria-label="完成待办"><i></i></button><button class="todo-main" data-edit-action="${x.sourceKey}"><span><span class="todo-title-line"><b>${escapeHtml(x.text)}</b>${alert}</span><small>${todoMeta(x)}</small></span></button><button class="todo-delete" data-delete-todo="${x.sourceKey}" aria-label="删除待办">×</button></div>${x.notes?`<button class="todo-note" data-edit-action="${x.sourceKey}"><i>备注</i><span>${escapeHtml(x.notes)}</span></button>`:""}${x.subtasks?.length?`<div class="todo-subtasks"><div class="todo-subtasks-head"><span>子任务</span><b>${x.subtasks.filter(s=>s.done).length}/${x.subtasks.length}</b></div>${x.subtasks.map(s=>`<button class="todo-subtask ${s.done?"done":""}" data-toggle-subtask="${x.sourceKey}" data-subtask-id="${s.id}"><i>${s.done?"✓":""}</i><span>${escapeHtml(s.text)}</span></button>`).join("")}</div>`:""}</article>`;
  }).join("") : `<div class="empty">暂无今日行动</div>`;
}

function todoMeta(todo){const bits=[];bits.push(todo.project||todo.sourceProject||"独立待办");bits.push(todo.due?todo.due.replace("T"," "):todo.scheduledHour||"未安排时间");if(todo.repeat&&todo.repeat!=="none")bits.push({daily:"每天",weekdays:"工作日",weekly:"每周",monthly:"每月"}[todo.repeat]);if(todo.subtasks?.length)bits.push(`${todo.subtasks.filter(s=>s.done).length}/${todo.subtasks.length} 子任务`);return bits.join(" · ");}


function renderProjects() {
  const items = state.projects.map(p => ({ key:`p:${p.id}`, type:"project", data:p }))
    .concat(state.areas.flatMap(a => a.tasks.filter(t=>t.status===1).map(t => ({ key:`a:${t.id}`, type:"area", data:t, area:a }))));
  const rank = new Map(state.projectOrder.map((key,index)=>[key,index]));
  items.sort((a,b)=>(rank.get(a.key)??9999)-(rank.get(b.key)??9999));
  state.projectOrder = [...new Set([...items.map(x=>x.key), ...state.projectOrder])];
  $("#projectGrid").innerHTML = items.map(item => {
    if (item.type === "project") {
      const p=item.data, progress=pct(p.steps);
      return `<article class="project-card" data-order-key="${item.key}" style="--c:${colors[p.area]}"><span class="drag-handle" draggable="true" data-drag-key="${item.key}" title="拖拽调整顺序">⠿</span><div class="project-title"><b>${escapeHtml(p.title)}</b><strong>${progress}%</strong></div><div class="progress"><i style="width:${progress}%"></i></div><div class="step-row">${p.steps.map(s => `<button class="step-dot s${s.status}" data-step="${s.id}" title="${statusText(s.status)}"><i>${s.status===2?"✓":s.status===1?"•":""}</i><span>${escapeHtml(s.text)}</span></button>`).join("")}</div><button class="project-edit" data-project="${p.id}">编辑项目</button></article>`;
    }
    const t=item.data, a=item.area, progress=pct(t.steps);
    return `<article class="project-card" data-order-key="${item.key}" style="--c:${colors[a.id]}"><span class="drag-handle" draggable="true" data-drag-key="${item.key}" title="拖拽调整顺序">⠿</span><div class="project-title"><b>${escapeHtml(t.text)}</b><strong>${progress}%</strong></div><div class="project-source">${a.name} · 来自领域仪表盘</div><div class="progress"><i style="width:${progress}%"></i></div><div class="step-row">${t.steps.map(s=>`<button class="step-dot s${s.status}" data-area-project-step="${s.id}" title="${statusText(s.status)}"><i>${s.status===2?"✓":s.status===1?"•":""}</i><span>${escapeHtml(s.text)}</span></button>`).join("")}</div><button class="project-edit" data-area-project="${t.id}">编辑项目</button></article>`;
  }).join("");
}

function renderAreas() {
  $("#areaGrid").innerHTML = state.areas.map(a => { const active=a.tasks.filter(t=>t.status===1).length,momentum=a.tasks.length?Math.round(active/a.tasks.length*100):0; return `<button class="area-card" data-area="${a.id}" style="--c:${colors[a.id]}"><div><i class="area-icon area-icon-${a.id}"><span></span></i><span><b>${a.name}</b><small>${a.cn}</small></span></div><div class="domain-state"><span><i class="pulse-dot"></i>${active} 项推进中</span></div><span class="momentum-label">活跃度 ${momentum}%</span><span class="ring" style="--p:${momentum*3.6}deg"></span></button>`; }).join("");
}

function renderSignals(steps) {
  const projectAverage = state.projects.length ? Math.round(state.projects.reduce((n,p)=>n+pct(p.steps),0)/state.projects.length) : 0;
  const areaAverage = state.areas.length ? Math.round(state.areas.reduce((n,a)=>n+(a.tasks.length?(a.tasks.filter(t=>t.status>0).length/a.tasks.length*100):0),0)/state.areas.length) : 0;
  const rows = [["今",`${steps.filter(x=>x.status===2).length}`,"今日完成"],["项",`${projectAverage}%`,"项目平均进度"],["域",`${areaAverage}%`,"领域活跃度"],["开",`${steps.filter(x=>x.status<2).length}`,"开放任务"]];
  $("#signals").innerHTML = rows.map(r=>`<div><i>${r[0]}</i><span><b>${r[1]}</b><small>${r[2]}</small></span></div>`).join("");
}

function cycleStep(id) {
  let changed;
  for (const p of state.projects) { const s=p.steps.find(x=>x.id===id); if(s){ s.status=(s.status+1)%3; changed=s; break; } }
  if (!changed) { const t=state.areas.flatMap(a=>a.tasks).find(x=>String(x.id)===String(id)); if(t){ t.status=(t.status+1)%3; changed=t; } }
  if (!changed) { const found=findAreaProjectStep(id); if(found){ found.step.status=(found.step.status+1)%3; changed=found.step; } }
  if (!changed) { const q=state.quick.find(x=>x.id===id); if(q){ q.status=(q.status+1)%3; changed=q; } }
  if (changed) {
    save();
    const modalStep = document.querySelector(`#modal [data-step="${id}"]`);
    if (modalStep) { modalStep.className=`status-pill s${changed.status}`; modalStep.textContent=statusText(changed.status); }
  }
}

function openArea(id) {
  const a=state.areas.find(x=>x.id===id);
  $("#modalBody").innerHTML=`<div class="modal-head" style="--c:${colors[id]}"><span>${a.name}</span><h2>${a.cn}长期方向</h2><p>状态：计划中 → 推进中。长期方向不会因为“完成”而消失。</p></div><div class="modal-steps area-task-list">${a.tasks.map(t=>`<div class="modal-sort-item" draggable="true" data-modal-type="area" data-modal-parent="${a.id}" data-modal-key="${t.id}"><span class="modal-grip">⠿</span><button type="button" class="status-pill domain-s${t.status}" data-area-step="${t.id}">${domainStatusText(t.status)}</button><input class="step-name-input" value="${escapeHtml(t.text)}" data-edit-area-task="${t.id}" aria-label="长期方向名称"><button type="button" data-delete-task="${t.id}" aria-label="删除方向">×</button></div>`).join("")}</div><div class="add-row"><input id="newTask" placeholder="添加新的长期方向"><button type="button" data-add-task="${id}">添加</button></div>`;
  if (!$("#modal").open) $("#modal").showModal();
}

function openProject(id) {
  const p=state.projects.find(x=>x.id===id);
  $("#modalBody").innerHTML=`<div class="modal-head" style="--c:${colors[p.area]}"><span>PROJECT</span><div class="project-name-row"><input class="project-name-input" value="${escapeHtml(p.title)}" data-edit-project-name="${p.id}" aria-label="项目名称"><button type="button" class="delete-project" data-delete-project="${p.id}">删除项目</button></div><p>名称和每一步都能直接编辑；拖动左侧把手调整顺序。</p></div><div class="modal-steps">${p.steps.map(s=>`<div class="modal-sort-item" draggable="true" data-modal-type="project" data-modal-parent="${p.id}" data-modal-key="${s.id}"><span class="modal-grip">⠿</span><button type="button" class="status-pill s${s.status}" data-step="${s.id}">${statusText(s.status)}</button><input class="step-name-input" value="${escapeHtml(s.text)}" data-edit-step="${s.id}" aria-label="步骤名称"><button type="button" data-delete-step="${s.id}" aria-label="删除步骤">×</button></div>`).join("")}</div><div class="add-row"><input id="newStep" placeholder="拆解新的项目步骤"><button type="button" data-add-step="${id}">添加</button></div>`;
  if (!$("#modal").open) $("#modal").showModal();
}

function openAreaProject(taskId) {
  const area=state.areas.find(a=>a.tasks.some(t=>String(t.id)===String(taskId)));
  const task=area?.tasks.find(t=>String(t.id)===String(taskId));
  if (!task) return;
  $("#modalBody").innerHTML=`<div class="modal-head" style="--c:${colors[area.id]}"><span>${area.name} · FROM DASHBOARD</span><div class="project-name-row"><input class="project-name-input" value="${escapeHtml(task.text)}" data-edit-area-project="${task.id}" aria-label="项目名称"><button type="button" class="delete-project" data-delete-area-project="${task.id}">删除项目</button></div><p>可以修改标题、拆解步骤，并拖动左侧把手调整顺序。</p></div><div class="modal-steps">${task.steps.map(s=>`<div class="modal-sort-item" draggable="true" data-modal-type="areaProject" data-modal-parent="${task.id}" data-modal-key="${s.id}"><span class="modal-grip">⠿</span><button type="button" class="status-pill s${s.status}" data-area-project-step="${s.id}">${statusText(s.status)}</button><input class="step-name-input" value="${escapeHtml(s.text)}" data-edit-area-project-step="${s.id}" aria-label="步骤名称"><button type="button" data-delete-area-project-step="${s.id}" aria-label="删除步骤">×</button></div>`).join("")}</div><div class="add-row"><input id="newAreaProjectStep" placeholder="拆解新的项目步骤"><button type="button" data-add-area-project-step="${task.id}">添加</button></div>`;
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
  $("#modalBody").innerHTML=`<div class="modal-head todo-editor-head" style="--c:${colors[context.area]||colors.admin}"><span>TASK DETAILS</span><h2>${todo?"编辑任务":"新建今日待办"}</h2><p>${key&&!key.startsWith("quick:")?`来自项目：${escapeHtml(context.project)}。把大步骤继续细化为可执行的子任务。`:"记录任务，并按需要继续拆解子任务。"}</p></div><div class="todo-form"><label><span>任务标题</span><input id="todoTitle" value="${escapeHtml(data.text)}" placeholder="例如：游泳"></label><div class="schedule-fields"><label><span>日期</span><div class="schedule-input"><input id="todoDate" type="date" value="${dateValue}"><button type="button" data-clear-todo-date>清除</button></div></label><label><span>时间 <small>选填</small></span><div class="schedule-input"><input id="todoTime" type="time" value="${timeValue}"><button type="button" data-clear-todo-time>清除</button></div></label><label><span>重复</span><select id="todoRepeat"><option value="none">不重复</option><option value="daily">每天</option><option value="weekdays">工作日</option><option value="weekly">每周</option><option value="monthly">每月</option></select></label></div><label><span>备注</span><textarea id="todoNotes" rows="3" placeholder="地点、准备物品、联系方式……">${escapeHtml(data.notes||"")}</textarea></label><div class="subtask-editor"><div class="subtask-editor-title"><span>子任务</span><small>逐条添加具体动作</small></div><div id="todoSubtaskRows" class="subtask-editor-list">${subtaskRows}</div><div class="subtask-add-row"><input id="newSubtaskInput" placeholder="输入一个子任务"><button type="button" data-add-subtask-row>＋ 添加</button></div></div><button type="button" class="todo-save" data-save-action="${key}" data-action-area="${context.area}" data-action-project="${escapeHtml(context.project)}">${todo?"保存任务":"加入今日待办"}</button></div>`;
  $("#todoRepeat").value=data.repeat||"none";
  if(!$("#modal").open)$("#modal").showModal();
  $("#todoTitle").focus();
}

function subtaskEditorRow(subtask={id:"",text:"",done:false}){return `<div class="subtask-editor-row" data-subtask-row data-subtask-id="${subtask.id||`sub${Date.now()}`}" data-subtask-done="${subtask.done?"1":"0"}"><i class="subtask-row-dot"></i><input data-subtask-text value="${escapeHtml(subtask.text||"")}" placeholder="子任务内容"><button type="button" data-remove-subtask-row aria-label="删除子任务">×</button></div>`;}

function openNewProject(){
  $("#modalBody").innerHTML=`<div class="modal-head"><span>NEW PROJECT</span><h2>新建项目</h2><p>先给项目一个名字和所属领域，再逐步拆解。</p></div><div class="form-stack"><input id="projectName" placeholder="项目名称"><select id="projectArea">${state.areas.map(a=>`<option value="${a.id}">${a.name} · ${a.cn}</option>`).join("")}</select><button type="button" data-create-project>创建项目</button></div>`; $("#modal").showModal();
}

document.addEventListener("click", e => {
  if(e.target.closest("#cloudAccount")){openCloudAccount();return;}
  if(e.target.matches("[data-cloud-signin]")){cloudAuth("signin");return;}
  if(e.target.matches("[data-cloud-signup]")){cloudAuth("signup");return;}
  if(e.target.matches("[data-cloud-sync]")){pushCloudState();return;}
  if(e.target.matches("[data-cloud-signout]")){cloudClient?.auth.signOut();cloudUser=null;cloudReady=false;cloudStatus="本机保存";updateCloudButton();$("#modal").close();return;}
  const nav=e.target.closest(".nav-item");
  if(nav){
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x===nav));
    const targets={today:".timeline-panel",projects:".projects-panel",areas:".areas-panel",inbox:".focus-panel"};
    document.querySelector(targets[nav.dataset.view])?.scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  if(e.target.matches("[data-date-shift]")){state.viewDate=shiftDate(state.viewDate,Number(e.target.dataset.dateShift));timelineInitialized=false;save();return;}
  if(e.target.matches("[data-date-today]")){state.viewDate=localDateISO(new Date());timelineInitialized=false;save();return;}
  const step=e.target.closest("[data-step]"); if(step) return cycleStep(step.dataset.step);
  const areaProjectStep=e.target.closest("[data-area-project-step]");
  if(areaProjectStep){ const found=findAreaProjectStep(areaProjectStep.dataset.areaProjectStep); if(found){found.step.status=(found.step.status+1)%3;save(); if($("#modal").open) openAreaProject(found.task.id);} return; }
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
  if(e.target.matches("[data-complete-action]")){const todo=sourceItem(e.target.dataset.completeAction);if(todo){if(todo.repeat&&todo.repeat!=="none"){if(!Array.isArray(todo.completions))todo.completions=[];if(!todo.completions.includes(state.viewDate))todo.completions.push(state.viewDate);}else{todo.status=2;}save();}return;}
  if(e.target.matches("[data-save-action]")){const title=$("#todoTitle").value.trim();if(!title)return;let key=e.target.dataset.saveAction,todo=key?sourceItem(key):null;if(!todo){todo={id:"q"+Date.now(),status:1,area:e.target.dataset.actionArea||"admin",sourceProject:e.target.dataset.actionProject||"独立待办",subtasks:[]};state.quick.push(todo);key=`quick:${todo.id}`;}todo.text=title;const date=$("#todoDate").value,time=$("#todoTime").value;if(date){todo.due=time?`${date}T${time}`:date;todo.scheduledDate=date;}else{delete todo.due;delete todo.scheduledDate;}if(time){todo.scheduledHour=`${time.slice(0,2)}:00`;}else{delete todo.scheduledHour;delete todo.duration;}todo.repeat=$("#todoRepeat").value;todo.notes=$("#todoNotes").value.trim();const pending=$("#newSubtaskInput")?.value.trim();if(pending)$("#todoSubtaskRows").insertAdjacentHTML("beforeend",subtaskEditorRow({id:`sub${Date.now()}`,text:pending,done:false}));todo.subtasks=[...document.querySelectorAll("#todoSubtaskRows [data-subtask-row]")].map(row=>({id:row.dataset.subtaskId,text:row.querySelector("[data-subtask-text]").value.trim(),done:row.dataset.subtaskDone==="1"})).filter(s=>s.text);save();$("#modal").close();return;}
  if(e.target.matches("[data-delete-todo]")){ const key=e.target.dataset.deleteTodo; const [type,...parts]=key.split(":"); const id=parts.join(":"); if(type==="pstep") state.projects.forEach(p=>p.steps=p.steps.filter(s=>String(s.id)!==id)); if(type==="atask") state.areas.forEach(a=>a.tasks=a.tasks.filter(t=>String(t.id)!==id)); if(type==="astep") { const found=findAreaProjectStep(id); if(found) found.task.steps=found.task.steps.filter(s=>String(s.id)!==id); } if(type==="quick") state.quick=state.quick.filter(q=>String(q.id)!==id); state.todoOrder=state.todoOrder.filter(k=>k!==key); save(); return; }
  if(e.target.matches("[data-area-step]")){ const id=e.target.dataset.areaStep; const t=state.areas.flatMap(a=>a.tasks).find(x=>String(x.id)===String(id)); if(t){t.status=(t.status+1)%2;save(); const area=state.areas.find(a=>a.tasks.includes(t)); openArea(area.id);} return; }
  if(e.target.matches("[data-add-task]")){ const input=$("#newTask"); if(input.value.trim()){state.areas.find(a=>a.id===e.target.dataset.addTask).tasks.push({id:Date.now(),text:input.value.trim(),status:0,steps:[]});save();openArea(e.target.dataset.addTask);} }
  if(e.target.matches("[data-delete-task]")){ const id=Number(e.target.dataset.deleteTask); state.areas.forEach(a=>a.tasks=a.tasks.filter(t=>t.id!==id)); save(); $("#modal").close(); }
  if(e.target.matches("[data-add-step]")){ const input=$("#newStep"); const id=e.target.dataset.addStep; if(input.value.trim()){state.projects.find(p=>p.id===id).steps.push({id:"s"+Date.now(),text:input.value.trim(),status:0});save();openProject(id);} }
  if(e.target.matches("[data-delete-step]")){ const id=e.target.dataset.deleteStep; state.projects.forEach(p=>p.steps=p.steps.filter(s=>s.id!==id)); save(); $("#modal").close(); }
  if(e.target.matches("[data-delete-project]")){ const id=e.target.dataset.deleteProject; if(confirm("确定删除这个项目及全部步骤吗？")){state.projects=state.projects.filter(p=>p.id!==id);save();$("#modal").close();} }
  if(e.target.matches("[data-add-area-project-step]")){ const taskId=e.target.dataset.addAreaProjectStep; const input=$("#newAreaProjectStep"); const task=state.areas.flatMap(a=>a.tasks).find(t=>String(t.id)===String(taskId)); if(task&&input.value.trim()){task.steps.push({id:"as"+Date.now(),text:input.value.trim(),status:0});save();openAreaProject(taskId);} }
  if(e.target.matches("[data-delete-area-project-step]")){ const found=findAreaProjectStep(e.target.dataset.deleteAreaProjectStep); if(found){found.task.steps=found.task.steps.filter(s=>String(s.id)!==String(e.target.dataset.deleteAreaProjectStep));save();openAreaProject(found.task.id);} }
  if(e.target.matches("[data-delete-area-project]")){ const id=e.target.dataset.deleteAreaProject; if(confirm("确定删除这个项目吗？它也会从领域仪表盘中删除。")){state.areas.forEach(a=>a.tasks=a.tasks.filter(t=>String(t.id)!==String(id)));state.projectOrder=state.projectOrder.filter(k=>k!==`a:${id}`);save();$("#modal").close();} }
  if(e.target.matches("[data-create-project]")){ const name=$("#projectName").value.trim(); if(name){state.projects.push({id:"p"+Date.now(),title:name,area:$("#projectArea").value,steps:[]});save();$("#modal").close();} }
});

document.addEventListener("change", e => {
  if(e.target.matches("#calendarDate")){state.viewDate=e.target.value||localDateISO(new Date());timelineInitialized=false;save();return;}
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
  if(hour&&draggedTodoKey){e.preventDefault();const item=sourceItem(draggedTodoKey);if(item){allSteps().filter(x=>occursOn(x,state.viewDate)&&x.scheduledHour===hour.dataset.hour&&x.sourceKey!==draggedTodoKey).forEach(x=>{const old=sourceItem(x.sourceKey);if(old)delete old.scheduledHour;});item.scheduledHour=hour.dataset.hour;item.scheduledDate=state.viewDate;item.due=`${state.viewDate}T${hour.dataset.hour}`;if(!item.duration)item.duration=1;draggedTodoKey="";save();}return;}
  const todoTarget=e.target.closest("[data-todo-key]");
  if(todoTarget&&draggedTodoKey&&todoTarget.dataset.todoKey!==draggedTodoKey){e.preventDefault();const from=state.todoOrder.indexOf(draggedTodoKey);if(from>=0)state.todoOrder.splice(from,1);const to=state.todoOrder.indexOf(todoTarget.dataset.todoKey);state.todoOrder.splice(to<0?state.todoOrder.length:to,0,draggedTodoKey);draggedTodoKey="";save();return;}
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
render();
initCloud();
