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

  function ReUploadAll(){
    fetch('/processAllReplays', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log("Re-upload initiated successfully:", data);
      alert("Re-upload initiated successfully. Check console for details.");
    })
  }
  window.ReUploadAll = ReUploadAll; // Expose to global scope for button click



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
  const user = auth.currentUser;

  if (!user) {
    alert('You must be signed in to upload files.');
    return;
  }

  if (filesToUpload.length === 0) {
    alert('Please select a file first.');
    return;
  }

  // Get references to your existing elements
  const fileListDiv = document.querySelector('.file-list');
  const fileElem = document.getElementById('fileElem');

  // Create progress elements
  const progressContainer = document.createElement('div');
  progressContainer.style.cssText = `
    margin: 10px 0;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
    background:rgba(63, 59, 59, 0.76);
  `;

  const overallProgress = document.createElement('div');
  overallProgress.innerHTML = `
    <div style="margin-bottom: 10px; font-weight: bold;">Overall Progress:</div>
    <div class="progress" style="height: 24px;">
      <div id="overall-bar" class="progress-bar bg-success" role="progressbar" style="width: 0%;" aria-valuenow="0"
        aria-valuemin="0" aria-valuemax="100"></div>
    </div>
    <div id="overall-text" style="text-align: center; margin-top: 5px;">0 / ${filesToUpload.length} files</div>
  `;

  progressContainer.appendChild(overallProgress);

  // Insert progress bar inside the drop-area div, after upload button
  const dropArea = document.getElementById('drop-area');
  dropArea.appendChild(progressContainer);

  // Get progress elements
  const overallBar = document.getElementById('overall-bar');
  const overallText = document.getElementById('overall-text');

  let success = true;
  let completedFiles = 0;

  // Create upload promises for parallel execution
  const uploadPromises = filesToUpload.map(file => {
    const path = `uploads/${user.uid}/${file.name}`;
    const storageRef = firebase.storage().ref(path);

    // Check if file exists before uploading
    return storageRef.getMetadata()
      .then(() => {
        // File exists, skip upload
        console.log(`File already exists, skipping: ${file.name}`);
        completedFiles++;
        const overallProgress = (completedFiles / filesToUpload.length) * 100;
        overallBar.style.width = overallProgress + '%';
        overallBar.setAttribute('aria-valuenow', overallProgress);
        overallText.textContent = `${completedFiles} / ${filesToUpload.length} files`;
        return;
      })
      .catch(error => {
        if (error.code === 'storage/object-not-found') {
          // File does not exist, upload it
          return new Promise((resolve, reject) => {
            const uploadTask = storageRef.put(file);
            uploadTask.on('state_changed',
              null,
              (error) => {
                console.error('Upload error for', file.name, ':', error);
                reject(error);
              },
              () => {
                completedFiles++;
                const overallProgress = (completedFiles / filesToUpload.length) * 100;
                overallBar.style.width = overallProgress + '%';
                overallBar.setAttribute('aria-valuenow', overallProgress);
                overallText.textContent = `${completedFiles} / ${filesToUpload.length} files`;
                console.log(`Completed: ${file.name}`);
                resolve();
              }
            );
          });
        } else {
          // Some other error
          console.error('Error checking metadata for', file.name, ':', error);
          throw error;
        }
      });
  });

  // Execute all uploads in parallel
  try {
    await Promise.all(uploadPromises);
    success = true;
  } catch (err) {
    success = false;
    alert('Upload failed: ' + err.message);
  }

  // Final status
  if (success) {
    overallBar.style.width = '100%';
    setTimeout(() => {
      progressContainer.remove();
    }, 3000);
  } else {
    progressContainer.remove();
  }

  filesToUpload = [];
  fileListDiv.innerHTML = '';
  fileElem.value = '';
});
 
});
