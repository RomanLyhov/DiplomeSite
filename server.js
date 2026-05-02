process.on("uncaughtException", (err) => {
    console.error("🔥 UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (err) => {
    console.error("🔥 UNHANDLED REJECTION:", err);
});

const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const SECRET = process.env.JWT_SECRET || "fitplan_secret";

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
    user: "appuser",
    host: "localhost",
    database: "fitplandb",
    password: "StrongPass123!",
    port: 5432,
});

// -------------------- LOGIN --------------------
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );
        const user = result.rows[0];
        if (!user) {
            return res.json({ success: false, message: "USER_NOT_FOUND" });
        }
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            return res.json({ success: false, message: "WRONG_PASSWORD" });
        }
        const token = jwt.sign(
            { id: user.userid, email: user.email },
            SECRET,
            { expiresIn: "7d" }
        );
        res.json({
            success: true,
            id: user.userid,
            role: (user.role || "").trim().toLowerCase(), // если в таблице role
            token
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error");
    }
});

// -------------------- USERS --------------------
app.get("/users", async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM users ORDER BY userid DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/users", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const check = await pool.query("SELECT 1 FROM users WHERE email=$1", [email]);
        if (check.rows.length > 0) {
            return res.status(409).json({ message: "User exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users(name, email, password, register_date)
             VALUES ($1, $2, $3, NOW())
             RETURNING userid`,
            [name, email, hashedPassword]
        );
        res.json({ success: true, id: result.rows[0].userid });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/users/:id", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users WHERE userid=$1", [req.params.id]);
        res.json(result.rows[0] || null);
    } catch (err) {
        res.status(500).send("Error");
    }
});

app.put("/users/:id", async (req, res) => {
    try {
        const {
            name, email, password,
            age, height, weight,
            targetWeight, activity, goal, gender,
            dailyCaloriesGoal, dailyProteinGoal, dailyFatGoal, dailyCarbsGoal
        } = req.body;
        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
        await pool.query(
            `UPDATE users SET
                name=$1, email=$2,
                password=COALESCE($3, password),
                age=$4, height=$5, weight=$6,
                targetWeight=$7, activity=$8, goal=$9, gender=$10,
                dailyCaloriesGoal=$11,
                dailyProteinGoal=$12,
                dailyFatGoal=$13,
                dailyCarbsGoal=$14
             WHERE userid=$15`,
            [
                name, email, hashedPassword,
                age, height, weight,
                targetWeight, activity, goal, gender,
                dailyCaloriesGoal, dailyProteinGoal, dailyFatGoal, dailyCarbsGoal,
                req.params.id
            ]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// -------------------- WORKOUTS --------------------
app.get("/workouts/:userId", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM workouts WHERE user_id=$1 ORDER BY created_at DESC",
            [req.params.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).send("Error");
    }
});

app.post("/workouts", async (req, res) => {
    try {
        const { userId, name } = req.body;
        await pool.query(
            "INSERT INTO workouts(user_id, name, created_at) VALUES ($1,$2,NOW())",
            [userId, name]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).send("Error");
    }
});

// -------------------- EXERCISES --------------------
app.get("/exercises", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM exercises ORDER BY exerciseid DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).send("Error");
    }
});

app.get("/exercises/:id", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM exercises WHERE exerciseid=$1", [req.params.id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).send("Error");
    }
});

app.put("/exercises/:id", async (req, res) => {
    try {
        const { name, muscleGroup, difficulty } = req.body;
        await pool.query(
            `UPDATE exercises SET name=$1, muscle_group=$2, difficulty=$3 WHERE exerciseid=$4`,
            [name, muscleGroup, difficulty, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).send("Error");
    }
});

app.delete("/exercises/:id", async (req, res) => {
    try {
        await pool.query("DELETE FROM workout_exercises WHERE exercise_id=$1", [req.params.id]);
        await pool.query("DELETE FROM exercises WHERE exerciseid=$1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).send("Error");
    }
});

// -------------------- PROFILE --------------------
app.get("/api/profile/:id", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT userid, name, email, numberfon FROM users WHERE userid=$1",
            [req.params.id]
        );
        res.json(result.rows[0] || null);
    } catch (err) {
        res.status(500).send("Error");
    }
});

// -------------------- STATIC HTML --------------------
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "adminvh.html")));
app.get("/users.html", (req, res) => res.sendFile(path.join(__dirname, "users.html")));
app.get("/nutrition.html", (req, res) => res.sendFile(path.join(__dirname, "nutrition.html")));
app.get("/exercises.html", (req, res) => res.sendFile(path.join(__dirname, "exercises.html")));
app.get("/profile.html", (req, res) => res.sendFile(path.join(__dirname, "profil.html")));

// -------------------- START --------------------
app.listen(2288, "0.0.0.0", () => {
    console.log("🚀 PostgreSQL server running on port 2288");
});