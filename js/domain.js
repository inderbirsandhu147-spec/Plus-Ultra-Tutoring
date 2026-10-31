export const uid = () => crypto.randomUUID();
export const today = () => localDate(new Date());
export function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function offsetDate(days) {
  const date = new Date(); date.setDate(date.getDate() + days); return localDate(date);
}
export function taskGroup(task, date = today()) {
  if (task.status === 'completed') return 'completed';
  if (task.status === 'submitted') return 'submitted';
  return task.dueDate < date ? 'overdue' : 'upcoming';
}
export function goalAverage(student) {
  const goals = student.goals || [];
  return goals.length ? Math.round(goals.reduce((n, g) => n + Number(g.progress), 0) / goals.length) : 0;
}
export function needsSupport(student, assignments) {
  return assignments.some(a => a.studentId === student.id && taskGroup(a) === 'overdue') || (student.goals.length > 0 && goalAverage(student) < 40);
}
export function safeURL(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}
export function validateFile(file) {
  if (!file || !file.size) throw new Error('Choose a non-empty file.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Please choose a file smaller than 10 MB.');
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type)) throw new Error('Use a PDF, JPG, PNG, WebP, TXT, or DOCX file.');
}
export function reviewChanges(task, student, input) {
  if (task.status !== 'submitted') throw new Error('This submission has already changed. Refresh and try again.');
  const score = input.score === '' ? null : Number(input.score);
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) throw new Error('Score must be between 0 and 100.');
  if (!input.feedback.trim()) throw new Error('Add a little feedback before completing the review.');
  const goals = structuredClone(student.goals);
  if (input.goalId) {
    const goal = goals.find(g => g.id === input.goalId);
    const progress = Number(input.progress);
    if (!goal || !Number.isFinite(progress) || progress < 0 || progress > 100) throw new Error('Choose a valid goal and progress from 0 to 100.');
    goal.progress = progress;
  }
  return { task: { ...task, status: 'completed', feedback: input.feedback.trim(), score, reviewedAt: new Date().toISOString() }, goals };
}
export function createSeed() {
  const tutorId = 'demo-tutor';
  const students = [
    { id: 'cayden', name: 'Cayden Tan', email: 'cayden@example.com', level: 'Year 10', subjects: ['Physics', 'Mathematics'], color: 'lilac', goals: [{id:'forces', title:'Understand forces & motion', progress:68}, {id:'algebra', title:'Build confidence with algebra', progress:78}] },
    { id: 'amelia', name: 'Amelia Lim', email: 'amelia@example.com', level: 'Year 8', subjects: ['Mathematics'], color: 'peach', goals: [{id:'fractions', title:'Master fractions and percentages', progress:85}] },
    { id: 'ryan', name: 'Ryan Lee', email: 'ryan@example.com', level: 'Year 9', subjects: ['Physics'], color: 'blue', goals: [{id:'energy', title:'Explain energy transfers', progress:32}] },
    { id: 'sophia', name: 'Sophia Wong', email: 'sophia@example.com', level: 'Year 7', subjects: ['English'], color: 'pink', goals: [{id:'writing', title:'Write a well-structured paragraph', progress:62}] },
    { id: 'adam', name: 'Adam Rahman', email: 'adam@example.com', level: 'Year 10', subjects: ['Mathematics'], color: 'green', goals: [{id:'graphs', title:'Interpret quadratic graphs', progress:90}] }
  ].map(s => ({...s, tutorId, createdAt:new Date().toISOString()}));
  const specs = [
    ['cayden','Forces in the real world','Physics',1,'assigned','response','Think of three everyday examples of balanced and unbalanced forces. Explain what happens to the motion in each example.','forces'],
    ['amelia','A little fraction practice','Mathematics',2,'submitted','response','Solve 3/4 + 2/3 and 5/6 − 1/4. Show your working.','fractions'],
    ['ryan','Energy transfers around us','Physics',-2,'assigned','response','Draw an energy transfer diagram for a lamp and a moving bicycle. Label useful and wasted energy.','energy'],
    ['sophia','Your next great paragraph','English',3,'assigned','response','Write a paragraph about a place that makes you happy. Include a topic sentence and three supporting details.','writing'],
    ['cayden','Revisit your algebra notes','Mathematics',0,'assigned','simple','Spend ten minutes reviewing the algebra notes from our last session. Mark this done when you feel ready.','algebra'],
    ['adam','Quadratic graphs: checkpoint','Mathematics',-1,'completed','response','Find the turning point of y = x² − 4x + 3.','graphs'],
    ['cayden','Motion graphs: first steps','Physics',-5,'completed','response','Describe the motion shown by a horizontal line on a speed-time graph.','forces'],
    ['sophia','Describe a character','English',0,'submitted','response','Describe a fictional character in five sentences.','writing']
  ];
  const assignments = specs.map((s,i) => ({id:`task-${i}`, tutorId, studentId:s[0], studentEmail:students.find(x=>x.id===s[0]).email, title:s[1], subject:s[2], dueDate:offsetDate(s[3]), status:s[4], kind:s[5], instructions:s[6], goalId:s[7], link:'', attachments:[], submissionFiles:[], response:s[4]==='submitted'?'I used a common denominator to solve the questions. My answers are 17/12 and 7/12.':s[4]==='completed'?'Here is my worked answer from our last session.':'', feedback:s[4]==='completed'?'Lovely work. Your explanation is clear and your confidence is growing. Keep it up!':'', score:s[4]==='completed'?85:null, createdAt:new Date().toISOString(), submittedAt:s[4]!=='assigned'?new Date().toISOString():null, reviewedAt:s[4]==='completed'?new Date().toISOString():null}));
  return { students, assignments,
    sessions: [{id:'session-1',studentId:'cayden',subject:'Physics',date:offsetDate(0),time:'16:00',duration:60,topic:'Newton’s laws & everyday forces'}, {id:'session-2',studentId:'amelia',subject:'Mathematics',date:offsetDate(0),time:'17:30',duration:45,topic:'Fractions, one step at a time'}, {id:'session-3',studentId:'ryan',subject:'Physics',date:offsetDate(1),time:'15:00',duration:60,topic:'Energy transfers & diagrams'}].map(s=>({...s,tutorId})),
    notes: [{id:'note-1',tutorId,studentId:'cayden',date:offsetDate(-3),text:'Much more confident with free-body diagrams today. Next time: practise resultant force calculations.'}],
    assessments: students.flatMap((s,i)=>[45,55,goalAverage(s)].map((score,j)=>({id:`assess-${i}-${j}`,studentId:s.id,studentEmail:s.email,tutorId,title:['Starting point','Practice checkpoint','Latest checkpoint'][j],date:offsetDate(-21+j*7),score,assignmentId:''})))
  };
}
