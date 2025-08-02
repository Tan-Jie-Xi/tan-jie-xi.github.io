// Firebase config (Make sure this matches your Firebase project)
const firebaseConfig = {
  apiKey: "AIzaSyAdNYtqf5RgFf_tuT1vRrFg9v6IjPO3D6U",
  authDomain: "quask-61e3c.firebaseapp.com",
  projectId: "quask-61e3c",
  storageBucket: "quask-61e3c.appspot.com",
  messagingSenderId: "305472380462",
  appId: "1:305472380462:web:a1b620ead8dcccc05209bf"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
let selectedFile = null;
const storage = firebase.storage();


document.addEventListener("DOMContentLoaded", () => {
  // Redirect login button on homepage
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      window.location.href = "login.html";
    });
  }

  // Redirect signup button on homepage (if present)
  const signupBtn = document.getElementById("signup-btn");
  if (signupBtn) {
    signupBtn.addEventListener("click", () => {
      window.location.href = "signup.html";
    });
  }

  // Handle login form submission
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      auth.signInWithEmailAndPassword(email, password)
        .then(() => {
          window.location.href = "dashboard.html";
        })
        .catch((error) => {
          alert("Login failed: " + error.message);
        });
    });
  }

  // Handle signup form submission
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const email = document.getElementById("new-email").value;
      const password = document.getElementById("new-password").value;
      const confirm = document.getElementById("confirm-password").value;

      if (password !== confirm) {
        alert("Passwords do not match.");
        return;
      }

      auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
          alert("Signup successful! Redirecting...");
          window.location.href = "profile-setup.html";
        })
        .catch((error) => {
          alert("Signup failed: " + error.message);
        });
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // 🔧 Listen for file selection
  const fileInput = document.getElementById("profile-pic");
  if (fileInput) {
    fileInput.addEventListener("change", (event) => {
      selectedFile = event.target.files[0];
      console.log("Selected file:", selectedFile);
    });
  }

  // 🔧 Save Profile Picture
  const savePicBtn = document.getElementById("save-btn");
  if (savePicBtn) {
    savePicBtn.addEventListener("click", () => {
      const user = auth.currentUser;

      if (!user) {
        alert("You must be logged in to upload a profile picture.");
        return;
      }

      if (!selectedFile) {
        alert("Please select a profile picture first.");
        return;
      }

      const storageRef = storage.ref(`profile-pictures/${user.uid}.jpg`);
      const uploadTask = storageRef.put(selectedFile);

      uploadTask.on(
        "state_changed",
        null,
        (error) => {
          console.error("Upload error:", error);
          alert("Failed to upload profile picture.");
        },
        () => {
          uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
            user.updateProfile({ photoURL: downloadURL })
              .then(() => {
                alert("Profile picture updated successfully!");
                window.location.href = "dashboard.html";
              })
              .catch((error) => {
                console.error("Profile update error:", error);
                alert("Failed to update user profile.");
              });
          });
        }
      );
    });
  }
});


document.getElementById("save-btn").addEventListener("click", () => {
  const user = auth.currentUser;

  if (!user) {
    alert("You must be logged in to upload a profile picture.");
    return;
  }

  if (!selectedFile) {
    alert("Please select a profile picture first.");
    return;
  }

  const storageRef = storage.ref(`profile-pictures/${user.uid}.jpg`);
  const uploadTask = storageRef.put(selectedFile);

  uploadTask.on(
    "state_changed",
    snapshot => {
      // Optional: Add progress indicator here
    },
    error => {
      console.error("Upload error:", error);
      alert("Failed to upload profile picture.");
    },
    () => {
      uploadTask.snapshot.ref.getDownloadURL().then(downloadURL => {
        user.updateProfile({ photoURL: downloadURL })
          .then(() => {
            alert("Profile picture updated successfully!");
            window.location.href = "dashboard.html";
          })
          .catch(error => {
            console.error("Profile update error:", error);
            alert("Failed to update user profile.");
          });
      });
    }
  );
});
