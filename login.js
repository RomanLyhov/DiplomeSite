document.getElementById("login-btn").addEventListener("click", async () => {
    const email = document.getElementById("login").value.trim();
    const password = document.getElementById("password").value.trim();
    const error = document.getElementById("error-msg");
    error.innerText = "";

    if (!email || !password) {
        error.innerText = "Введите email и пароль";
        return;
    }

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!data.success) {
            error.innerText = "Неверный email или пароль";
            return;
        }

        localStorage.setItem("userId", data.id);
        localStorage.setItem("role", data.role);      

        const role = (localStorage.getItem("role") || "").toLowerCase().trim();
        if (role === "admin") {
            window.location.href = "/adminvh.html"; 
        } else {
            window.location.href = "/profil.html";
        }
    } catch (e) {
        error.innerText = "Ошибка сервера";
    }
});