const express = require("express");
const cors = require("cors");
const path = require("path");
const sql = require("mssql");

const app = express();

app.use(cors());
app.use(express.json());

// 👉 раздаём все файлы (HTML, CSS, JS)
app.use(express.static(__dirname));

// 🔥 ПОДКЛЮЧЕНИЕ К БД
const config = {
    user: "sa",
    password: "1234",
    server: "localhost",
    port: 1433,
    database: "FitPlanDB",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// 👉 страница логина
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

// 👉 авторизация
const adminData = {
    login: "admin",
    password: "1234"
};

app.post("/admin/login", (req, res) => {
    const { login, password } = req.body;

    if (login === adminData.login && password === adminData.password) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

// 👉 получить всех пользователей
app.get("/users", async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query("SELECT * FROM Users");
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send("Ошибка сервера");
    }
});

// 👉 получить упражнения
app.get("/exercises", async (req, res) => {
    try {
        await sql.connect(config);
        const result = await sql.query("SELECT * FROM Exercises");
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send("Ошибка сервера");
    }
});

// 👉 питание по пользователю
app.get("/nutrition/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        await sql.connect(config);

        const result = await sql.query(`
            SELECT 
                MealType,
                MealTime,
                Product,
                Weight,
                Calories,
                Protein,
                Fat,
                Carbs
            FROM Nutrition
            WHERE UserID = ${userId}
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send("Ошибка сервера");
    }
});

// запуск сервера
app.listen(2288, () => {
    console.log("Server running on http://localhost:2288");
});