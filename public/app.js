import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJDFiaBybMqhpzWhDc9OTIEP13InQD9vc",
  authDomain: "wot-insight.firebaseapp.com",
  projectId: "wot-insight",
  storageBucket: "wot-insight.appspot.com",
  // You may also want to add messagingSenderId and appId here if you have them
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {
  const fileElem = document.getElementById('fileElem');
  const uploadBtn = document.getElementById('upload-btn');
  const fileListDiv = document.querySelector('.file-list');
  let filesToUpload = [];
  const MAX_DISPLAY = 5;

  // Auth state listener
  onAuthStateChanged(auth, user => {
    uploadBtn.disabled = !user;
    console.log(user ? `Signed in as ${user.email}` : 'Signed out');
  });

  document.getElementById('login').addEventListener('click', () => {
    signInWithPopup(auth, provider)
      .then(result => console.log("Signed in:", result.user.email))
      .catch(error => console.error("Sign-in error:", error));
  });

  document.getElementById('logout').addEventListener('click', () => {
    signOut(auth).then(() => console.log("Signed out"));
  });

  fileElem.addEventListener('change', (e) => {
    filesToUpload = Array.from(e.target.files);

    const displayed = filesToUpload.slice(0, MAX_DISPLAY).map(f => `<div>${f.name}</div>`);
    const remaining = filesToUpload.length - MAX_DISPLAY;
    if (remaining > 0) {
      displayed.push(`<div>+${remaining} more</div>`);
    }

    fileListDiv.innerHTML = displayed.join('');
  });

  uploadBtn.addEventListener('click', async () => {
    const user = auth.currentUser;  // Use modular auth instance

    if (!user) {
      alert('You must be signed in to upload files.');
      return;
    }

    if (filesToUpload.length === 0) {
      alert('Please select a file first.');
      return;
    }

    let success = true;
    for (const file of filesToUpload) {
      try {
        const path = `uploads/${user.uid}/${file.name}`;
        const storageRef = firebase.storage().ref(path);
        await storageRef.put(file);
      } catch (err) {
        success = false;
        alert('Upload failed: ' + err.message);
      }
    }

    if (success) {
      alert('All files uploaded to Firebase Storage!');
    }

    filesToUpload = [];
    fileListDiv.innerHTML = '';
    fileElem.value = ''; // reset input
  });
});
