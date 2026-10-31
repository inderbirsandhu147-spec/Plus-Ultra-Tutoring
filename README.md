# Cayden — tutoring workspace

A responsive, buildless web app made with HTML, CSS, and vanilla JavaScript. Put the contents of this folder in a GitHub repository; it works on GitHub Pages or Firebase Hosting. No application server or build step is required.

## Try it now

With Node.js 22 or newer installed, open a terminal in this folder and run:

```sh
npm start
```

Open **http://127.0.0.1:4173**. You do **not** need to run `npm install` for the app or its demo tests. Stop the server with Ctrl+C.

Alternatively, serve this folder with any static web server, such as VS Code Live Server. Opening `index.html` by double-clicking is not supported because browser ES modules need HTTP/HTTPS.

The app starts in **sample mode** with five fictional students and sample assignments, notes, assessments, and sessions. Changes are saved in this browser's local storage. Use **Preview as** to switch between the tutor and each student. Restore the original sample data from **Settings → Reset sample workspace**.

**Sample mode is a demonstration, not secure multi-user access. Do not enter real student records until Firebase is configured and its rules are deployed.** Sample data stays separate from Firebase and is never automatically uploaded to your project.

## Test the main workflow

1. As Tutor, open **Students → Add student**. Enter a sample name, email, subjects, and first learning goal.
2. Select **New assignment**. Choose that student (or several students), a title, due date, instructions, and an optional resource link or file.
3. Change **Preview as** to that student. Open **My assignments** and submit a written response or file. Simple check-off tasks use **Mark done & send to tutor**.
4. Switch to Tutor. Open **Assignments → To review**, then open the submission.
5. Add feedback and an optional percentage score. Choose a learning goal and set its new progress percentage. Complete the review.
6. Switch back to the student. The task is now **Completed**, feedback is visible, and **My progress** shows the updated goal and assessment score.

Review completion, its assessment result, and any goal update are saved atomically in Firebase. Repeated reviews are rejected. Simple tasks also require tutor review; students cannot award their own scores or goal progress.

## What is included

- Tutor dashboard: upcoming sessions, work awaiting review, overdue tasks, and students who may need support.
- Student profiles: subjects, level, learning goals, private session notes, assessment history, and progress charts.
- Assignments: one or many students (up to 8 per batch), instructions, due dates, links, file attachments, and lifecycle status. The batch limit keeps Firestore security-rule document lookups within its transaction limit.
- Student workspace: only the student's assignments, goals, assessments, submissions, and feedback.
- Email/password account registration, email verification, password resets, and sign-out in Firebase mode.
- Live Firestore listeners, protected Storage uploads/downloads, and rules for both services.
- Keyboard-accessible navigation and dialogs, responsive layout, and mobile navigation.

Support is flagged when a student has overdue assigned work or average goal progress below 40%. Goals are tutor-assessed percentages, not automatic predictions. Scores are stored as percentages. Goal progress is the average of recorded learning goals.

Session dates and times use the tutor's local wall-clock time; this version does not convert session times across time zones. It does not send invitations, reminders, or notification emails for assignments. The core workflow does not include billing, chat, recurring sessions, student deletion, or editing/deleting historical notes and assessments.

## Connect your Firebase project

### 1. Create the Firebase services

