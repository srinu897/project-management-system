const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// MySQL Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

(async () => {
    try {

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                password VARCHAR(255) NOT NULL,
                otp VARCHAR(6),
                otpExpires BIGINT
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                status VARCHAR(20) NOT NULL
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                task_name VARCHAR(255) NOT NULL,
                assigned_to VARCHAR(255) NOT NULL,
                status VARCHAR(30) DEFAULT 'Pending'
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS files (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                filepath VARCHAR(255) NOT NULL
            );
        `);

        console.log("✅ All tables created successfully");

    } catch (err) {

        console.error("Table Creation Error:", err);

    }
})();

// Serve HTML Pages
app.get("/", (req, res) => res.redirect("/signup"));
app.get("/signup", (req, res) => res.sendFile(path.join(__dirname, "public", "signup.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/project_dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "project_dashboard.html")));
app.get("/task.html", (req, res) => res.sendFile(path.join(__dirname, "public", "task.html")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/about", (req, res) => res.sendFile(path.join(__dirname, "public", "about.html")));

// ✅ SIGNUP
app.post("/signup", async (req, res) => {
    try {
        const { username, email, phone, password } = req.body;

        if (!username || !email || !phone || !password) {
            return res.status(400).json({
                message: "❌ All fields are required!"
            });
        }

        await pool.query(
            "INSERT INTO users (username, email, phone, password) VALUES ($1,$2,$3,$4)",
            [username, email, phone, password]
        );

        res.redirect("/login");

    } catch (err) {

    console.error("Signup Error:", err);

    if (err.code === "23505") {
        return res.status(400).json({
            message: "Email already exists!"
        });
    }

    res.status(500).json({
        message: "Error signing up."
    });

}
});

// ✅ LOGIN
app.post("/login", async (req, res) => {

    try {

        const { email, pswd } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (
            result.rows.length > 0 &&
            pswd === result.rows[0].password
        ) {

            return res.redirect("/project_dashboard");

        }

        res.status(401).send(
            "<script>alert('Invalid email or password!'); window.location.href='/login';</script>"
        );

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Login Error"
        });

    }

});

// ✅ GET ALL PROJECTS
app.get("/projects", async (req, res) => {

    try {

        const result =
            await pool.query(
                "SELECT * FROM projects"
            );

        res.json(result.rows);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Error fetching projects"
        });

    }

});

// ✅ ADD NEW PROJECT
app.post("/projects", async (req, res) => {

    try {

        const { name, description, status } = req.body;

        await pool.query(
            "INSERT INTO projects(name,description,status) VALUES($1,$2,$3)",
            [name, description, status]
        );

        res.json({
            message: "Project added successfully"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Failed to add project"
        });

    }

});

// ✅ DELETE PROJECT
app.delete("/projects/:id", async (req, res) => {

    try {

        await pool.query(
            "DELETE FROM projects WHERE id=$1",
            [req.params.id]
        );

        res.json({
            message: "Project deleted successfully"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Delete Error"
        });

    }

});

// ✅ FETCH ALL TASKS
// ✅ FETCH ALL TASKS
app.get("/tasks", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM tasks ORDER BY id DESC"
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: "Error fetching tasks"
        });
    }
});

// ✅ ADD A NEW TASK
app.post("/tasks", async (req, res) => {

    try {

        const { task_name, assigned_to, status } = req.body;

        if (!task_name || !assigned_to) {
            return res.status(400).json({
                error: "Task Name and Assigned To are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO tasks
            (task_name, assigned_to, status)
            VALUES ($1,$2,$3)
            RETURNING id`,
            [task_name, assigned_to, status]
        );

        res.json({
            id: result.rows[0].id,
            task_name,
            assigned_to,
            status
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Error adding task"
        });

    }
});

// ✅ DELETE TASK
app.delete("/tasks/:id", async (req, res) => {

    try {

        await pool.query(
            "DELETE FROM tasks WHERE id=$1",
            [req.params.id]
        );

        res.json({
            message: "Task deleted successfully"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Error deleting task"
        });

    }
});


// ===============================
// FILE UPLOAD CONFIGURATION
// ===============================

// Create uploads folder automatically

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {

fs.mkdirSync(uploadDir, {
    recursive: true
});

console.log("✅ uploads folder created");

}

// Multer Storage

const storage = multer.diskStorage({

destination: (req, file, cb) => {

    cb(null, uploadDir);

},

filename: (req, file, cb) => {

    const uniqueName =
        Date.now() +
        "-" +
        file.originalname;

    cb(null, uniqueName);

}

});

// File Filter

const fileFilter = (req, file, cb) => {

const allowedTypes = [

    "application/pdf",

    "application/msword",

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

];

if (allowedTypes.includes(file.mimetype)) {

    cb(null, true);

} else {

    cb(
        new Error(
            "Only PDF, DOC and DOCX files are allowed"
        ),
        false
    );

}

};

const upload = multer({

storage,

fileFilter,

limits: {

    fileSize:
    10 * 1024 * 1024 // 10 MB

}

});

// ===============================
// UPLOAD FILE
// ===============================

app.post(
    "/upload",
    upload.single("file"),
    async (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No file uploaded"
                });
            }

            const filename = req.file.originalname;
            const filepath = `uploads/${req.file.filename}`;

            const result = await pool.query(
                `INSERT INTO files
                (filename, filepath)
                VALUES ($1,$2)
                RETURNING id`,
                [filename, filepath]
            );

            res.json({
                success: true,
                message: "File uploaded successfully",
                fileId: result.rows[0].id
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                success: false,
                message: "Database error"
            });

        }

    }
);
// ===============================
// GET FILES
// ===============================

app.get("/files", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT * FROM files ORDER BY id DESC"
        );

        res.json(result.rows);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Database error"
        });

    }

});

// ===============================
// DELETE FILE
// ===============================

app.delete("/delete/:id", async (req, res) => {

    try {

        const result = await pool.query(
            "SELECT * FROM files WHERE id=$1",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        const filePath = path.join(
            __dirname,
            result.rows[0].filepath
        );

        await pool.query(
            "DELETE FROM files WHERE id=$1",
            [req.params.id]
        );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({
            message: "File deleted successfully"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Database error"
        });

    }

});

// ===============================
// STATIC FILE ACCESS
// ===============================

app.use(
"/uploads",
express.static(uploadDir)
);
// Start Server
const PORT = process.env.PORT || 8089;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
