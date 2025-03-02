const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const db = require("./install");

const app = express();
const port = 3000;
const SECRET_KEY = "hemlignyckel"; 

app.use(cors());
app.use(express.json());

// Startsidan
app.get("/", (req, res) => {
    res.send("Välkommen till API't");
});

// Registrera användare
app.post("/register", async (req, res) => {
    const { firstname, lastname, email, username, password } = req.body;

    if (!firstname || !lastname || !email || !username || !password) {
        return res.status(400).json({ message: "Alla fält måste fyllas i" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            "INSERT INTO users (firstname, lastname, email, username, password) VALUES (?, ?, ?, ?, ?)",
            [firstname, lastname, email, username, hashedPassword],
            function (err) {
                if (err) {
                    return res.status(400).json({ message: "Användaren kunde inte skapas" });
                }
                res.status(201).json({ message: "Användare skapad!" });
            }
        );
    } catch (err) {
        res.status(500).json({ message: "Serverfel" });
    }
});

// Inloggning
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ message: "Fel användarnamn eller lösenord" });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(400).json({ message: "Fel användarnamn eller lösenord" });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, SECRET_KEY, { expiresIn: "1h" });
        res.json({ token, message: "Inloggning lyckades" });
    });
});

// Middleware: Verifiera JWT
const authenticateToken = (req, res, next) => {
    const token = req.headers["authorization"];
    if (!token) {
        return res.status(401).json({ message: "Ingen token tillhandahölls" });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Ogiltig token" });
        }
        req.user = decoded;
        next();
    });
};

// Hämta alla användare (utan att vara inloggad)
app.get("/users", (req, res) => {
    db.all("SELECT id, firstname, lastname, email, username, created_at FROM users", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: "Serverfel" });
        }
        res.json(rows);
    });
});

// Hämta alla blogginlägg 
app.get("/posts", (req, res) => {
    db.all("SELECT * FROM posts", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: "Serverfel" });
        }
        res.json(rows);
    });
});

// Hämta ett specifikt blogginlägg 
app.get("/posts/:id", (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM posts WHERE id = ?", [id], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ message: "Inlägg hittades inte" });
        }
        res.json(row);
    });
});

// Skapa ett nytt blogginlägg
app.post("/posts", authenticateToken, (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ message: "Titel och innehåll krävs" });
    }

    db.run("INSERT INTO posts (title, content, userId) VALUES (?, ?, ?)", [title, content, req.user.userId], function (err) {
        if (err) {
            return res.status(500).json({ message: "Kunde inte skapa inlägg" });
        }
        res.status(201).json({ message: "Inlägg skapat", postId: this.lastID });
    });
});

// Uppdatera ett blogginlägg 
app.put("/posts/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;

    db.run("UPDATE posts SET title = ?, content = ? WHERE id = ? AND userId = ?", [title, content, id, req.user.userId], function (err) {
        if (err || this.changes === 0) {
            return res.status(400).json({ message: "Kunde inte uppdatera inlägg" });
        }
        res.json({ message: "Inlägg uppdaterat" });
    });
});

// Ta bort ett blogginlägg 
app.delete("/posts/:id", authenticateToken, (req, res) => {
    const { id } = req.params;

    db.run("DELETE FROM posts WHERE id = ? AND userId = ?", [id, req.user.userId], function (err) {
        if (err || this.changes === 0) {
            return res.status(400).json({ message: "Kunde inte ta bort inlägg" });
        }
        res.json({ message: "Inlägg raderat" });
    });
});

//Starta servern
app.listen(port, () => {
    console.log(`Servern är igång på http://localhost:${port}`);
});