In the [Firebase console](https://console.firebase.google.com/):

1. Create a project and register a **Web app**.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Create the **Cloud Firestore default database** in **production mode**.
4. Enable **Cloud Storage** and create its default bucket. Firebase may require billing to enable/use Storage; check your project's requirements in the console before enabling it.
5. Under **Authentication → Settings → Authorized domains**, add the actual hosting domain, such as `YOUR_USERNAME.github.io` or your custom domain. Add `127.0.0.1`/`localhost` when testing locally if necessary. Authorize domains only; do not include a repository path.

### 2. Add your public Web configuration

Copy the Firebase Web configuration from **Project settings → Your apps** into `firebase-config.js`:

```js
export const settings = {
  firebaseEnabled: true,
  businessName: "Cayden",
  firebaseConfig: {
    apiKey: "YOUR_REAL_WEB_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-exact-bucket-name",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
  }
};
```

Use the bucket name Firebase actually supplies. Some older projects use `PROJECT.appspot.com`.

This public Web configuration belongs in the client. **Never commit a service-account JSON file, Admin SDK credential, or private key.** Authorization is enforced by the supplied rules, not by hiding the Web configuration. Browser SDK modules are loaded directly from Google's CDN only when Firebase is enabled. See [Firebase's Web setup guide](https://firebase.google.com/docs/web/setup).

### 3. Deploy the rules before using real records

You can paste `firestore.rules` into **Firestore → Rules** and `storage.rules` into **Storage → Rules**, then publish each. When enabling Storage rules that read Firestore, accept the Firebase console's service-permission setup for that integration.

Or, with the official [Firebase CLI](https://firebase.google.com/docs/cli) installed, run from this folder:

```sh
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Select **your new tutoring project**. These commands replace rules in the selected project; use a separate project if you already have another app with different rules. This application uses single-field queries, so no custom composite indexes are required.

### 4. Create your tutor account

The first tutor must be provisioned by the project owner. This prevents students from granting themselves tutor privileges.

1. Open the Firebase-enabled app and select **Create a student account**. Register your own tutor email and a strong password. The registration label is student-oriented because all new accounts start with student-level access.
2. Verify your email using the link in your inbox.
3. In **Firebase Authentication → Users**, copy your account's **UID**.
4. In Firestore, create the collection **`tutors`**, with a document whose **document ID is exactly that UID**.
5. Add these fields:

   | Field | Firestore type | Example |
   | --- | --- | --- |
   | `active` | boolean | `true` |
   | `name` | string | `Inderbir Singh` |

6. Sign out and sign in again. The tutor dashboard will now open.

Only an administrator using the Firebase console or trusted Admin SDK can write these tutor records. The web app cannot create them. Tutor data starts empty; the browser demo does not seed real student records.

### 5. Enroll students

1. As tutor, add each student's profile with the email they will sign in with.
2. Send the student your website address yourself. Adding a profile does not send an invitation or create an Authentication account.
3. The student chooses **Create a student account**, registers with the same email, verifies it, and signs in.
4. The rules match the **verified email** to that student's profile, assignments, and assessment results. Unverified accounts cannot access the database or files.

Students cannot read other students' records, private notes, or the tutor's sessions. Tutors can read and change only records owned by their UID. Student email is locked in the profile editor to keep existing assignments linked correctly. For an email change, the project administrator must update the Authentication account and related profile, assignment, and assessment email fields together.

The app is intended for one profile per verified student email per tutor. A verified email is the identity boundary: if multiple tutors enroll the same email, that student sees all records addressed to that email. Shared family emails therefore share a student view; use a distinct email for each student who needs separate access.

### 6. Configure private file downloads

Files are uploaded to:

```text
work/{tutorUid}/{assignmentId}/resources/{unique-file-name}
work/{tutorUid}/{assignmentId}/submissions/{unique-file-name}
```

The app uses authenticated `getBlob()` downloads instead of storing permanent bearer download links. Firebase requires Storage CORS configuration for these browser downloads. See [Firebase's file download documentation](https://firebase.google.com/docs/storage/web/download-files#cors_configuration).

Copy `cors.example.json` to `cors.json`, replace the example origins with your real origins, then use the [Google Cloud CLI](https://cloud.google.com/storage/docs/using-cors):

```sh
gcloud storage buckets update gs://YOUR_EXACT_BUCKET_NAME --cors-file=cors.json
```

For GitHub Pages, the origin is `https://YOUR_USERNAME.github.io`, without the repository path. CORS is separate from authorization; the Storage rules still enforce account access.

Uploads allow PDF, JPG, PNG, WebP, TXT, and DOCX up to 10 MB each. Demo files use local storage and are limited by the browser's smaller total quota. For production, file type metadata is checked by the app and rules; there is no server-side malware scanning. Failed or abandoned uploads can leave unreferenced files in Storage; an administrator can remove them from the console.

## Publish on GitHub Pages

1. Create a GitHub repository and upload **the contents of this folder** to the repository root, including `index.html`, `styles.css`, `firebase-config.js`, `favicon.svg`, and the entire `js` folder.
2. Include `.nojekyll` if uploading with Git. The app's relative asset paths also work under a repository subpath.
3. In the repository, open **Settings → Pages**.
4. Choose **Deploy from a branch → main → / (root)** and save.
5. Open the Pages address GitHub provides, normally `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`.
6. For Firebase mode, authorize that hostname in Firebase Authentication and set your bucket's CORS origins as described above.

The HTML shell and client source are public on a public GitHub Pages site. Student records remain in your Firebase project, protected by Authentication and the deployed rules. Do not put exports, passwords, or student data in the repository. Pages hosting availability depends on your GitHub account and repository settings.

If you upload the whole `cayden-tutoring` folder rather than its contents, the app address will have an extra `/cayden-tutoring/` path.

## Optional: Firebase Hosting

With the CLI linked to the intended project:

```sh
firebase deploy --only hosting
```

`firebase.json` excludes tooling, rules, tests, and package metadata from the hosted site. The public setup guide is included so the app's Settings link works after deployment.

## Data model and access

| Collection | Contents | Tutor | Student |
| --- | --- | --- | --- |
| `tutors/{authUid}` | Admin-provisioned role and display name | Read own role | Read own role (if it exists) |
| `students` | Profile, subjects, learning goals | Read/write own students | Read matching verified email |
| `assignments` | Task, submission, feedback, score | Read/write own assignments | Read own; change only response/files/status/submission time while assigned |
| `assessments` | Dated percentage results | Read/create own students' results | Read own results |
| `notes` | Private session observations | Read/create own notes | No access |
| `sessions` | Upcoming session schedule | Read/create own sessions | No access |

New accounts cannot write tutor roles or change their own goals, scores, due dates, feedback, or tutor ownership. The app requests only the current tutor's records or the signed-in student's email-matched records. Cloud mode uses session-scoped Authentication persistence and Firestore's default in-memory cache; it does not enable persistent offline database caching. Sign out on shared devices.

## Checks and verification

```sh
npm test
npm run check
```

The included tests cover the demo lifecycle from student creation through assignment, submission, review, goal update, assessment history, persistence, view isolation, stale-review rejection, local due dates, and safe resource URL handling. No dependencies are needed for these tests.

**Build verification:** demo tests and JavaScript syntax checks passed. Browser visual verification could not be completed because the preview browser could not reach the local server and Windows browser automation stopped. Firebase SDK calls, Firestore/Storage rules, email flows, and syncing were not exercised against a live project. The Firebase emulators were not run because Java was unavailable in the build environment.

Before inviting students, use two separate browser profiles with test accounts in your Firebase project and verify:

- A verified student sees their own tasks, goals, scores, and feedback.
- The other student's document/file cannot be read even by changing a URL or calling the SDK directly.
- A student cannot update goal progress, a score, tutor ownership, feedback, or the `tutors` collection.
- An unverified account cannot read any student data.
- A student cannot read `notes` or `sessions`.
- Tutor review and goal progress sync to the student's browser without a reload.
- Resource and submission file upload/download succeed on your actual hosting origin.

Use Firebase's Rules Playground or Emulator Suite for access-rule checks. The browser demo's filtering is not a substitute for database/Storage rules testing. Firebase App Check, quotas, backups, and retention policies can be configured in your own project as needed.

## File map

```text
index.html                 HTML entry point
styles.css                 Responsive styling
firebase-config.js         Public project configuration and demo/live switch
js/app.js                  Views, dialogs, interaction handlers
js/domain.js               Workflow logic and fictional sample data
js/store.js                Browser-only demo persistence
js/firebase.js             Authentication, sync, transactions, protected files
firestore.rules            Database access and validation rules
storage.rules              File access and upload validation rules
firestore.indexes.json     Index declarations
firebase.json              Optional Firebase deployment configuration
cors.example.json          Storage browser-download origin template
scripts/serve.mjs          Dependency-free development server
tests/workflow.test.js     Core workflow tests
```

Fonts load from Google Fonts with system fallbacks. The rest of the demo has no external runtime dependencies; Firebase mode loads the official browser SDK from Google's CDN. All user-provided text is escaped before HTML rendering, and resource links allow only HTTP/HTTPS.
