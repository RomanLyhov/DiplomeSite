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
       
await pool.query(
    `UPDATE users
     SET is_online = true,
         last_seen = $1
     WHERE userid = $2`,
    [Date.now(), user.userid]
);

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

app.get("/exercises/search", async (req, res) => {
    try {
        const query = req.query.q || "";
        if (query.length < 2) return res.json([]);

        // 🔥 ИСПРАВЛЕНО: добавляем instruction в SELECT
        const result = await pool.query(
            `SELECT exerciseid AS id, name, instruction 
             FROM exercises 
             WHERE LOWER(name) LIKE LOWER($1) 
             ORDER BY name 
             LIMIT 10`,
            [`%${query}%`]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Search error:", err);
        res.status(500).json([]);
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
    last_seen       AS "lastSeen",
    is_online       AS "isOnline",
    register_date   AS "registerDate",
    createdat       AS "createdAt",
    dailycaloriesgoal AS "dailyCaloriesGoal",
    dailyproteingoal  AS "dailyProteinGoal",
    dailyfatgoal      AS "dailyFatGoal",
    dailycarbsgoal    AS "dailyCarbsGoal",
    start_weight AS "startWeight"
FROM users
WHERE userid = $1
`, [req.params.id]);
         const userData = result.rows[0] || null;
        // авто-оффлайн если last_seen > 10 минут назад
        if (userData && userData.isOnline) {
            const ONLINE_TIMEOUT_MS = 10 * 60 * 1000;
            const lastSeenRaw = userData.lastSeen;
            const lastSeenTs  = typeof lastSeenRaw === "number"
                ? lastSeenRaw
                : (lastSeenRaw ? new Date(lastSeenRaw).getTime() : null);
            if (lastSeenTs && (Date.now() - lastSeenTs) > ONLINE_TIMEOUT_MS) {
                userData.isOnline = false;
                // сбрасываем в БД фоново, не блокируя ответ
                pool.query("UPDATE users SET is_online=false WHERE userid=$1", [req.params.id]).catch(() => {});
            }
        }
       res.json(userData);
    } catch (err) {
        console.error("❌ GET USER ERROR:", err.message); 
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

        const userId = Number(req.query.userId);
        const start = Number(req.query.start);
        const end = Number(req.query.end);

        if (!userId) {
            return res.json([]);
        }

        const params = [userId];
        let dateFilter = "";

        // 👉 добавляем фильтр по дате только если он есть
        if (start && end) {
            params.push(start, end);
            dateFilter = `AND n.date >= $2 AND n.date < $3`;
        }

        const result = await pool.query(`
    SELECT
        n.logid AS id,
        n.user_id AS "userId",
        n.product_id AS "productId",

        p.name AS "productName",

        n.quantity,
        n.calories,
        n.protein,
        n.fat,
        n.carbs,

        n.meal_type AS "mealType",
        n.date AS date

    FROM nutritionlog n
    JOIN products p
        ON p.productid = n.product_id

    WHERE n.user_id = $1
    ${dateFilter}

    ORDER BY n.logid DESC
`, params);

        return res.json(result.rows);

    } catch (err) {
        console.error("GET MEALS ERROR:", err);
        return res.status(500).json([]);
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

        // -------- STRICT NUMBER SAFE --------
        const toNumber = (v, fallback = 0) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : fallback;
        };

        const parsedUserId = toNumber(userId, null);
        if (parsedUserId === null) {
            return res.status(400).json({
                success: false,
                error: "Invalid userId"
            });
        }

        const parsedQuantity = toNumber(quantity, 100);
        const parsedCalories = toNumber(calories, 0);
        const parsedProtein = toNumber(protein, 0);
        const parsedFat = toNumber(fat, 0);
        const parsedCarbs = toNumber(carbs, 0);

        const mealDate = Number.isFinite(Number(date))
            ? Number(date)
            : Date.now();

        if (!productName) {
            return res.status(400).json({
                success: false,
                error: "productName missing"
            });
        }

        // -------- PRODUCT UPSERT --------
        let productId;

        const productResult = await pool.query(
            `SELECT productid FROM products WHERE LOWER(name)=LOWER($1) LIMIT 1`,
            [productName.trim()]
        );

        if (productResult.rows.length > 0) {
            productId = productResult.rows[0].productid;
        } else {
            const insertProduct = await pool.query(
                `INSERT INTO products(name, calories, protein, fat, carbs)
                 VALUES($1,$2,$3,$4,$5)
                 RETURNING productid`,
                [
                    productName.trim(),
                    parsedCalories,
                    parsedProtein,
                    parsedFat,
                    parsedCarbs
                ]
            );

            productId = insertProduct.rows[0].productid;
        }

        // -------- INSERT MEAL --------
        const result = await pool.query(
            `INSERT INTO nutritionlog(
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
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING logid`,
            [
                parsedUserId,
                productId,
                mealType || "Другое",
                parsedQuantity,
                parsedCalories,
                parsedProtein,
                parsedFat,
                parsedCarbs,
                mealDate
            ]
        );

        console.log("✅ MEAL SAVED ID:", result.rows[0].logid);

        return res.json({
            success: true,
            id: result.rows[0].logid
        });

    } catch (err) {
        console.error("❌ MEAL ERROR:", err);
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.get("/progress/weight/:userId", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT reportid, user_id, report_date, current_weight
             FROM progressreports
             WHERE user_id = $1
             ORDER BY report_date DESC`,
            [req.params.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("GET progress/weight ERROR:", err);
        res.status(500).json([]);
    }
});

// POST /progress/weight — добавить замер
// POST /progress/weight — добавить замер
app.post("/progress/weight", async (req, res) => {
    try {
        const { userId, weight, date } = req.body;
        
        console.log("📥 POST /progress/weight body:", { userId, weight, date }); // ← добавь
        
        if (!userId || !weight) return res.status(400).json({ success: false, error: "userId or weight missing" });

        const reportDate = date ? Number(date) : Date.now();

        const result = await pool.query(
            `INSERT INTO progressreports(user_id, report_date, current_weight)
             VALUES($1, $2, $3)
             RETURNING reportid`,
            [userId, reportDate, weight]
        );

        console.log("✅ INSERT done, reportid:", result.rows[0].reportid); // ← добавь

        await pool.query(
            `UPDATE users 
             SET weight = $1,
                 start_weight = COALESCE(start_weight, $1)
             WHERE userid = $2`,
            [weight, userId]
        );

        console.log("✅ UPDATE users done"); // ← добавь

        res.json({ success: true, id: result.rows[0].reportid });
    } catch (err) {
        console.error("POST progress/weight ERROR:", err.message); // уже есть
        res.status(500).json({ success: false, error: err.message });
    }
});
// DELETE /progress/weight/:id — удалить замер
app.delete("/progress/weight/:id", async (req, res) => {
    try {
        // Сначала узнаём userId удаляемого замера
        const entry = await pool.query(
            "SELECT user_id FROM progressreports WHERE reportid = $1",
            [req.params.id]
        );

        await pool.query("DELETE FROM progressreports WHERE reportid = $1", [req.params.id]);

        
        if (entry.rows.length > 0) {
            const userId = entry.rows[0].user_id;
            const latest = await pool.query(
                `SELECT current_weight FROM progressreports 
                 WHERE user_id = $1 
                 ORDER BY report_date DESC 
                 LIMIT 1`,
                [userId]
            );
            if (latest.rows.length > 0) {
                await pool.query(
                    `UPDATE users SET weight = $1 WHERE userid = $2`,
                    [latest.rows[0].current_weight, userId]
                );
            }
            // Если замеров больше нет — вес в профиле не трогаем (остаётся последний известный)
        }

        res.json({ success: true });
    } catch (err) {
        console.error("DELETE progress/weight ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /progress/exercise/:userId — прогресс по упражнению
// query: exerciseId (id или имя упражнения)
app.get("/progress/exercise/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { exerciseId } = req.query;

        if (!exerciseId) return res.json([]);

        // ищем сначала по id, потом по имени
        let exId = Number(exerciseId);
        if (isNaN(exId)) {
            const exRes = await pool.query(
                "SELECT exerciseid FROM exercises WHERE LOWER(name)=LOWER($1) LIMIT 1",
                [exerciseId]
            );
            if (!exRes.rows.length) return res.json([]);
            exId = exRes.rows[0].exerciseid;
        }

        // берём из exerciseprogress если есть записи
        const epRows = await pool.query(
            `SELECT progressid, user_id, exercise_id, workout_id,
                    progress_date, weight, reps, sets_count, notes
             FROM exerciseprogress
             WHERE user_id = $1 AND exercise_id = $2
             ORDER BY progress_date ASC`,
            [userId, exId]
        );

        if (epRows.rows.length) {
            // Добавляем флаг isFirstEntry для первой записи
            const rows = epRows.rows.map((row, index) => {
                return {
                    ...row,
                    isFirstEntry: index === 0 && row.notes === '🏁 Начальный вес (зафиксирован)'
                };
            });
            return res.json(rows);
        }

        // fallback: если exerciseprogress пустой — тянем из workout_history + workoutexercises
        const fallback = await pool.query(
            `SELECT
                wh.completed_at AS progress_date,
                we.weight,
                we.reps,
                we.sets AS sets_count
             FROM workout_history wh
             JOIN workoutexercises we ON we.workout_id = wh.workout_id
             WHERE wh.user_id = $1 AND we.exercise_id = $2
               AND we.weight > 0
             ORDER BY wh.completed_at ASC`,
            [userId, exId]
        );
        res.json(fallback.rows);
    } catch (err) {
        console.error("GET progress/exercise ERROR:", err);
        res.status(500).json([]);
    }
});

// GET /progress/route для страницы
app.get("/progress.html", (req, res) =>
    res.sendFile(path.join(__dirname, "progress.html"))
);

app.get("/workouts/recommended", async (req, res) => {
    try {
        const userId = req.query.userId ? Number(req.query.userId) : null;

        const params = [];
        let excludeClause = "";

        if (userId) {
            params.push(userId);
            excludeClause = `AND NOT EXISTS (
                SELECT 1 FROM workouts u2
                WHERE u2.user_id = $1 AND u2.copied_from = w.workoutid
            )`;
        }

        const workouts = await pool.query(`
            SELECT
                w.workoutid AS id,
                w.name,
                w.created_at AS "createdAt",
                w.is_recommended AS "isRecommended",
                u.name AS "authorName"
            FROM workouts w
            JOIN users u ON u.userid = w.user_id
            WHERE w.is_recommended = TRUE
            ${excludeClause}
            ORDER BY w.workoutid DESC
        `, params);

        const result = [];
        for (const w of workouts.rows) {
            const exercises = await pool.query(`
                SELECT
                    e.exerciseid AS "exerciseId",
                    e.name,
                    e.muscle_group AS "muscleGroup",
                    we.sets, we.reps, we.weight, we.rest
                FROM workoutexercises we
                JOIN exercises e ON e.exerciseid = we.exercise_id
                WHERE we.workout_id = $1
            `, [w.id]);
            result.push({ ...w, exercises: exercises.rows });
        }

        res.json(result);

    } catch (err) {
        console.error("❌ RECOMMENDED WORKOUTS ERROR:", err);
        res.status(500).json([]);
    }
});
// -------------------- WORKOUTS --------------------

app.post("/logout", async (req, res) => {
    try {
        const { userId } = req.body;
        if (userId) {
           await pool.query(
                `UPDATE users SET is_online = false, last_seen = $2 WHERE userid = $1`,
                [userId, Date.now()]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error("LOGOUT ERROR:", err);
        res.status(500).json({ success: false });
    }
});
app.patch("/workouts/:id/recommend", async (req, res) => {
    try {
        const { isRecommended } = req.body;

        await pool.query(
            "UPDATE workouts SET is_recommended=$1 WHERE workoutid=$2",
            [isRecommended, req.params.id]
        );

        res.json({ success: true });

    } catch (err) {
        console.error("❌ PATCH RECOMMEND ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});
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

app.post("/workouts/copy", async (req, res) => {
    try {
        const { userId, workoutId } = req.body;

        if (!userId || !workoutId) {
            return res.status(400).json({ success: false, error: "userId or workoutId missing" });
        }

        // Проверяем не добавлена ли уже
        const exists = await pool.query(
            `SELECT workoutid FROM workouts WHERE user_id=$1 AND copied_from=$2 LIMIT 1`,
            [userId, workoutId]
        );
        if (exists.rows.length > 0) {
            return res.json({ success: false, alreadyAdded: true });
        }

        // Получаем оригинальную тренировку
        const original = await pool.query(
            "SELECT * FROM workouts WHERE workoutid=$1", [workoutId]
        );
        if (!original.rows[0]) {
            return res.status(404).json({ success: false, error: "Workout not found" });
        }

        const w = original.rows[0];

        // Создаём копию
        const newWorkout = await pool.query(
            `INSERT INTO workouts(user_id, name, created_at, is_recommended, copied_from)
             VALUES ($1, $2, NOW(), FALSE, $3)
             RETURNING workoutid`,
            [userId, w.name, workoutId]
        );
        const newId = newWorkout.rows[0].workoutid;

        // Копируем упражнения
        const exercises = await pool.query(
            "SELECT * FROM workoutexercises WHERE workout_id=$1", [workoutId]
        );
        for (const ex of exercises.rows) {
            await pool.query(
                `INSERT INTO workoutexercises(workout_id, exercise_id, sets, reps, weight, rest)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [newId, ex.exercise_id, ex.sets, ex.reps, ex.weight, ex.rest]
            );
        }

        res.json({ success: true, id: newId });

    } catch (err) {
        console.error("❌ COPY WORKOUT ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
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

app.post("/workouts", async (req, res) => {
    try {
        const userId = req.body.userId || req.body.user_id;
        const name = req.body.name;
        const isRecommended = req.body.isRecommended === true || req.body.isRecommended === "true";

        if (!userId || !name) {
            return res.status(400).json({ success: false, error: "userId or name missing" });
        }

        const result = await pool.query(
            `INSERT INTO workouts(user_id, name, created_at, is_recommended)
             VALUES ($1, $2, NOW(), $3)
             RETURNING workoutid`,
            [userId, name, isRecommended]
        );

        res.json({ success: true, id: result.rows[0].workoutid });

    } catch (err) {
        console.error("❌ WORKOUT ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
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
        // 🔥 ИСПРАВЛЕНО: добавляем instruction
        const result = await pool.query(
            "SELECT exerciseid AS id, name, instruction, muscle_group, difficulty FROM exercises WHERE exerciseid=$1", 
            [req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Get exercise by ID error:", err);
        res.status(500).send("Error");
    }
});

app.put("/exercises/:id", async (req, res) => {
    try {

        const {
            name,
            muscle_group,
            difficulty,
            instruction,
            video_url
        } = req.body;

        await pool.query(
            `
            UPDATE exercises
            SET
                name = $1,
                muscle_group = $2,
                difficulty = $3,
                instruction = $4,
                video_url = $5
            WHERE exerciseid = $6
            `,
            [
                name,
                muscle_group,
                difficulty,
                instruction,
                video_url,
                req.params.id
            ]
        );

        res.json({ success: true });

    } catch (err) {

        console.error("❌ UPDATE EXERCISE ERROR:", err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});
app.delete("/workouts/:id/exercises", async (req, res) => {
    try {
        await pool.query(
            "DELETE FROM workoutexercises WHERE workout_id=$1",
            [req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("❌ DELETE WORKOUT EXERCISES ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /workout-history — сохранить результат
app.post("/workout-history", async (req, res) => {
    try {
        const { userId, workoutId, workoutName, completedAt,
                totalExercises, completedExercises, isFullyDone } = req.body;

        const result = await pool.query(
            `INSERT INTO workout_history
             (user_id, workout_id, workout_name, completed_at,
              total_exercises, completed_exercises, is_fully_done)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [userId, workoutId, workoutName, completedAt,
             totalExercises, completedExercises, isFullyDone]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /workout-history/:userId - получить историю с фильтрацией по дате
app.get("/workout-history/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        let query = `SELECT 
                        id,
                        user_id as "userId",
                        workout_id as "workoutId", 
                        workout_name as "workoutName",
                        completed_at as "completedAt",
                        total_exercises as "totalExercises", 
                        completed_exercises as "completedExercises", 
                        is_fully_done as "isFullyDone"
                     FROM workout_history 
                     WHERE user_id = $1`;
        let params = [userId];
        
        // Добавляем фильтрацию по дате если параметры переданы
        if (startDate && endDate) {
            query += ` AND completed_at >= $2 AND completed_at < $3`;
            params.push(startDate, endDate);
        }
        
        query += ` ORDER BY completed_at DESC`;
        
        const result = await pool.query(query, params);
        
        console.log("📊 Returning history records:", result.rows.length);
        console.log("First record:", result.rows[0]);
        
        res.json(result.rows);
    } catch (err) {
        console.error("GET workout-history ERROR:", err);
        res.status(500).json([]);
    }
});

console.log("✅ EXERCISES POST ROUTE LOADED");

// server.js - обновите POST /exercises
app.post("/exercises", async (req, res) => {
    try {
        console.log("🔥 BODY:", req.body);

        const { workoutId, exerciseId, name, sets, reps, weight, rest } = req.body;

        if (!workoutId || !name) {
            return res.status(400).json({
                success: false,
                error: "workoutId or name missing"
            });
        }

        let finalExerciseId = exerciseId ? Number(exerciseId) : null;

        if (!finalExerciseId) {
            const existing = await pool.query(
                `SELECT exerciseid FROM exercises WHERE LOWER(name) = LOWER($1) LIMIT 1`,
                [name]
            );

            if (existing.rows.length > 0) {
                finalExerciseId = existing.rows[0].exerciseid;
            } else {
                const inserted = await pool.query(
                    `INSERT INTO exercises(name, muscle_group, difficulty)
                     VALUES($1, '-', '-') RETURNING exerciseid`,
                    [name]
                );
                finalExerciseId = inserted.rows[0].exerciseid;
            }
        }

        await pool.query(
            `INSERT INTO workoutexercises(workout_id, exercise_id, sets, reps, weight, rest)
             VALUES($1, $2, $3, $4, $5, $6)`,
            [workoutId, finalExerciseId, sets || 0, reps || 0, weight || 0, rest || 90]  // ← rest или 90 по умолчанию
        );

        res.json({ success: true });

    } catch (err) {
        console.error("❌ EXERCISE ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
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
            // Проверяем существует ли упражнение
            let exId = ex.exerciseid;
            
            if (!exId) {
                const exRes = await pool.query(
                    `INSERT INTO exercises(name, muscle_group, difficulty)
                     VALUES($1,$2,$3)
                     RETURNING exerciseid`,
                    [ex.name, ex.muscle_group || '-', ex.difficulty || 'med']
                );
                exId = exRes.rows[0].exerciseid;
            }

            // Добавляем в тренировку
            await pool.query(
                `INSERT INTO workoutexercises
                (workout_id, exercise_id, sets, reps, weight, rest)
                VALUES ($1,$2,$3,$4,$5,$6)`,
                [
                    workoutId,
                    exId,
                    ex.sets || 0,
                    ex.reps || 0,
                    ex.weight || 0,
                    ex.rest || 0
                ]
            );

            // === НОВАЯ ЛОГИКА: создаем запись в exerciseprogress если вес > 0 ===
            if (ex.weight > 0) {
                // Проверяем, есть ли уже замеры для этого упражнения у пользователя
                const existingProgress = await pool.query(
                    `SELECT progressid 
                     FROM exerciseprogress 
                     WHERE user_id = $1 AND exercise_id = $2 
                     LIMIT 1`,
                    [userId, exId]
                );

                // Если замеров нет - создаем первый замер с пометкой "Начальный"
                if (existingProgress.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO exerciseprogress 
                         (user_id, exercise_id, workout_id, progress_date, weight, reps, sets_count, notes)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            userId, 
                            exId, 
                            workoutId, 
                            Date.now(), 
                            ex.weight, 
                            ex.reps || 0, 
                            ex.sets || 0, 
                            '🏁 Начальный вес (зафиксирован)'
                        ]
                    );
                    console.log("✅ Created initial weight entry for exercise:", ex.name);
                }
            }
        }

        res.json({ success: true, workoutId });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
});



app.delete("/workouts/:id", async (req, res) => {
    try {

        const id = req.params.id;

        console.log("🔥 DELETE WORKOUT:", id);

        // удаляем календарь
        await pool.query(
            "DELETE FROM calendarworkouts WHERE workout_id=$1",
            [id]
        );

        console.log("✅ calendarworkouts deleted");

        // удаляем упражнения тренировки
        await pool.query(
            "DELETE FROM workoutexercises WHERE workout_id=$1",
            [id]
        );

        console.log("✅ workoutexercises deleted");

        // удаляем тренировку
        const deleted = await pool.query(
            "DELETE FROM workouts WHERE workoutid=$1 RETURNING *",
            [id]
        );

        console.log("✅ workout deleted:", deleted.rows);

        res.json({ success: true });

    } catch (err) {

        console.error("❌ DELETE WORKOUT ERROR:");
        console.error(err);
        console.error(err.message);
        console.error(err.stack);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.post("/calendar", async (req, res) => {
    try {
        const { userId, workoutId, scheduledDate } = req.body;
        await pool.query(
            `INSERT INTO calendarworkouts(user_id, workout_id, scheduled_date)
             VALUES($1, $2, $3)`,
            [userId, workoutId, scheduledDate]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});
// GET /progress/exercise/initial/:userId - получить начальный вес упражнения
app.get("/progress/exercise/initial/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { exerciseId } = req.query;

        if (!exerciseId) {
            return res.json({ initialWeight: null });
        }

        // ищем сначала по id, потом по имени
        let exId = Number(exerciseId);
        if (isNaN(exId)) {
            const exRes = await pool.query(
                "SELECT exerciseid FROM exercises WHERE LOWER(name)=LOWER($1) LIMIT 1",
                [exerciseId]
            );
            if (!exRes.rows.length) {
                return res.json({ initialWeight: null });
            }
            exId = exRes.rows[0].exerciseid;
        }

        // Получаем самый первый замер веса для этого упражнения
        const result = await pool.query(
            `SELECT weight, progress_date, notes
             FROM exerciseprogress 
             WHERE user_id = $1 AND exercise_id = $2 
             ORDER BY progress_date ASC, progressid ASC 
             LIMIT 1`,
            [userId, exId]
        );

        if (result.rows.length) {
            return res.json({ 
                initialWeight: result.rows[0].weight,
                progressDate: result.rows[0].progress_date,
                notes: result.rows[0].notes
            });
        }

        res.json({ initialWeight: null });

    } catch (err) {
        console.error("GET initial weight error:", err);
        res.status(500).json({ initialWeight: null });
    }
});

// POST /progress/exercise - сохранить прогресс упражнения
app.post("/progress/exercise", async (req, res) => {
    try {
        const { userId, exerciseId, workoutId, weight, reps, sets, notes } = req.body;

        if (!userId || !exerciseId) {
            return res.status(400).json({ 
                success: false, 
                error: "userId or exerciseId missing" 
            });
        }

        // Проверяем, существует ли уже первый замер для этого упражнения
        const existingFirst = await pool.query(
            `SELECT progressid, weight, notes
             FROM exerciseprogress 
             WHERE user_id = $1 AND exercise_id = $2 
             ORDER BY progress_date ASC, progressid ASC 
             LIMIT 1`,
            [userId, exerciseId]
        );

        let isFirstEntry = existingFirst.rows.length === 0;
        let finalNotes = notes || '';

        // Если это первый замер - отмечаем его как начальный
        if (isFirstEntry) {
            finalNotes = '🏁 Начальный вес (зафиксирован)';
        }

        const result = await pool.query(
            `INSERT INTO exerciseprogress 
             (user_id, exercise_id, workout_id, progress_date, weight, reps, sets_count, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING progressid`,
            [
                userId, 
                exerciseId, 
                workoutId || null, 
                Date.now(), 
                weight || 0, 
                reps || 0, 
                sets || 0, 
                finalNotes
            ]
        );

        res.json({ 
            success: true, 
            id: result.rows[0].progressid,
            isFirstEntry: isFirstEntry,
            notes: finalNotes
        });

    } catch (err) {
        console.error("POST progress/exercise ERROR:", err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// DELETE /progress/exercise/initial - сбросить начальный вес (только для админа)
app.delete("/progress/exercise/initial", async (req, res) => {
    try {
        const { userId, exerciseId } = req.body;

        if (!userId || !exerciseId) {
            return res.status(400).json({ 
                success: false, 
                error: "userId or exerciseId missing" 
            });
        }

        // Находим первый замер
        const firstEntry = await pool.query(
            `SELECT progressid 
             FROM exerciseprogress 
             WHERE user_id = $1 AND exercise_id = $2 
             ORDER BY progress_date ASC, progressid ASC 
             LIMIT 1`,
            [userId, exerciseId]
        );

        if (firstEntry.rows.length === 0) {
            return res.json({ success: true, message: "No initial weight found" });
        }

        // Удаляем только первый замер
        await pool.query(
            "DELETE FROM exerciseprogress WHERE progressid = $1",
            [firstEntry.rows[0].progressid]
        );

        res.json({ success: true });

    } catch (err) {
        console.error("DELETE initial weight error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------- WORKOUT EXERCISES --------------------

app.get("/workout-exercises/:workoutId", async (req, res) => {
    try {

        console.log("🔥 GET EXERCISES FOR WORKOUT:");
        console.log(req.params.workoutId);

        const result = await pool.query(
            `
            SELECT
                e.exerciseid AS "exerciseId",
                e.name AS "name",
                we.sets AS "sets",
                we.reps AS "reps",
                we.weight AS "weight",
                we.rest AS "rest"
            FROM workoutexercises we
            JOIN exercises e
                ON e.exerciseid = we.exercise_id
            WHERE we.workout_id = $1
            `,
            [req.params.workoutId]
        );

        console.log("🔥 RESULT:");
        console.log(result.rows);

        res.json(result.rows);

    } catch (err) {
        console.error("GET workout-exercises ERROR:", err);
        res.status(500).send("Error");
    }
});

app.post("/workout-exercises", async (req, res) => {
    try {

        console.log("🔥 WORKOUT EXERCISE BODY:", req.body);

       const { workoutId, exerciseId, sets, reps, weight, rest } = req.body;

        console.log("🔥 VALUES:", {
            workoutId,
            exerciseId,
            sets,
            reps,
            weight,
            rest
        });

        // Добавляем упражнение в тренировку
       const result = await pool.query(
            `INSERT INTO workoutexercises(
                workout_id, exercise_id, sets, reps, weight, rest
            ) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
            [workoutId, exerciseId, sets || 0, reps || 0, weight || 0, rest || 90]  // ← rest
        );


        console.log("✅ INSERTED:", result.rows[0]);

        // === НОВАЯ ЛОГИКА: создаем запись в exerciseprogress если вес > 0 ===
        if (weight > 0) {
            // Получаем user_id из тренировки
            const workoutRes = await pool.query(
                "SELECT user_id FROM workouts WHERE workoutid = $1",
                [workoutId]
            );

            if (workoutRes.rows.length > 0) {
                const userId = workoutRes.rows[0].user_id;

                // Проверяем, есть ли уже замеры для этого упражнения у пользователя
                const existingProgress = await pool.query(
                    `SELECT progressid 
                     FROM exerciseprogress 
                     WHERE user_id = $1 AND exercise_id = $2 
                     LIMIT 1`,
                    [userId, exerciseId]
                );

                // Если замеров нет - создаем первый замер с пометкой "Начальный"
                if (existingProgress.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO exerciseprogress 
                         (user_id, exercise_id, workout_id, progress_date, weight, reps, sets_count, notes)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            userId, 
                            exerciseId, 
                            workoutId, 
                            Date.now(), 
                            weight, 
                            reps || 0, 
                            sets || 0, 
                            '🏁 Начальный вес (зафиксирован)'
                        ]
                    );
                    console.log("✅ Created initial weight entry for exercise:", exerciseId);
                } else {
                    console.log("ℹ️ Exercise already has progress entries, skipping initial creation");
                }
            }
        }

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