import { reviewChanges, uid, validateFile, today } from './domain.js';
const BASE = 'https://www.gstatic.com/firebasejs/13.1.0';
export async function createFirebaseStore(config, onAuth, onError) {
  if (!config.projectId || config.projectId.includes('YOUR_')) throw new Error('Complete firebase-config.js before enabling Firebase.');
  const [core, authSDK, dbSDK, storageSDK] = await Promise.all([
    import(`${BASE}/firebase-app.js`), import(`${BASE}/firebase-auth.js`),
    import(`${BASE}/firebase-firestore.js`), import(`${BASE}/firebase-storage.js`)
  ]);
  const app=core.initializeApp(config), auth=authSDK.getAuth(app), db=dbSDK.getFirestore(app), storage=storageSDK.getStorage(app);
  let activeUser=null, cleanups=[], authGeneration=0;
  function stop() { cleanups.forEach(fn=>fn());cleanups=[]; }
  async function identify(user) {
    const generation=++authGeneration;
    stop();activeUser=null;
    if(!user) {onAuth(null);return;}
    if(!user.emailVerified) {onAuth({uid:user.uid,email:user.email,unverified:true});return;}
    try {
      const doc=await dbSDK.getDoc(dbSDK.doc(db,'tutors',user.uid));
      if(generation!==authGeneration)return;
      activeUser={uid:user.uid,email:user.email.toLowerCase(),name:doc.exists()?doc.data().name:'Student',role:doc.exists()&&doc.data().active===true?'tutor':'student'};
      onAuth(activeUser);
    } catch(error) {if(generation===authGeneration)onError(error);}
  }
  await authSDK.setPersistence(auth,authSDK.browserSessionPersistence);
  authSDK.onAuthStateChanged(auth,identify,onError);
  function assignmentDoc(id) {return dbSDK.doc(db,'assignments',id);}
  async function upload(id,file,folder) {
    validateFile(file);
    const snap=await dbSDK.getDoc(assignmentDoc(id));
    if(!snap.exists())throw new Error('Assignment not found.');
    const name=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
    const path=`work/${snap.data().tutorId}/${id}/${folder}/${uid()}-${name}`;
    await storageSDK.uploadBytes(storageSDK.ref(storage,path),file,{contentType:file.type});
    return {name:file.name,path};
  }
  return {
    mode:'firebase',
    async login(email,password) {await authSDK.signInWithEmailAndPassword(auth,email,password);},
    async loginWithGoogle() {const provider=new authSDK.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await authSDK.signInWithPopup(auth,provider);},
    async register(email,password) {const credential=await authSDK.createUserWithEmailAndPassword(auth,email,password);await authSDK.sendEmailVerification(credential.user);},
    async logout() {stop();activeUser=null;await authSDK.signOut(auth);},
    async resetPassword(email) {await authSDK.sendPasswordResetEmail(auth,email);},
    async resendVerification() {await authSDK.sendEmailVerification(auth.currentUser);},
    async refreshVerification() {await authSDK.reload(auth.currentUser);await auth.currentUser.getIdToken(true);await identify(auth.currentUser);},
    subscribe(user,callback,error) {
      stop();const view={students:[],assignments:[],sessions:[],notes:[],assessments:[]};
      const collections=user.role==='tutor'?Object.keys(view):['students','assignments','assessments'];
      const loaded=new Set();
      for(const name of collections) {
        const filter=user.role==='tutor'?['tutorId','==',user.uid]:[name==='students'?'email':'studentEmail','==',user.email];
        const query=dbSDK.query(dbSDK.collection(db,name),dbSDK.where(...filter));
        cleanups.push(dbSDK.onSnapshot(query,snapshot=>{
          view[name]=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));loaded.add(name);
          if(loaded.size===collections.length)callback(structuredClone(view));
        },error));
      }
      return stop;
    },
    async add(collection,value) {const ref=await dbSDK.addDoc(dbSDK.collection(db,collection),value);return ref.id;},
    async updateStudent(id,value) {await dbSDK.updateDoc(dbSDK.doc(db,'students',id),value);},
    async createAssignments(values) {
      if(values.length>8)throw new Error('Assign to up to 8 students at a time.');
      const batch=dbSDK.writeBatch(db),ids=[];
      values.forEach(value=>{const ref=dbSDK.doc(dbSDK.collection(db,'assignments'));ids.push(ref.id);batch.set(ref,value);});
      await batch.commit();return ids;
    },
    async submit(id,response,file) {
      const files=file?.size?[await upload(id,file,'submissions')]:[];
      await dbSDK.runTransaction(db,async transaction=>{
        const snap=await transaction.get(assignmentDoc(id));
        if(!snap.exists()||snap.data().status!=='assigned')throw new Error('This task has changed. Refresh and try again.');
        if(snap.data().kind!=='simple'&&!response.trim()&&!files.length)throw new Error('Write a response or attach your work.');
        transaction.update(assignmentDoc(id),{response,submissionFiles:files,status:'submitted',submittedAt:new Date().toISOString()});
      });
    },
    async attach(id,file) {const attachment=await upload(id,file,'resources');await dbSDK.updateDoc(assignmentDoc(id),{attachments:dbSDK.arrayUnion(attachment)});},
    async review(id,input) {
      const assessmentRef=dbSDK.doc(dbSDK.collection(db,'assessments'));
      await dbSDK.runTransaction(db,async transaction=>{
        const snap=await transaction.get(assignmentDoc(id));
        if(!snap.exists())throw new Error('Assignment not found.');
        const task={...snap.data(),id:snap.id}, studentRef=dbSDK.doc(db,'students',task.studentId);
        const studentSnap=await transaction.get(studentRef);
        const student={...studentSnap.data(),id:studentSnap.id}, change=reviewChanges(task,student,input);
        const {id:unused,...value}=change.task;
        transaction.set(assignmentDoc(id),value);
        if(input.goalId)transaction.update(studentRef,{goals:change.goals});
        if(value.score!==null)transaction.set(assessmentRef,{tutorId:activeUser.uid,studentId:student.id,studentEmail:student.email,title:task.title,date:today(),score:value.score,assignmentId:id});
      });
    },
    async download(file) {return storageSDK.getBlob(storageSDK.ref(storage,file.path),10*1024*1024);}
  };
}
