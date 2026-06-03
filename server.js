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

app.get("/meals", async (req, res) => {
    try {
console.log("🔥 /meals HIT");
console.log(req.body);
        const userId = Number(req.query.userId);

        if (!userId) {
            return res.json([]);
        }

        const result = await pool.query(`
            SELECT
                n.logid AS id,
                n.user_id AS "userId",
                p.name AS "productName",

                n.quantity,
                n.calories,
                n.protein,
                n.fat,
                n.carbs,

                n.meal_type AS "mealType",
                EXTRACT(EPOCH FROM n.date) * 1000 AS date

            FROM nutritionlog n
            JOIN products p
                ON p.productid = n.product_id

            WHERE n.user_id = $1
            ORDER BY n.logid DESC
        `, [userId]);

        res.json(result.rows);

    } catch (err) {
        console.error("GET MEALS ERROR:", err);

        res.status(500).json([]);
    }
});

app.post("/meals", async (req, res) => {
    try {

        console.log("🔥 MEAL RECEIVED:", req.body);

        const {
            userId,
            productName,
            quantity,
            calories,
            protein,
            fat,
            carbs,
            mealType,
            date
        } = req.body;

        if (!userId || !productName) {
            return res.status(400).json({
                success: false,
                message: "Missing fields"
            });
        }

        // ---------------------------
        // Ищем продукт
        // ---------------------------

        let productId;

        const existingProduct = await pool.query(
            `
            SELECT productid
            FROM products
            WHERE LOWER(name)=LOWER($1)
            `,
            [productName]
        );

        // если продукта нет — создаём
        if (existingProduct.rows.length === 0) {

            const inserted = await pool.query(
                `
                INSERT INTO products(
                    name,
                    calories,
                    protein,
                    fat,
                    carbs
                )
                VALUES($1,$2,$3,$4,$5)
                RETURNING productid
                `,
                [
                    productName,
                    calories,
                    protein,
                    fat,
                    carbs
                ]
            );

            productId = inserted.rows[0].productid;

            console.log("✅ PRODUCT CREATED:", productId);

        } else {

            productId =
                existingProduct.rows[0].productid;

            console.log("✅ PRODUCT EXISTS:", productId);
        }

        // ---------------------------
        // Добавляем meal
        // ---------------------------

        const result = await pool.query(
            `
            INSERT INTO nutritionlog(
                user_id,
                product_id,
                meal_type,
                quantity,
                calories,
                protein,
                fat,
                carbs,
                date
            )
            VALUES(
                $1,$2,$3,$4,$5,$6,$7,$8,$9
            )
            RETURNING logid
            `,
            [
                userId,
                productId,
                mealType,
                quantity,
                calories,
                protein,
                fat,
                carbs,
                new Date(date)
            ]
        );

        res.json({
            success: true,
            id: result.rows[0].logid
        });

    } catch (err) {

        console.error("MEAL ERROR:", err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});
// -------------------- WORKOUTS --------------------
app.get("/workouts/:userId", async (req, res) => {
    try {
         console.log("🔥 HIT WORKOUTS API");
    console.log(req.params.userId);
        console.log("🔥 REQUEST RECEIVED");
        console.log("PARAM:", req.params.userId);

        const userId = Number(req.params.userId);

        if (Number.isNaN(userId)) {
            console.log("❌ BAD USER ID");
            return res.json([]);
        }

        console.log("🔥 QUERYING DB FOR USER:", userId);

        const result = await pool.query(
            `
            SELECT
                workoutid,
                workoutid as id,
                user_id AS "userId",
                name,
                created_at AS "createdAt"
            FROM workouts
            WHERE user_id = $1
            ORDER BY workoutid DESC
            `,
            [userId]
        );

        console.log("🔥 DB RESULT ROWS:", result.rows);
        console.log("🔥 NUMBER OF ROWS:", result.rows.length);
        
        res.json(result.rows);

    } catch (err) {
        console.error("❌ WORKOUTS ERROR:", err);
        res.status(500).json([]);
    }
});

app.post("/workouts", async (req, res) => {
    try {
        const userId = req.body.userId || req.body.user_id;
        const name = req.body.name;

        if (!userId || !name) {
            return res.status(400).json({
                success: false,
                error: "userId or name missing"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO workouts(user_id, name, created_at)
            VALUES ($1, $2, NOW())
            RETURNING workoutid
            `,
            [userId, name]
        );

        res.json({
            success: true,
            id: result.rows[0].workoutid
        });

    } catch (err) {
        console.error("❌ WORKOUT ERROR:", err);
        res.status(500).json({
            success: false,
            error: err.message
        });
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
    try {

        console.log("🔥 BODY:", req.body);

        const {
            workoutId,
            name,
            sets,
            reps,
            weight,
            rest
        } = req.body;

        if (!workoutId || !name) {
            return res.status(400).json({
                success: false,
                error: "workoutId or name missing"
            });
        }

        // 1. создаём exercise
        const exerciseResult = await pool.query(
            `
            INSERT INTO exercises(
                name,
                muscle_group,
                difficulty
            )
            VALUES($1,'-', '-')
            RETURNING exerciseid
            `,
            [name]
        );

        const exerciseId = exerciseResult.rows[0].exerciseid;

        console.log("✅ exerciseId:", exerciseId);

        // 2. связываем с workout
        await pool.query(
            `
            INSERT INTO workoutexercises(
                workout_id,
                exercise_id,
                sets,
                reps,
                weight,
                rest
            )
            VALUES($1,$2,$3,$4,$5,$6)
            `,
            [
                workoutId,
                exerciseId,
                sets || 0,
                reps || 0,
                weight || 0,
                rest || 0
            ]
        );

        res.json({ success: true });

    } catch (err) {
        console.error("❌ EXERCISE ERROR:", err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.delete("/exercises/:id", async (req, res) => {
    try {
        await pool.query("DELETE FROM workoutexercises WHERE exercise_id=$1", [req.params.id]);
        await pool.query("DELETE FROM exercises WHERE exerciseid=$1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE ERROR:", err);
        res.status(500).send("Error");
    }
});

app.post("/workouts/full", async (req, res) => {
    try {
        const { userId, name, exercises } = req.body;

        const workout = await pool.query(
            `INSERT INTO workouts(user_id, name, created_at)
             VALUES($1,$2,NOW())
             RETURNING workoutid`,
            [userId, name]
        );

        const workoutId = workout.rows[0].workoutid;

        for (const ex of exercises) {
            const exRes = await pool.query(
                `INSERT INTO exercises(name, muscle_group, difficulty)
                 VALUES($1,'-','-')
                 RETURNING exerciseid`,
                [ex.name]
            );

            await pool.query(
                `INSERT INTO workoutexercises
                (workout_id, exercise_id, sets, reps, weight, rest)
                VALUES ($1,$2,$3,$4,$5,$6)`,
                [
                    workoutId,
                    exRes.rows[0].exerciseid,
                    ex.sets,
                    ex.reps,
                    ex.weight,
                    ex.rest
                ]
            );
        }

        res.json({ success: true, workoutId });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});

app.get("/workouts/full/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        const workouts = await pool.query(
            "SELECT * FROM workouts WHERE user_id=$1",
            [userId]
        );

        const result = [];

        for (const w of workouts.rows) {
            const exercises = await pool.query(`
                SELECT
                    e.exerciseid,
                    e.name,
                    we.sets,
                    we.reps,
                    we.weight,
                    we.rest
                FROM workoutexercises we
                JOIN exercises e ON e.exerciseid = we.exercise_id
                WHERE we.workout_id = $1
            `, [w.workoutid]);

            result.push({
                id: w.workoutid,
                userId: w.user_id,
                name: w.name,
                createdAt: w.created_at,
                exercises: exercises.rows
            });
        }

        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// -------------------- WORKOUT EXERCISES --------------------

app.get("/workout-exercises/:workoutId", async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                e.exerciseid AS id,
                e.name,
                e.muscle_group AS "muscleGroup",
                e.difficulty
            FROM workoutexercises we
            JOIN exercises e
                ON e.exerciseid = we.exercise_id
            WHERE we.workout_id = $1
            `,
            [req.params.workoutId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error("GET workout-exercises ERROR:", err);
        res.status(500).send("Error");
    }
});

app.post("/workout-exercises", async (req, res) => {
    try {

        console.log("🔥 WORKOUT EXERCISE BODY:", req.body);

        const {
            workoutId,
            exerciseId,
            sets,
            reps,
            weight,
            rest
        } = req.body;

        console.log("🔥 VALUES:", {
            workoutId,
            exerciseId,
            sets,
            reps,
            weight,
            rest
        });

        const result = await pool.query(
            `
            INSERT INTO workoutexercises(
                workout_id,
                exercise_id,
                sets,
                reps,
                weight,
                rest
            )
            VALUES($1,$2,$3,$4,$5,$6)
            RETURNING *
            `,
            [
                workoutId,
                exerciseId,
                sets,
                reps,
                weight,
                rest
            ]
        );

        console.log("✅ INSERTED:", result.rows[0]);

        res.json({
            success: true
        });

    } catch (err) {

        console.error("❌ SAVE WORKOUT EXERCISE ERROR:", err);

        res.status(500).json({
            success: false,
            error: err.message
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
            "UPDATE workouts SET name=$1 WHERE workoutid=$2",
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