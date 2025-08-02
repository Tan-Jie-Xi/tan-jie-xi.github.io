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
  const saveBtn = document.getElementById("save-profile");

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const username = document.getElementById("username").value.trim();

      if (!username) {
        alert("Please enter a username.");
        return;
      }

      const user = firebase.auth().currentUser;

      if (!user) {
        alert("No user is signed in.");
        return;
      }

      try {
        // Update Firebase Auth displayName
        await user.updateProfile({
          displayName: username,
          photoURL: null // optional: set to a real image URL later
        });

        // Redirect to dashboard after success
        alert("Profile saved!");
        window.location.href = "dashboard.html";
      } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to save profile.");
      }
    });
  }
});

