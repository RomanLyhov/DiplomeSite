process.on("uncaughtException", (err) => {
    console.error("🔥 UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (err) => {
    console.error("🔥 UNHANDLED REJECTION:", err);
});

const express = require("express");
const safeNumber = (v) => {
    const n = parseInt(v);
    return isNaN(n) ? null : n;
};
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
            return res.json({
                success: false,
                message: "USER_NOT_FOUND"
            });
        }

        const ok = await bcrypt.compare(password, user.password);

        if (!ok) {
            return res.json({
                success: false,
                message: "WRONG_PASSWORD"
            });
        }

        const token = jwt.sign(
            {
                id: user.userid,
                email: user.email
            },
            SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            success: true,

            id: user.userid,
            name: user.name,
            email: user.email,

            age: user.age,
            height: user.height,
            weight: user.weight,

            targetWeight: user.targetweight,

            activity: user.activity,
            goal: user.goal,
            gender: user.gender,

            dailyCaloriesGoal: user.dailycaloriesgoal,
            dailyProteinGoal: user.dailyproteingoal,
            dailyFatGoal: user.dailyfatgoal,
            dailyCarbsGoal: user.dailycarbsgoal,

            role: (user.rol || "").trim().toLowerCase(),
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

        const result = await pool.query(`
SELECT
    userid,
    userid as id,
    name,
    email,
    age,
    height,
    weight,
    targetweight AS "targetWeight",
    activity,
    goal,
    gender,
    dailycaloriesgoal AS "dailyCaloriesGoal",
    dailyproteingoal AS "dailyProteinGoal",
    dailyfatgoal AS "dailyFatGoal",
    dailycarbsgoal AS "dailyCarbsGoal"
FROM users
ORDER BY userid DESC
`);

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/users", async (req, res) => {
    try {
        const {
            name, email, password,
            age, height, weight,
            targetWeight, activity, goal, gender,
            dailyCaloriesGoal, dailyProteinGoal, dailyFatGoal, dailyCarbsGoal
        } = req.body;
        
        console.log("📝 Регистрация:", req.body);
        
        const check = await pool.query("SELECT 1 FROM users WHERE email=$1", [email]);
        if (check.rows.length > 0) {
            return res.status(409).json({ message: "User exists" });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Принудительное преобразование в число
        const ageNum = age ? parseInt(age) : null;
        const heightNum = height ? parseInt(height) : null;
        const weightNum = weight ? parseInt(weight) : null;
        const targetWeightNum = targetWeight ? parseInt(targetWeight) : null;
        const dailyCaloriesGoalNum = safeNumber(dailyCaloriesGoal);
const dailyProteinGoalNum = safeNumber(dailyProteinGoal);
const dailyFatGoalNum = safeNumber(dailyFatGoal);
const dailyCarbsGoalNum = safeNumber(dailyCarbsGoal);
        
        const result = await pool.query(
            `INSERT INTO users(
                name, email, password, age, height, weight, targetweight,
                activity, goal, gender,
                dailycaloriesgoal, dailyproteingoal, dailyfatgoal, dailycarbsgoal,
                register_date, createdat, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, NOW(), NOW(), NOW()
            ) RETURNING userid`,
            [
                name, email, hashedPassword,
                ageNum, heightNum, weightNum, targetWeightNum,
                activity, goal, gender,
                dailyCaloriesGoalNum, dailyProteinGoalNum,
                dailyFatGoalNum, dailyCarbsGoalNum
            ]
        );
        
        console.log("✅ User created with ID:", result.rows[0].userid);
        res.json({ success: true, id: result.rows[0].userid });
        
    } catch (err) {
        console.error("❌ Registration error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/users/:id", async (req, res) => {
    try {
        const result = await pool.query(`
SELECT
    userid,
    userid as id,
    name,
    email,
    age,
    height,
    weight,
    targetweight AS "targetWeight",
    activity,
    goal,
    gender,
    dailycaloriesgoal AS "dailyCaloriesGoal",
    dailyproteingoal AS "dailyProteinGoal",
    dailyfatgoal AS "dailyFatGoal",
    dailycarbsgoal AS "dailyCarbsGoal"
FROM users
WHERE userid=$1
`, [req.params.id]);
        res.json(result.rows[0] || null);
    } catch (err) {
        res.status(500).send("Error");
    }
});

app.put("/users/:id", async (req, res) => {
    try {
        console.log("🔥 UPDATE USER BODY:", req.body);
        console.log("🔥 UPDATE USER ID:", req.params.id);

        const {
    name,
    email,
    password,
    age,
    height,
    weight,
    targetWeight,
    activity,
    goal,
    gender,
    dailyCaloriesGoal,
    dailyProteinGoal,
    dailyFatGoal,
    dailyCarbsGoal
} = req.body;

        // хеш пароля только если он есть
        const hashedPassword = password
            ? await bcrypt.hash(password, 10)
            : null;

        // безопасное преобразование КБЖУ
        const cal = safeNumber(dailyCaloriesGoal);
        const protein = safeNumber(dailyProteinGoal);
        const fat = safeNumber(dailyFatGoal);
        const carbs = safeNumber(dailyCarbsGoal);

        await pool.query(
            `UPDATE users SET
                name=$1,
                email=$2,
                password=COALESCE($3, password),
                age=$4,
                height=$5,
                weight=$6,
                targetweight=$7,
                activity=$8,
                goal=$9,
                gender=$10,

                dailycaloriesgoal=$11,
                dailyproteingoal=$12,
                dailyfatgoal=$13,
                dailycarbsgoal=$14

            WHERE userid=$15`,
            [
                name,
                email,
                hashedPassword,
                age,
                height,
                weight,
                targetWeight,
                activity,
                goal,
                gender,
                cal,
                protein,
                fat,
                carbs,
                req.params.id
            ]
        );

        res.json({ success: true });

    } catch (err) {
        console.error("❌ UPDATE ERROR:", err);
        res.status(500).send(err.message);
    }
});

// -------------------- WORKOUTS --------------------
app.get("/workouts/:userId", async (req, res) => {
   try {
        const { userId } = req.params;

        const result = await pool.query(
            "SELECT * FROM workouts WHERE user_id=$1 ORDER BY created_at DESC",
            [userId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error");
    }
});

app.post("/workouts", async (req, res) => {
    try {
        const { userId, name } = req.body;

        const result = await pool.query(
            `INSERT INTO workouts(user_id, name, created_at)
             VALUES ($1,$2,NOW())
             RETURNING id, user_id, name`,
            [userId, name]
        );

        res.json({
            success: true,
            workout: result.rows[0]
        });

    } catch (err) {
        console.error(err);
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

console.log("✅ EXERCISES POST ROUTE LOADED");
app.post("/exercises", async (req, res) => {

    console.log("📥 BODY:", req.body);

    try {

        const { name, muscleGroup, difficulty } = req.body;

        await pool.query(
            `
            INSERT INTO exercises(
                name,
                muscle_group,
                difficulty
            )
            VALUES($1, $2, $3)
            `,
            [
                name,
                muscleGroup,
                difficulty
            ]
        );

        console.log("✅ EXERCISE ADDED");

        res.json({
            success: true
        });

    } catch (err) {

        console.error("❌ ADD EXERCISE ERROR:", err);

        res.status(500).json({
            success: false,
            error: err.message
        });
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

// -------------------- WORKOUT EXERCISES --------------------

app.get("/workout-exercises/:workoutId", async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                e.*
            FROM workoutexercises we
            JOIN exercises e
                ON e.exerciseid = we.exercise_id
            WHERE we.workout_id = $1
            `,
            [req.params.workoutId]
        );

        res.json(result.rows);

    } catch (err) {

        console.error(err);

        res.status(500).send("Error");
    }

});

app.post("/workout-exercises", async (req, res) => {

    try {

        const {
            workoutId,
            exerciseId
        } = req.body;

        await pool.query(
            `
            INSERT INTO workoutexercises(
                workout_id,
                exercise_id
            )
            VALUES($1, $2)
            `,
            [
                workoutId,
                exerciseId
            ]
        );

        res.json({
            success: true
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false
        });
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
app.put("/workouts/:id", async (req, res) => {
    try {
        const { name } = req.body;

        await pool.query(
            "UPDATE workouts SET name=$1 WHERE id=$2",
            [name, req.params.id]
        );

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get("/worckouts.html", (req, res) =>
    res.sendFile(path.join(__dirname, "workouts.html"))
);

app.get("/worck.html", (req, res) =>
    res.sendFile(path.join(__dirname, "workout.html"))
);

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