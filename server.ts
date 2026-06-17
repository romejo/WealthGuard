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

    // Clean timestamp for file system checks
    const safeTimestamp = String(timestamp).replace(/[^0-9]/g, ""); // extract clean numeric timestamp
    const tsNum = Number(safeTimestamp);
    if (isNaN(tsNum)) {
      return res.status(400).json({ error: "Invalid timestamp format" });
    }

    // 한국 시간(UTC+9) 기준으로 YYYY-MM-DD 날짜 추출
    const d = new Date(tsNum + (9 * 60 * 60 * 1000));
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const fileName = `backup_${dateStr}.json`;
    const filePath = path.join(BACKUPS_DIR, fileName);

    fs.writeFileSync(
      filePath,
      JSON.stringify({ encryptedData, timestamp: safeTimestamp, accountsCount }, null, 2),
      "utf8"
    );

    // Prune old backups (Keep only the latest 5 days/files)
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(file => file.startsWith("backup_") && file.endsWith(".json"))
      .map(file => {
        return {
          file,
          dateKey: file.replace("backup_", "").replace(".json", "")
        };
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    if (files.length > 5) {
      const filesToDelete = files.slice(5);
      for (const f of filesToDelete) {
        fs.unlinkSync(path.join(BACKUPS_DIR, f.file));
      }
    }

    res.json({ success: true, fileName });
  } catch (error) {
    console.error("Backup save error:", error);
    res.status(500).json({ error: "Failed to save backup on server" });
  }
});

// GET: Retrieve list of backups
app.get("/api/backups", (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(file => file.startsWith("backup_") && file.endsWith(".json"));

    const backups = files.map(file => {
      try {
        const dataStr = fs.readFileSync(path.join(BACKUPS_DIR, file), "utf8");
        const parsed = JSON.parse(dataStr);
        return {
          fileName: file,
          timestamp: parsed.timestamp,
          accountsCount: parsed.accountsCount || 0,
          size: dataStr.length
        };
      } catch (err) {
        return null;
      }
    }).filter(b => b !== null) as any[];

    // Sort backups descending
    backups.sort((a, b) => b.fileName.localeCompare(a.fileName));

    res.json({ backups });
  } catch (error) {
    console.error("List backups error:", error);
    res.status(500).json({ error: "Failed to read backups list" });
  }
});

// GET: Retrieve a specific backup
app.get("/api/backups/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(BACKUPS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Backup file not found" });
    }

    const dataStr = fs.readFileSync(filePath, "utf8");
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
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(BACKUPS_DIR, safeName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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
