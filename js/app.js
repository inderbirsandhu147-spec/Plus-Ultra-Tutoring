import { settings } from '../firebase-config.js';
import { createDemoStore } from './store.js';
import { taskGroup, goalAverage, needsSupport, safeURL, today, offsetDate, uid, validateFile } from './domain.js';

const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths = {
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  book:'M12 5v16 M3 3c4-1 6 0 9 2 3-2 5-3 9-2v16c-4-1-6 0-9 2-3-2-5-3-9-2z',
  calendar:'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  chart:'M4 3v18h17 M8 16l4-5 4 2 5-7',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3l-1 3-3 1-2 3 2 2-1 4 3 2 3-1 2 4 3-1 1-3 4-2-1-3 2-3-2-2-3 1-2-3z',
  plus:'M12 5v14 M5 12h14', search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow:'M5 12h14 M14 7l5 5-5 5', chevron:'M9 5l7 7-7 7', clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  check:'M5 12l4 4L19 6', circle:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M7 12l3 3 7-7',
  alert:'M12 8v5 M12 17h.01 M10 3L1 20h22L14 3z', leaf:'M4 20L18 6 M3 12c0-7 8-9 18-9 0 10-2 18-9 18-6 0-9-3-9-9',
  logout:'M9 21H4V3h5 M12 12h10 M18 8l4 4-4 4', lock:'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4',
  close:'M6 6l12 12 M6 18L18 6', menu:'M4 6h16 M4 12h16 M4 18h16', file:'M14 2H5v20h14V7z M14 2v6h5 M8 13h8 M8 17h6',
  heart:'M20 4c-3-3-7-1-8 2-1-3-5-5-8-2-4 4 0 9 8 15 8-6 12-11 8-15', star:'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z', link:'M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l2-2'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.book}"/></svg>`;
