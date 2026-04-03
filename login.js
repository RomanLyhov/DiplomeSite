// Хардкод логина и пароля
const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "1234";

// Ждем полной загрузки DOM
document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("login-btn");
    const loginInput = document.getElementById("login");
    const passwordInput = document.getElementById("password");
    const errorDiv = document.getElementById("error-msg");

    loginBtn.addEventListener("click", () => {
        const login = loginInput.value.trim();
        const password = passwordInput.value.trim();

        if (!login || !password) {
            errorDiv.textContent = "Введите логин и пароль";
            errorDiv.style.display = "block";
            return;
        }

        // Проверка логина и пароля
        if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
            // Переход на страницу пользователей
            window.location.href = "/users.html"; // <--- абсолютный путь!
        } else {
            errorDiv.textContent = "Неверный логин или пароль";
            errorDiv.style.display = "block";
        }
    });
});