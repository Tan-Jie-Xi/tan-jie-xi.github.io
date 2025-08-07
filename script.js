
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDOZwIJjuyuux6Z9OQ9x6LBvu3CuxMWfuE",
    authDomain: "quask-a9e1b.firebaseapp.com",
    projectId: "quask-a9e1b",
    storageBucket: "quask-a9e1b.firebasestorage.app",
    messagingSenderId: "726397658400",
    appId: "1:726397658400:web:cac926ec2cbffea890a345",
    measurementId: "G-RT218LJWLP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

let selectedFile = null;

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("login-btn");
    const signupBtn = document.getElementById("signup-btn");
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            window.location.href = "login.html";
        });
    }
    if (signupBtn) {
        signupBtn.addEventListener("click", () => {
            window.location.href = "signup.html";
        });
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = "dashboard.html";
            } catch (error) {
                alert("Login failed: " + error.message);
            }
        });
    }

    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("new-email").value;
            const password = document.getElementById("new-password").value;
            const confirm = document.getElementById("confirm-password").value;

            if (password !== confirm) {
                alert("Passwords do not match.");
                return;
            }

            try {
                await createUserWithEmailAndPassword(auth, email, password);
                alert("Signup successful! Redirecting...");
                window.location.href = "profile-setup.html";
            } catch (error) {
                alert("Signup failed: " + error.message);
            }
        });
    }

    const fileInput = document.getElementById("profile-pic");
    const saveBtn = document.getElementById("save-btn");
    if (fileInput) {
        fileInput.addEventListener("change", (event) => {
            selectedFile = event.target.files[0];
            console.log("Selected file:", selectedFile);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const user = auth.currentUser;

            if (!user) {
                alert("You must be logged in to upload a profile picture.");
                return;
            }
            if (!selectedFile) {
                alert("Please select a profile picture first.");
                return;
            }

            try {
                const storageRef = ref(storage, `profile-pictures/${user.uid}.jpg`);
                await uploadBytes(storageRef, selectedFile);
                const downloadURL = await getDownloadURL(storageRef);
                
                await updateProfile(user, { photoURL: downloadURL });
                
                alert("Profile picture updated successfully!");
                window.location.href = "dashboard.html";
            } catch (error) {
                console.error("Error during profile update:", error);
                alert("Failed to update user profile: " + error.message);
            }
        });
    }
});