let store, user, unsubscribe, data={students:[],assignments:[],sessions:[],notes:[],assessments:[]};
let route='dashboard', selectedStudent='', filter='all', query='', demoRoster=[], loadError='', loaded=false, toastTimer;
let authMode='login';
const modal=$('#modal');
const tutor=()=>user?.role==='tutor';
const studentById=id=>data.students.find(s=>s.id===id);
const personName=id=>studentById(id)?.name || 'Student';
const initials=name=>String(name||'S').trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
const avatar=s=>`<span class="avatar ${esc(s?.color||'lilac')}">${esc(initials(s?.name))}</span>`;
const friendlyDate=(date,opts={month:'short',day:'numeric'})=>{const value=new Date(`${date}T12:00:00`);return Number.isNaN(value.getTime())?'—':new Intl.DateTimeFormat('en-GB',opts).format(value);};
const fullDate=()=>new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date());
const dueText=date=>date===today()?'Today':date===offsetDate(1)?'Tomorrow':friendlyDate(date);
const labels={upcoming:'Upcoming',overdue:'Overdue',submitted:'To review',completed:'Completed'};
const status=a=>{const group=taskGroup(a);return `<span class="chip ${ {upcoming:'gray',overdue:'red',submitted:'orange',completed:'green'}[group]}">${group==='submitted'&&!tutor()?'Submitted':labels[group]}</span>`;};
const chip=subject=>`<span class="chip ${subject==='Physics'?'blue':subject==='English'?'orange':''}">${esc(subject)}</span>`;
const matches=text=>String(text).toLowerCase().includes(query.toLowerCase());
function toast(message) {$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),6500);}
function errorText(error) {
  const code=error?.code||'';
  if(code.includes('permission-denied'))return 'Access denied. Check your tutor enrollment and deploy the supplied Firebase rules.';
  if(code.includes('invalid-credential')||code.includes('user-not-found')||code.includes('wrong-password'))return 'The email or password is incorrect. Please try again.';
  if(code.includes('email-already-in-use'))return 'This email already has an account. Sign in or reset your password.';
  if(code.includes('too-many-requests'))return 'Too many attempts. Please wait a little before trying again.';
  if(code.includes('network'))return 'Could not reach Firebase. Check your connection and try again.';
  if(error?.name==='QuotaExceededError')return 'Demo storage is full. Try a smaller file; Firebase mode supports files up to 10 MB.';
  return error?.message||'Something went wrong. Please try again.';
}
function empty(title,text,action='') {return `<div class="empty">${icon('leaf')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;}
function button(text,action,cls='primary',extra='') {return `<button class="btn ${cls}" data-action="${action}" ${extra}>${esc(text)}</button>`;}
function goalBar(progress,cls='') {return `<div class="progress-bar ${cls}" role="progressbar" aria-label="Goal progress" aria-valuenow="${Number(progress)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.min(100,Math.max(0,Number(progress)))}%"></span></div>`;}
function navigate(next,id='') {route=next;selectedStudent=id;filter='all';query='';render();window.scrollTo({top:0});}
function panel(title,subtitle,content,action='') {return `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${action}</div>${content}</section>`;}
function demoBanner() {
  if(store.mode!=='demo')return '';
  const roster=demoRoster.length?demoRoster:data.students;
  return `<div class="demo-banner"><span><i class="dot"></i>Sample workspace · saved in this browser</span><div class="demo-controls"><label for="demo-role" class="small">Preview as</label><select id="demo-role" aria-label="Preview tutor or student"><option value="tutor" ${tutor()?'selected':''}>Tutor</option>${roster.map(s=>`<option value="${esc(s.id)}" ${user.studentId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><button class="btn subtle" data-action="setup">Connect Firebase ${icon('arrow')}</button></div></div>`;
}
function render() {
  if(!user || user.unverified) {renderAuth();return;}
  const nav=tutor()?[['dashboard','grid','Overview'],['students','people','Students'],['assignments','book','Assignments'],['sessions','calendar','Sessions'],['progress','chart','Progress']]:[['dashboard','grid','My workspace'],['assignments','book','My assignments'],['progress','chart','My progress']];
  const current=nav.find(n=>n[0]===route)?.[2] || (route==='profile'?'Student profile':route==='setup'?'Settings & Firebase':'Search');
  const reviews=data.assignments.filter(a=>a.status==='submitted').length;
  $('#app').innerHTML=`<div class="shell"><button class="mobile-overlay" data-action="menu" aria-label="Close navigation"></button><aside class="sidebar"><div class="brand"><span class="brand-mark">c.</span><div><span class="brand-name">${esc(settings.businessName)}</span><small>Tutoring workspace</small></div></div><div class="nav-label">YOUR WORKSPACE</div><nav class="nav" aria-label="Main navigation">${nav.map(([key,i,label])=>`<button data-nav="${key}" class="${route===key||(route==='profile'&&key==='students')?'active':''}" ${route===key?'aria-current="page"':''}>${icon(i)}${label}${key==='assignments'&&reviews?`<span class="nav-count">${reviews}</span>`:''}</button>`).join('')}<button data-nav="setup" class="${route==='setup'?'active':''}">${icon('settings')}Settings</button></nav><div class="sidebar-bottom"><div class="sidebar-tip">${icon('leaf')}<h4>A little progress, every day.</h4><p>Big things grow from small, consistent steps.</p></div><div class="account"><span class="avatar lilac">${tutor()?'IS':esc(initials(data.students[0]?.name||user.name))}</span><div><strong>${tutor()?esc(user.name||'Your workspace'):esc(data.students[0]?.name||'Student')}</strong><small>${tutor()?'Tutor account':'Student account'}</small></div><button class="icon-btn" data-action="logout" aria-label="${store.mode==='demo'?'Leave demo':'Sign out'}" title="${store.mode==='demo'?'Leave demo':'Sign out'}">${icon('logout')}</button></div></div></aside><div class="workspace"><header class="topbar"><button class="icon-btn menu-btn" data-action="menu" aria-label="Open navigation">${icon('menu')}</button><div class="breadcrumb">Workspace ${icon('chevron')} <b>${esc(current)}</b></div><div class="top-actions"><label class="search">${icon('search')}<input id="global-search" type="search" placeholder="Search your workspace…" aria-label="Search your workspace" value="${esc(query)}"></label><span class="mode-label"><i class="sync-dot"></i>${store.mode==='demo'?'Demo workspace':'Firebase connected'}</span><span class="avatar top-avatar">${tutor()?'IS':esc(initials(data.students[0]?.name))}</span></div></header><main id="main" class="main" tabindex="-1">${demoBanner()}${loadError?`<div role="alert" class="view-alert">${esc(loadError)} <button class="text-btn" data-action="retry">Try again</button></div>`:''}${!loaded&&!loadError?'<div class="empty">Loading your workspace…</div>':pageContent()}<footer class="footer"><span>${icon('heart')} A little progress, every day.</span><span>${esc(settings.businessName)} · Made for learning</span></footer></main></div></div>`;
}
function pageContent() {
  if(query)return searchPage();
  if(route==='dashboard')return tutor()?dashboard():studentDashboard();
  if(route==='students'&&tutor())return studentsPage();
  if(route==='profile'&&tutor())return profilePage();
  if(route==='assignments')return assignmentsPage();
  if(route==='sessions'&&tutor())return sessionsPage();
  if(route==='progress')return progressPage();
  if(route==='setup')return setupPage();
  return studentDashboard();
}
function heading(title,description,actions='') {return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="heading-actions">${actions}</div></div>`;}
function welcomeArt(){return '<div class="welcome-art" aria-hidden="true"><div class="orb"></div><div class="art-book"></div><div class="art-star">✦</div><div class="art-pencil"></div><span class="spark">✧</span><span class="spark two">✦</span></div>';}
function stat(title,value,detail,i,detailClass='') {return `<div class="stat"><div class="stat-top"><span>${title}</span><span class="stat-icon">${icon(i)}</span></div><strong>${value}</strong><div class="stat-bottom"><span class="${detailClass}">${detail}</span></div></div>`;}
function dashboard() {
  const reviews=data.assignments.filter(a=>a.status==='submitted'), overdue=data.assignments.filter(a=>taskGroup(a)==='overdue');
  const upcoming=data.sessions.filter(s=>s.date>=today()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const complete=data.assignments.filter(a=>a.status==='completed').length;
  const support=data.students.filter(s=>needsSupport(s,data.assignments));
  return heading('A good day to make progress.','A little clarity for you. A little confidence for your students.',`<span class="date-label">${icon('calendar')}${fullDate()}</span><button class="btn primary" data-action="assignment">${icon('plus')} New assignment</button>`)+
    `<section class="welcome"><div class="welcome-copy"><div class="eyebrow">YOUR TEACHING, ALL TOGETHER</div><h2>Small steps. Meaningful growth.</h2><p>You have ${upcoming.filter(s=>s.date===today()).length} sessions today and ${reviews.length} ${reviews.length===1?'submission':'submissions'} ready for your feedback.<br>Let’s help someone take their next step.</p></div>${welcomeArt()}</section>`+
    `<div class="stats">${stat('Active students',data.students.length,'Learning at their own pace','people')}${stat('Work completed',complete,'Every step counts','circle','positive')}${stat('Ready for review',reviews.length,'A little feedback goes a long way','book','warm')}${stat('Overdue assignments',overdue.length,overdue.length?'Time for a gentle check-in':'All caught up. Lovely!','clock')}</div>`+
    `<div class="dashboard-grid"><div class="stack">${panel('Your students','A snapshot of their learning journey',`<div class="panel-body">${data.students.slice(0,5).map(studentRow).join('')||empty('Your first student starts here','Add a student and give their learning journey a home.',button('Add student','student'))}</div>`,`<button class="text-btn" data-nav="students">View all ${icon('arrow')}</button>`)}${panel('Assignments at a glance','The next steps, and the work worth celebrating',assignmentTable([...reviews,...data.assignments.filter(a=>a.status!=='submitted')].slice(0,5)),`<button class="text-btn" data-nav="assignments">View all ${icon('arrow')}</button>`)}</div><div class="stack">${panel('Upcoming sessions','A little preparation goes a long way',`<div class="schedule-date">${fullDate()}</div><div class="panel-body">${upcoming.slice(0,3).map(sessionRow).join('')||empty('Space for something good','Schedule a session to see it here.')}</div>`,`<button class="text-btn" data-nav="sessions" aria-label="View all sessions">${icon('arrow')}</button>`)}<section class="panel support-panel"><div class="panel-head"><h2>A little extra support</h2>${icon('heart')}</div><div class="panel-body">${support.slice(0,3).map(s=>`<div class="student-row">${avatar(s)}<div class="student-info"><strong>${esc(s.name)}</strong><p>${data.assignments.some(a=>a.studentId===s.id&&taskGroup(a)==='overdue')?'Has work to catch up on':'Building their foundations'}</p></div><button class="text-btn" data-profile="${esc(s.id)}" aria-label="Open ${esc(s.name)}">${icon('arrow')}</button></div>`).join('')||'<p class="muted small">Everyone is moving forward. Keep encouraging them!</p>'}</div></section><div class="quote"><p>“It’s not about being the best.<br>It’s about being better than yesterday.”</p><small>A LITTLE REMINDER</small></div></div></div>`;
}
function studentRow(s) {const p=goalAverage(s);return `<div class="student-row">${avatar(s)}<div class="student-info"><strong>${esc(s.name)}</strong><p>${esc(s.level)} · ${esc(s.subjects.join(' & '))}</p></div><div class="progress-mini"><div class="progress-label"><span>Goal progress</span><b>${p}%</b></div>${goalBar(p)}</div><button class="icon-btn" data-profile="${esc(s.id)}" aria-label="Open ${esc(s.name)}">${icon('chevron')}</button></div>`;}
function assignmentTable(tasks) {
  if(!tasks.length)return empty('A clear space for the next step','Assignments will appear here when you create them.');
  return `<div class="table-wrap"><table class="table"><thead><tr><th>ASSIGNMENT</th>${tutor()?'<th>STUDENT</th>':''}<th>DUE DATE</th><th>STATUS</th><th></th></tr></thead><tbody>${tasks.map(a=>`<tr><td class="title-cell"><strong>${esc(a.title)}</strong><small>${esc(a.subject)}</small></td>${tutor()?`<td>${esc(personName(a.studentId).split(' ')[0])}</td>`:''}<td class="nowrap">${dueText(a.dueDate)}</td><td>${status(a)}</td><td><button class="text-btn" data-task="${esc(a.id)}" aria-label="Open ${esc(a.title)}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`;
}
function sessionRow(s) {return `<div class="session"><div class="session-time">${esc(s.time)}</div><div class="session-details"><strong>${esc(personName(s.studentId))}</strong><p>${esc(s.topic)}</p><div>${chip(s.subject)} <small>· ${s.duration} min${s.date!==today()?` · ${friendlyDate(s.date)}`:''}</small></div></div></div>`;}
function studentsPage() {
  return heading('Every student, their own journey.','A space for their goals, their growth, and your guidance.',`<button class="btn primary" data-action="student">${icon('plus')} Add student</button>`)+
  `<div class="students-grid">${data.students.map(s=>`<button class="student-card" data-profile="${esc(s.id)}"><div class="card-top">${avatar(s)}${needsSupport(s,data.assignments)?'<span class="chip orange">A little support</span>':'<span class="chip green">Moving forward</span>'}</div><h3>${esc(s.name)}</h3><p>${esc(s.level)}</p><div class="subjects">${s.subjects.map(chip).join('')}</div><div class="progress-label"><span>Learning goal progress</span><b>${goalAverage(s)}%</b></div>${goalBar(goalAverage(s))}<div class="card-bottom"><span>${data.assignments.filter(a=>a.studentId===s.id&&a.status!=='completed').length} active tasks</span><span>View profile ${icon('arrow')}</span></div></button>`).join('')}</div>${!data.students.length?empty('Let’s meet your first student','Add their details, then set a small, achievable learning goal.',button('Add student','student')):''}`;
}
function assignmentTabs() {return `<div class="section-tabs" aria-label="Filter assignments">${['all','upcoming','overdue','submitted','completed'].map(g=>`<button data-filter="${g}" class="${filter===g?'active':''}" aria-pressed="${filter===g}">${g==='all'?'All assignments':g==='submitted'&&!tutor()?'Submitted':labels[g]}<span>${g==='all'?data.assignments.length:data.assignments.filter(a=>taskGroup(a)===g).length}</span></button>`).join('')}</div>`;}
function assignmentsPage() {
  const tasks=data.assignments.filter(a=>filter==='all'||taskGroup(a)===filter).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  return heading(tutor()?'The next little steps.':'Your next little steps.',tutor()?'Set the work. See the effort. Celebrate the progress.':'Take it one task at a time. You’ve got this.',tutor()?`<button class="btn primary" data-action="assignment">${icon('plus')} New assignment</button>`:'')+assignmentTabs()+
    (tutor()?panel('Assignments',`${tasks.length} ${tasks.length===1?'assignment':'assignments'}`,assignmentTable(tasks)):tasks.length?`<div class="task-grid">${tasks.map(taskCard).join('')}</div>`:empty('All clear here','You’ll find your next step here when your tutor assigns it.'));
}
function taskCard(a) {return `<article class="task-card"><div class="card-top">${chip(a.subject)}${status(a)}</div><h3>${esc(a.title)}</h3><p>${esc(a.instructions.slice(0,155))}${a.instructions.length>155?'…':''}</p><div class="card-bottom"><small>${icon('calendar')} Due ${dueText(a.dueDate)}</small><button class="btn ${a.status==='assigned'?'primary':''}" data-task="${esc(a.id)}">${a.status==='assigned'?'Let’s do this':a.status==='submitted'?'View submission':'Read feedback'} ${icon('arrow')}</button></div></article>`;}
function studentDashboard() {
  const s=data.students[0];
  if(!s)return heading('Welcome to your workspace.','Your next chapter starts here.')+empty('Your tutor will get you started','Ask your tutor to add a profile using the same verified email you signed in with.');
  const tasks=data.assignments.filter(a=>a.status==='assigned').sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const complete=data.assignments.filter(a=>a.status==='completed').length;
  return heading(`Hi, ${s.name.split(' ')[0]}. Ready for a little progress?`,'This is your space to learn, try, and grow.')+
    `<section class="welcome student-welcome"><div class="welcome-copy"><div class="eyebrow">ONE STEP AT A TIME</div><h2>You’re growing. Keep going.</h2><p>${complete?`You’ve completed ${complete} ${complete===1?'task':'tasks'}. Every bit of effort is making a difference.`:'Every question you try is a step forward. Start with one small task today.'}</p></div>${welcomeArt()}</section>`+
    `<div class="stats">${stat('Next steps',tasks.length,'Take them one at a time','book')}${stat('Submitted',data.assignments.filter(a=>a.status==='submitted').length,'Your tutor will take a look','clock')}${stat('Completed',complete,'Look how far you’ve come','circle')}${stat('Goal progress',`${goalAverage(s)}%`,'Small steps add up','leaf')}</div><div class="two-col"><div>${panel('Your next steps','Start anywhere. Just start.',`<div class="panel-body">${tasks.slice(0,3).map(a=>`<div class="student-row"><span class="avatar">${icon('book')}</span><div class="student-info"><strong>${esc(a.title)}</strong><p>${esc(a.subject)} · Due ${dueText(a.dueDate)}</p></div><button class="text-btn" data-task="${esc(a.id)}" aria-label="Open ${esc(a.title)}">${icon('arrow')}</button></div>`).join('')||empty('You’re all caught up!','A lovely moment to celebrate your effort.')}</div>`,`<button class="text-btn" data-nav="assignments">View all ${icon('arrow')}</button>`)}</div>${panel('The things you’re working toward','Progress comes with practice.',`<div class="panel-body">${goalList(s)}</div>`)}</div>`;
}
function goalList(s) {return s.goals.length?s.goals.map(g=>`<div class="goal-item"><div class="goal-label"><span>${esc(g.title)}</span><b>${Number(g.progress)}%</b></div>${goalBar(g.progress)}<small>${g.progress>=100?'You did it. What a lovely achievement!':g.progress>=70?'You’re getting closer. Keep it up!':'Every practice is a step forward.'}</small></div>`).join(''):'<p class="muted small spaced">Your next learning goal will appear here.</p>';}
function profilePage() {
  const s=studentById(selectedStudent);if(!s)return studentsPage();
  const notes=data.notes.filter(n=>n.studentId===s.id).sort((a,b)=>b.date.localeCompare(a.date));
  const scores=data.assessments.filter(a=>a.studentId===s.id).sort((a,b)=>a.date.localeCompare(b.date));
  return `<div class="page-heading profile-page-heading"><div class="profile-head"><span class="avatar large ${esc(s.color)}">${esc(initials(s.name))}</span><div><h1>${esc(s.name)}</h1><p>${esc(s.level)} · ${esc(s.email)}</p><div class="subjects">${s.subjects.map(chip).join('')}</div></div></div><div class="heading-actions"><button class="btn" data-edit-student="${esc(s.id)}">Edit profile</button><button class="btn primary" data-action="assignment" data-student="${esc(s.id)}">${icon('plus')} Assign task</button></div></div><div class="two-col"><div class="stack">${panel('Learning goals','Meaningful steps toward more confidence.',`<div class="panel-body">${goalList(s)}</div>`,`<button class="text-btn" data-goal="${esc(s.id)}">${icon('plus')} Add goal</button>`)}${panel('Assessment history','A picture of progress over time.',`<div class="panel-body">${assessmentChart(scores)}${assessmentList(scores)}</div>`,`<button class="text-btn" data-assessment="${esc(s.id)}">${icon('plus')} Record result</button>`)}</div><div class="stack">${panel('Session notes','Private to your tutor account.',`<div class="panel-body"><div class="timeline">${notes.map(n=>`<div class="timeline-item"><small>${friendlyDate(n.date)}</small><p>${esc(n.text)}</p></div>`).join('')||'<p class="muted small spaced">A space for observations, breakthroughs, and what comes next.</p>'}</div></div>`,`<button class="text-btn" data-note="${esc(s.id)}">${icon('plus')} Add note</button>`)}${panel('Assignments','Their next steps and recent achievements.',assignmentTable(data.assignments.filter(a=>a.studentId===s.id)))}</div></div>`;
}
function assessmentChart(scores) {
  if(!scores.length)return '<p class="muted small spaced">Record a result to start seeing progress over time.</p>';
  const shown=scores.slice(-7);
  return `<div class="chart" role="img" aria-label="Assessment scores in date order: ${shown.map(s=>`${esc(s.title)} ${s.score}%`).join(', ')}">${shown.map(s=>`<div class="chart-col"><span>${s.score}%</span><div class="chart-bar" style="height:${s.score*1.1}px"></div></div>`).join('')}</div><div class="chart-labels">${shown.map(s=>`<small>${friendlyDate(s.date)}</small>`).join('')}</div>`;
}
function assessmentList(scores) {return scores.length?`<div class="spaced">${[...scores].reverse().slice(0,7).map(s=>`<div class="student-row"><div class="student-info"><strong>${esc(s.title)}</strong><p>${friendlyDate(s.date)}</p></div><span class="chip green">${s.score}%</span></div>`).join('')}</div>`:'';}
function progressPage() {
  return heading(tutor()?'The bigger picture.':'Look how far you’ve come.',tutor()?'Small efforts become meaningful progress.':'Progress takes practice. Every step is worth celebrating.')+(data.students.length?`<div class="stack">${data.students.map(s=>{const scores=data.assessments.filter(a=>a.studentId===s.id).sort((a,b)=>a.date.localeCompare(b.date));return panel(esc(s.name),`${esc(s.subjects.join(' · '))} · ${data.assignments.filter(a=>a.studentId===s.id&&a.status==='completed').length} completed tasks`,`<div class="panel-body two-col"><div>${goalList(s)}</div><div>${assessmentChart(scores)}${assessmentList(scores)}</div></div>`,tutor()?`<button class="text-btn" data-profile="${esc(s.id)}">View profile ${icon('arrow')}</button>`:'');}).join('')}</div>`:empty('Growth starts with a first step','Learning goals and assessment results will appear here.'));
}
function sessionsPage() {
  const sessions=[...data.sessions].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  return heading('A little time. A lot of possibility.','Plan your sessions and make space for learning.',`<button class="btn primary" data-action="session">${icon('plus')} Schedule session</button>`)+panel('Your sessions','All times are shown in your local time zone.',sessions.length?`<div class="table-wrap"><table class="table"><thead><tr><th>STUDENT</th><th>SUBJECT & FOCUS</th><th>DATE</th><th>TIME</th><th>DURATION</th></tr></thead><tbody>${sessions.map(s=>`<tr><td><button class="text-btn" data-profile="${esc(s.studentId)}">${esc(personName(s.studentId))}</button></td><td><strong>${esc(s.subject)}</strong><small>${esc(s.topic)}</small></td><td>${friendlyDate(s.date,{day:'numeric',month:'short',year:'numeric'})}</td><td>${esc(s.time)}</td><td>${s.duration} min</td></tr>`).join('')}</tbody></table></div>`:empty('Make time for a breakthrough','Schedule a session and see it here.'));
}
function searchPage() {
  const students=data.students.filter(s=>matches(s.name+' '+s.subjects.join(' '))),tasks=data.assignments.filter(a=>matches(a.title+' '+a.subject+' '+a.instructions));
  return heading('Find your next step.',`Results for “${query}”`)+`<div class="stack">${tutor()?panel('Students',`${students.length} found`,`<div class="panel-body">${students.map(studentRow).join('')||empty('No students found','Try another name or subject.')}</div>`):''}${panel('Assignments',`${tasks.length} found`,assignmentTable(tasks))}</div>`;
}
function setupPage() {
  const cloud=store.mode==='firebase';
  return heading('A home for your teaching.','Your workspace, your data, your way.')+`<div class="settings-grid"><section class="panel settings-copy"><h2>${cloud?'Firebase is connected':'Make it your own'}</h2><p>${cloud?'Your workspace uses Firebase Authentication, Firestore, and Cloud Storage. Changes sync across signed-in devices.':'This sample workspace runs in your browser. Connect your own Firebase project to sign in securely and sync across devices.'}</p><div class="callout">${icon(cloud?'lock':'book')} ${cloud?'Your account role is assigned through your Firebase tutor record. Student accounts cannot promote themselves.':'Demo mode is for testing with sample data. Anyone using this browser can switch views. Use Firebase mode for real student records.'}</div><ol><li>Create a Firebase project and a Web app.</li><li>Enable Email/Password Authentication, Firestore, and Storage.</li><li>Add your web configuration to <code>firebase-config.js</code>.</li><li>Deploy <code>firestore.rules</code> and <code>storage.rules</code>.</li><li>Create your tutor account and its tutor record as explained in <code>README.md</code>.</li><li>Set <code>firebaseEnabled: true</code>, then publish with GitHub Pages or Firebase Hosting.</li></ol><p>The included README has exact setup, email verification, storage CORS, and student enrollment steps.</p><a class="btn" href="./README.md" target="_blank" rel="noopener">Read setup guide ${icon('arrow')}</a></section><div class="stack"><section class="panel settings-copy"><h2>Workspace details</h2><div class="student-row"><div class="student-info"><strong>Data connection</strong><p>${cloud?'Firebase · live sync':'Local browser · sample data'}</p></div><span class="chip ${cloud?'green':'orange'}">${cloud?'Connected':'Demo'}</span></div><div class="student-row"><div class="student-info"><strong>Signed in as</strong><p class="break">${esc(user.email)}</p></div><span class="chip">${tutor()?'Tutor':'Student'}</span></div><div class="student-row"><div class="student-info"><strong>File uploads</strong><p>PDF, images, TXT, DOCX · up to 10 MB</p></div></div>${cloud?'<p class="small spaced">Sign out when using a shared computer. Your session ends when this browser session closes.</p>':'<p class="small spaced">Demo files use browser storage, which has a smaller total capacity. Use small files for testing.</p>'}</section>${!cloud&&tutor()?`<section class="panel settings-copy"><h2>A fresh start</h2><p>Restore the original sample students, sessions, and assignments in this browser.</p><button class="btn" data-action="reset-demo">Reset sample workspace</button></section>`:''}</div></div>`;
}

function showModal(title,body) {modal.innerHTML=`<div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body">${body}</div>`;modal.showModal();}
function formFooter(label) {return `<p class="form-error" role="alert"></p><div class="modal-footer"><button class="btn" type="button" data-action="close">Cancel</button><button class="btn primary" type="submit">${label}</button></div>`;}
function field(label,name,type='text',value='',extra='') {return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
function selectStudents(name='studentId',selected='') {return `<label class="field">Student<select name="${name}" required><option value="">Choose a student</option>${data.students.map(s=>`<option value="${esc(s.id)}" ${selected===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`;}
function studentForm(id='') {
  const s=studentById(id);
  showModal(s?'A little update.':'Meet your next learner.',`<form data-form="student" data-id="${esc(id)}">${field('Full name','name','text',s?.name,'required maxlength="100" autocomplete="name"')}${field('Student sign-in email','email','email',s?.email,`required maxlength="254" autocomplete="email" ${s?'readonly':''}`)}<p class="muted small" style="margin-top:-8px;margin-bottom:17px">Use the email this student will verify when creating their account.${s?' Email is locked to keep existing assignments linked correctly.':''}</p><div class="form-grid">${field('Year / level','level','text',s?.level||'','required maxlength="80" placeholder="e.g. Year 10"')}${field('Subjects (separate with commas)','subjects','text',s?.subjects.join(', ')||'','required maxlength="200" placeholder="Physics, Mathematics"')}</div>${!s?field('First learning goal (optional)','goal','text','','maxlength="200" placeholder="e.g. Feel confident with algebra"'):''}${formFooter(s?'Save profile':'Add student')}</form>`);
}
function assignmentForm(studentId='') {
  if(!data.students.length){toast('Add a student first, then give them their next step.');studentForm();return;}
  showModal('Create a little next step.',`<form data-form="assignment">${field('Assignment title','title','text','','required maxlength="160" placeholder="e.g. Forces in the real world"')}<div class="form-grid">${field('Subject','subject','text','','required maxlength="80" placeholder="Physics"')}${field('Due date','dueDate','date',offsetDate(3),'required')}</div><div class="field">Assign to one or more students<div class="checklist">${data.students.map(s=>`<label><input type="checkbox" name="students" value="${esc(s.id)}" ${studentId===s.id?'checked':''}> ${esc(s.name)}</label>`).join('')}</div></div><label class="field">What should they do?<textarea name="instructions" required maxlength="10000" placeholder="Keep the instructions clear and encouraging."></textarea></label><label class="field">Task type<select name="kind"><option value="response">Submit a written response or file</option><option value="simple">Simple check-off task (tutor reviews completion)</option></select></label>${field('Resource link (optional)','link','url','','maxlength="2000" placeholder="https://…"')}${field('Attachment (optional)','file','file','','accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx"')}<p class="muted small">PDF, JPG, PNG, WebP, TXT, or DOCX · up to 10 MB. Learning goals can be linked during your review.</p>${formFooter('Assign task')}</form>`);
}
function goalForm(id) {showModal('Something to work toward.',`<form data-form="goal" data-id="${esc(id)}">${field('Learning goal','title','text','','required maxlength="200" placeholder="e.g. Explain Newton’s laws with confidence"')}${field('Starting progress (%)','progress','number','0','required min="0" max="100" step="1"')}${formFooter('Add learning goal')}</form>`);}
function noteForm(id) {showModal('Capture a little progress.',`<form data-form="note" data-id="${esc(id)}"><p>These notes are private to your tutor account.</p><div class="spaced">${field('Session date','date','date',today(),'required')}</div><label class="field">Your notes<textarea name="text" required maxlength="10000" placeholder="What clicked? What comes next?"></textarea></label>${formFooter('Save note')}</form>`);}
function assessmentForm(id) {showModal('A checkpoint in their journey.',`<form data-form="assessment" data-id="${esc(id)}">${field('Assessment title','title','text','','required maxlength="160" placeholder="e.g. Forces practice checkpoint"')}<div class="form-grid">${field('Date','date','date',today(),'required')}${field('Result (%)','score','number','','required min="0" max="100" step="any"')}</div><p>Results appear in assessment history. Update learning goals when reviewing an assignment.</p>${formFooter('Record result')}</form>`);}
function sessionForm() {
  if(!data.students.length){toast('Add a student before scheduling a session.');studentForm();return;}
  showModal('Make time for learning.',`<form data-form="session">${selectStudents()}${field('Subject','subject','text','','required maxlength="80"')}<div class="form-grid">${field('Date','date','date',today(),'required')}${field('Start time (your local time)','time','time','16:00','required')}</div>${field('Duration (minutes)','duration','number','60','required min="10" max="240" step="5"')}${field('Session focus','topic','text','','required maxlength="200" placeholder="What will you explore together?"')}${formFooter('Schedule session')}</form>`);
}
function fileButtons(files,id,prefix) {return files?.map((file,index)=>`<button class="file-link" type="button" data-download="${esc(id)}" data-prefix="${prefix}" data-index="${index}">${icon('file')}${esc(file.name)}</button>`).join('')||'';}
function openTask(id) {
  const a=data.assignments.find(a=>a.id===id);if(!a)return;
  const s=studentById(a.studentId), link=safeURL(a.link);
  let body=`<div class="inline-actions">${chip(a.subject)}${status(a)}<span class="chip gray">Due ${dueText(a.dueDate)}</span></div>${tutor()?`<p class="small spaced">For ${esc(personName(a.studentId))}</p>`:''}<h3>Your next step</h3><div class="instructions">${esc(a.instructions)}</div>${link?`<a class="file-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${icon('link')} Open resource</a>`:''}${fileButtons(a.attachments,id,'attachments')}`;
  if(tutor()&&a.status==='assigned')body+=`<form data-form="attachment" data-id="${esc(id)}" class="spaced">${field('Add a resource file','file','file','','required accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx"')}<p class="form-error" role="alert"></p><button class="btn" type="submit">Attach file</button></form>`;
  if(a.status!=='assigned')body+=`<h3>${tutor()?'Their submission':'Your submission'}</h3><div class="submission">${esc(a.response || (a.kind==='simple'?'Marked done — ready for tutor review.':'File submission'))}</div>${fileButtons(a.submissionFiles,id,'submissionFiles')}${a.submittedAt?`<p class="small spaced">Submitted ${esc(new Date(a.submittedAt).toLocaleString())}</p>`:''}`;
  if(a.status==='completed')body+=`<h3>A little feedback</h3><div class="callout">${esc(a.feedback)}</div>${a.score!==null?`<p>Assessment result: <b>${a.score}%</b></p>`:''}`;
  if(!tutor()&&a.status==='assigned')body+=`<form data-form="submit" data-id="${esc(id)}"><h3>${a.kind==='simple'?'Ready to check this off?':'Show what you’ve learned'}</h3>${a.kind==='simple'?'<p>When you’re done, send this to your tutor for a quick review.</p>':`<label class="field">Your response<textarea name="response" maxlength="20000" placeholder="Have a go. It doesn’t need to be perfect."></textarea></label>${field('Or attach your work','file','file','','accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx"')}`}<p class="form-error" role="alert"></p><div class="modal-footer"><button class="btn primary" type="submit">${icon('check')} ${a.kind==='simple'?'Mark done & send to tutor':'Submit my work'}</button></div></form>`;
  if(tutor()&&a.status==='submitted') {
    const goal=s?.goals.find(g=>g.id===a.goalId);
    body+=`<form data-form="review" data-id="${esc(id)}"><h3>Your feedback makes a difference</h3><label class="field">Encouraging feedback<textarea name="feedback" required maxlength="10000" placeholder="What went well? What could they try next?"></textarea></label><div class="form-grid">${field('Score % (optional)','score','number','','min="0" max="100" step="any"')}<label class="field">Update a learning goal<select name="goalId"><option value="">No goal update</option>${s?.goals.map(g=>`<option value="${esc(g.id)}" ${goal?.id===g.id?'selected':''}>${esc(g.title)}</option>`).join('')}</select></label></div><label class="field" id="goal-progress-field" ${goal?'':'hidden'}>New goal progress (%)<input name="progress" type="number" min="0" max="100" step="1" value="${goal?.progress||0}"><span class="hint">Set your assessment of their current progress. This updates their progress view when you complete the review.</span></label>${formFooter('Complete review & update progress')}</form>`;
  }
  showModal(esc(a.title),body);
}
function renderAuth() {
  if(store?.mode==='demo'&&!user) {
    $('#app').innerHTML=`<div class="login-shell"><div class="login-brand"><div class="brand"><span class="brand-mark">c.</span><span class="brand-name">${esc(settings.businessName)}</span></div><h1>Small steps.<br>Meaningful growth.</h1><p>A calm space for your teaching and their learning.</p></div><main id="main" class="login-form"><div class="login-card"><h2>Your teaching, all together.</h2><p>Explore the complete workflow with sample students, assignments, and progress.</p>${button('Open sample workspace','enter-demo','primary wide')}<div class="callout">For secure accounts and syncing, connect Firebase using the included README and configuration file.</div><a href="./README.md" target="_blank" rel="noopener">Read setup guide</a></div></main></div>`;return;
  }
  let content;
  if(user?.unverified)content=`<h2>Check your inbox.</h2><p>Verify ${esc(user.email)} before opening student records. Follow the link in the verification email, then continue here.</p><form data-form="verify"><p class="form-error" role="alert"></p><p class="form-message"></p><button class="btn primary wide" type="submit">I’ve verified my email</button></form><button class="text-btn" data-action="resend">Resend verification email</button><br><button class="text-btn" data-action="logout">Sign out</button>`;
  else content=`<h2>${authMode==='register'?'A new chapter starts here.':authMode==='reset'?'Let’s get you back in.':'Welcome back.'}</h2><p>${authMode==='register'?'Create your student account with the email your tutor has on file.':authMode==='reset'?'Enter your email to request a password reset link.':'A little clarity. A little confidence. Sign in to your workspace.'}</p><form data-form="auth">${field('Email address','email','email','','required autocomplete="email"')}${authMode!=='reset'?field('Password','password','password','',`required minlength="${authMode==='register'?10:1}" autocomplete="${authMode==='register'?'new-password':'current-password'}"`):''}${authMode==='register'?'<p class="small muted">Use at least 10 characters. You’ll need to verify your email to access your records.</p>':''}<p class="form-error" role="alert"></p><p class="form-message"></p><button class="btn primary wide" type="submit">${authMode==='register'?'Create account':authMode==='reset'?'Send reset link':'Sign in'}</button></form>${authMode!=='reset'?`<div class="auth-divider"><span>or</span></div><button class="btn wide google-btn" type="button" data-action="google"><svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Continue with Google</button>`:''}<button class="text-btn" data-auth-mode="${authMode==='login'?'register':'login'}">${authMode==='login'?'New here? Create a student account':'Already have an account? Sign in'}</button>${authMode==='login'?'<br><button class="text-btn" data-auth-mode="reset">Forgot your password?</button>':''}`;
  $('#app').innerHTML=`<div class="login-shell"><div class="login-brand"><div class="brand"><span class="brand-mark">c.</span><span class="brand-name">${esc(settings.businessName)}</span></div><h1>Small steps.<br>Meaningful growth.</h1><p>A calm space for your teaching and their learning.</p></div><main id="main" class="login-form"><div class="login-card">${loadError?`<div class="callout error-box" role="alert">${esc(loadError)}</div>`:''}${content}</div></main></div>`;
}

function beginSession(nextUser) {
  unsubscribe?.();unsubscribe=null;modal.close();user=nextUser;loaded=false;loadError='';data={students:[],assignments:[],sessions:[],notes:[],assessments:[]};route='dashboard';query='';selectedStudent='';filter='all';render();
  if(user&&!user.unverified)subscribe();
}
function subscribe() {
  unsubscribe?.();loadError='';loaded=false;
  unsubscribe=store.subscribe(user,next=>{data=next;loaded=true;loadError='';if(store.mode==='demo'&&tutor())demoRoster=next.students;render();},error=>{loadError=errorText(error);loaded=true;render();});
}
const demoTutor=()=>({uid:'demo-tutor',name:'Inderbir Singh',role:'tutor',email:'tutor@example.com'});
document.addEventListener('click',async event=>{
  const target=event.target.closest('button, [data-nav]');if(!target)return;
  if(target.dataset.nav){navigate(target.dataset.nav);return;}
  if(target.dataset.profile){navigate('profile',target.dataset.profile);return;}
  if(target.dataset.filter){filter=target.dataset.filter;render();return;}
  if(target.dataset.task){openTask(target.dataset.task);return;}
  if(target.dataset.editStudent){studentForm(target.dataset.editStudent);return;}
  if(target.dataset.goal){goalForm(target.dataset.goal);return;}
  if(target.dataset.note){noteForm(target.dataset.note);return;}
  if(target.dataset.assessment){assessmentForm(target.dataset.assessment);return;}
  if(target.dataset.authMode){authMode=target.dataset.authMode;loadError='';renderAuth();return;}
  if(target.dataset.download){
    target.disabled=true;
    try {const a=data.assignments.find(a=>a.id===target.dataset.download),file=a[target.dataset.prefix][Number(target.dataset.index)];const blob=await store.download(file);const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(error){toast(errorText(error));}finally{target.disabled=false;}return;
  }
  const action=target.dataset.action;
  if(action==='close'){modal.close();return;}
  if(action==='menu'){$('.shell')?.classList.toggle('menu-open');return;}
  if(action==='assignment'){assignmentForm(target.dataset.student);return;}
  if(action==='student'){studentForm();return;}
  if(action==='session'){sessionForm();return;}
  if(action==='setup'){navigate('setup');return;}
  if(action==='enter-demo'){beginSession(demoTutor());return;}
  if(action==='retry'){subscribe();render();return;}
  if(action==='reset-demo'){showModal('Start fresh with the sample workspace?',`<p>This replaces demo edits and uploaded demo files in this browser with the original sample data.</p><form data-form="reset-demo">${formFooter('Restore sample data')}</form>`);return;}
  if(action==='logout'){try {if(store.mode==='demo')beginSession(null);else await store.logout();}catch(error){toast(errorText(error));}return;}
  if(action==='google'){target.disabled=true;try{await store.loginWithGoogle();}catch(error){if(!['auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(error?.code))toast(errorText(error));}finally{target.disabled=false;}}
  if(action==='resend'){target.disabled=true;try{await store.resendVerification();toast('Verification email sent. Check your inbox.');}catch(error){toast(errorText(error));}finally{target.disabled=false;}}
});
document.addEventListener('change',event=>{
  if(event.target.id==='demo-role') {
    if(event.target.value==='tutor')beginSession(demoTutor());
    else {const s=demoRoster.find(s=>s.id===event.target.value);if(s)beginSession({uid:s.id,studentId:s.id,email:s.email,name:s.name,role:'student'});}
  }
  if(event.target.name==='goalId') {
    const form=event.target.form,a=data.assignments.find(a=>a.id===form.dataset.id),s=studentById(a.studentId),goal=s.goals.find(g=>g.id===event.target.value);
    $('#goal-progress-field').hidden=!goal;form.elements.progress.value=goal?.progress||0;
  }
});
document.addEventListener('input',event=>{
  if(event.target.id==='global-search') {
    query=event.target.value;
    // Keep the focused search field intact while refreshing only the page content.
    $('#main').innerHTML=demoBanner()+pageContent();
  }
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.dataset.form)return;event.preventDefault();
  const kind=form.dataset.form,values=new FormData(form),v=name=>String(values.get(name)||'').trim(), id=form.dataset.id;
  const error=form.querySelector('.form-error'),buttons=[...form.querySelectorAll('button')];
  if(error)error.textContent='';buttons.forEach(b=>b.disabled=true);
  try {
    if(kind==='auth') {
      const password=String(values.get('password')||'');
      if(authMode==='register')await store.register(v('email'),password);
      else if(authMode==='reset'){await store.resetPassword(v('email'));form.querySelector('.form-message').textContent='If this account exists, a reset link will arrive in its inbox.';}
      else await store.login(v('email'),password);
      return;
    }
    if(kind==='verify') {await store.refreshVerification();if(user?.unverified)throw new Error('Your email is not verified yet. Open the email link, then try again.');return;}
    if(kind==='student') {
      const value={name:v('name'),email:v('email').toLowerCase(),level:v('level'),subjects:v('subjects').split(',').map(s=>s.trim()).filter(Boolean)};
      if(!value.name||!value.level||!value.subjects.length)throw new Error('Please add a name, level, and at least one subject.');
      if(!id&&data.students.some(s=>s.email===value.email))throw new Error('A student with this email already has a profile.');
      if(id)await store.updateStudent(id,{name:value.name,level:value.level,subjects:value.subjects});
      else await store.add('students',{...value,tutorId:user.uid,color:['lilac','peach','blue','pink','green'][data.students.length%5],goals:v('goal')?[{id:uid(),title:v('goal'),progress:0}]:[],createdAt:new Date().toISOString()});
      modal.close();toast(id?'Profile updated.':'A new learning journey starts here.');return;
    }
    if(kind==='assignment') {
      const students=values.getAll('students');if(!students.length)throw new Error('Choose at least one student.');if(students.length>8)throw new Error('Assign to up to 8 students at a time. This keeps each Firebase batch within its security-rule lookup limit.');
      const file=values.get('file');if(file?.size)validateFile(file);
      if(v('link')&&!safeURL(v('link')))throw new Error('Use a complete http or https resource link.');
      const tasks=students.map(studentId=>{const s=studentById(studentId);return {tutorId:user.uid,studentId,studentEmail:s.email,title:v('title'),subject:v('subject'),dueDate:v('dueDate'),kind:v('kind'),instructions:v('instructions'),link:v('link'),goalId:'',status:'assigned',attachments:[],submissionFiles:[],response:'',feedback:'',score:null,submittedAt:null,reviewedAt:null,createdAt:new Date().toISOString()};});
      const ids=await store.createAssignments(tasks);modal.close();
      if(file?.size) {let failed=0;for(const taskId of ids){try{await store.attach(taskId,file);}catch{failed++;}}if(failed){toast(`Tasks assigned. ${failed} file upload(s) failed — open each assignment to attach the file again.`);return;}}
      toast(`A next step assigned to ${ids.length} ${ids.length===1?'student':'students'}.`);return;
    }
    if(kind==='attachment') {const file=values.get('file');await store.attach(id,file);modal.close();toast('Resource attached.');return;}
    if(kind==='submit') {const response=v('response'),file=values.get('file');await store.submit(id,response,file);modal.close();toast('Nicely done! Your tutor will review your work.');return;}
    if(kind==='review') {await store.review(id,{feedback:v('feedback'),score:v('score'),goalId:v('goalId'),progress:v('progress')});modal.close();toast('Feedback shared. Progress updated. A lovely step forward.');return;}
    if(kind==='goal') {const s=studentById(id);await store.updateStudent(id,{goals:[...s.goals,{id:uid(),title:v('title'),progress:Number(v('progress'))}]});modal.close();toast('A new goal to grow toward.');return;}
    if(kind==='note') {await store.add('notes',{tutorId:user.uid,studentId:id,date:v('date'),text:v('text')});modal.close();toast('A little progress, captured.');return;}
    if(kind==='assessment') {const s=studentById(id);await store.add('assessments',{tutorId:user.uid,studentId:id,studentEmail:s.email,title:v('title'),date:v('date'),score:Number(v('score')),assignmentId:''});modal.close();toast('Assessment recorded.');return;}
    if(kind==='session') {await store.add('sessions',{tutorId:user.uid,studentId:v('studentId'),subject:v('subject'),topic:v('topic'),date:v('date'),time:v('time'),duration:Number(v('duration'))});modal.close();toast('A little time set aside for learning.');return;}
    if(kind==='reset-demo') {await store.reset();modal.close();toast('Your sample workspace is ready for a fresh start.');return;}
  } catch(err) {if(error)error.textContent=errorText(err);else toast(errorText(err));}
  finally {buttons.forEach(b=>b.disabled=false);}
});

async function init() {
  if(!settings.firebaseEnabled) {store=createDemoStore();beginSession(demoTutor());return;}
  try {
    const {createFirebaseStore}=await import('./firebase.js');
    let ready=false,pending;
    store=await createFirebaseStore(settings.firebaseConfig,next=>{if(ready)beginSession(next);else pending={user:next};},error=>{loadError=errorText(error);loaded=true;if(ready)render();});
    ready=true;if(pending)beginSession(pending.user);else renderAuth();
  } catch(error) {
    loadError=`Firebase could not start: ${errorText(error)} Check firebase-config.js and your internet connection, then reload.`;
    $('#app').innerHTML=`<main id="main" class="login-form" style="min-height:100vh"><section class="login-card"><span class="brand-mark">c.</span><h2 class="spaced">Connection needs a little attention.</h2><div class="callout error-box" role="alert">${esc(loadError)}</div><a class="btn" href="./README.md">Read setup guide</a></section></main>`;
  }
}
init();
