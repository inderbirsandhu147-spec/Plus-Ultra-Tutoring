import { createSeed, reviewChanges, uid, validateFile, today } from './domain.js';
const KEY = 'cayden-demo-v1';
export function createDemoStore() {
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch { /* Show a fresh demo for invalid browser data. */ }
  if (!data?.students || !data?.assignments) data = createSeed();
  let listener, session;
  function emit() {
    if (!listener || !session) return;
    const visible = session.role === 'tutor' ? data : {
      students:data.students.filter(s=>s.id===session.studentId),
      assignments:data.assignments.filter(a=>a.studentId===session.studentId),
      assessments:data.assessments.filter(a=>a.studentId===session.studentId), notes:[], sessions:[]
    };
    listener(structuredClone(visible));
  }
  function save(next) {
    // Persist before reporting success; quota/privacy-mode errors must be visible.
    localStorage.setItem(KEY, JSON.stringify(next)); data = next; emit();
  }
  function tutor() { if (session?.role !== 'tutor') throw new Error('Tutor access required.'); }
  return {
    mode:'demo',
    subscribe(user, callback) { session=user; listener=callback; emit(); return ()=>{listener=null;}; },
    async add(collection, value) { tutor(); const id=uid(); const next=structuredClone(data); next[collection].push({...value,id}); save(next); return id; },
    async updateStudent(id, value) { tutor(); const next=structuredClone(data); Object.assign(next.students.find(s=>s.id===id),value); save(next); },
    async createAssignments(values) { tutor(); const next=structuredClone(data); const ids=values.map(v=>{const id=uid();next.assignments.push({...v,id});return id;});save(next);return ids; },
    async submit(id, response, file) {
      const next=structuredClone(data), task=next.assignments.find(a=>a.id===id);
      if (session.role!=='student' || task?.studentId!==session.studentId || task.status!=='assigned') throw new Error('This task cannot be submitted.');
      let files=[];
      if(file?.size) { validateFile(file); const contents=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read the file.'));reader.readAsDataURL(file);});files=[{name:file.name,data:contents}]; }
      if(task.kind!=='simple'&&!response.trim()&&!files.length) throw new Error('Write a response or attach your work.');
      Object.assign(task,{response,submissionFiles:files,status:'submitted',submittedAt:new Date().toISOString()});save(next);
    },
    async attach(id, file) { tutor();validateFile(file);const contents=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not read file.'));r.readAsDataURL(file);});const next=structuredClone(data);next.assignments.find(a=>a.id===id).attachments.push({name:file.name,data:contents});save(next); },
    async review(id,input) {
      tutor();const next=structuredClone(data), index=next.assignments.findIndex(a=>a.id===id), student=next.students.find(s=>s.id===next.assignments[index].studentId);
      const change=reviewChanges(next.assignments[index],student,input);next.assignments[index]=change.task;student.goals=change.goals;
      if(change.task.score!==null) next.assessments.push({id:uid(),tutorId:session.uid,studentId:student.id,studentEmail:student.email,title:change.task.title,date:today(),score:change.task.score,assignmentId:id});
      save(next);
    },
    async download(file) { const res=await fetch(file.data);return res.blob(); },
    async reset() { tutor();save(createSeed()); }
  };
}
