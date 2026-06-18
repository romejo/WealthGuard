import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "50mb" })); // Increase limit for larger structures

// --- Zero-Knowledge Encrypted Backups Server Endpoints ---
const BACKUPS_DIR = path.join(process.cwd(), "backups");
const BACKUP_FILE_PATH = path.join(BACKUPS_DIR, "backup.json");

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// POST: Save encrypted backup
app.post("/api/backups", (req, res) => {
  try {
    const { encryptedData, timestamp, accountsCount } = req.body;
    if (!encryptedData || !timestamp) {
      return res.status(400).json({ error: "Missing required backup fields" });
    }

    const safeTimestamp = String(timestamp).replace(/[^0-9]/g, "");

    fs.writeFileSync(
      BACKUP_FILE_PATH,
      JSON.stringify({ encryptedData, timestamp: safeTimestamp, accountsCount }, null, 2),
      "utf8"
    );

    res.json({ success: true, fileName: "backup.json" });
  } catch (error) {
    console.error("Backup save error:", error);
    res.status(500).json({ error: "Failed to save backup on server" });
  }
});

// GET: Retrieve list of backups
app.get("/api/backups", (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_FILE_PATH)) {
      return res.json({ backups: [] });
    }

    const dataStr = fs.readFileSync(BACKUP_FILE_PATH, "utf8");
    let parsed: any = {};
    try {
      parsed = JSON.parse(dataStr);
    } catch (e) {
      return res.json({ backups: [] });
    }

    // 만약 파일은 있지만 encryptedData가 없는 더미 상태라면 목록 없음으로 간주
    if (!parsed.encryptedData) {
      return res.json({ backups: [] });
    }

    res.json({
      backups: [
        {
          fileName: "backup.json",
          timestamp: parsed.timestamp || "0",
          accountsCount: parsed.accountsCount || 0,
          size: dataStr.length
        }
      ]
    });
  } catch (error) {
    console.error("List backups error:", error);
    res.status(500).json({ error: "Failed to read backups list" });
  }
});

// GET: Retrieve a specific backup
app.get("/api/backups/:filename", (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_FILE_PATH)) {
      return res.status(404).json({ error: "Backup file not found" });
    }

    const dataStr = fs.readFileSync(BACKUP_FILE_PATH, "utf8");
    res.setHeader("Content-Type", "application/json");
    res.send(dataStr);
  } catch (error) {
    console.error("Get backup error:", error);
    res.status(500).json({ error: "Failed to read backup file" });
  }
});

// DELETE: Delete a backup
app.delete("/api/backups/:filename", (req, res) => {
  try {
    if (fs.existsSync(BACKUP_FILE_PATH)) {
      // 안전 소멸을 위해 파일을 완벽히 리셋하거나 언링크합니다.
      fs.writeFileSync(
        BACKUP_FILE_PATH,
        JSON.stringify({ encryptedData: "", timestamp: "0", accountsCount: 0 }, null, 2),
        "utf8"
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Delete backup error:", error);
    res.status(500).json({ error: "Failed to delete backup file" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
