import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/users", async (req, res) => {
    if (!req.user?.isAdmin) {
      return res.status(403).send("Admin access required");
    }
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get("/api/stats", async (req, res) => {
    if (!req.user?.isAdmin) {
      return res.status(403).send("Admin access required");
    }
    const userCount = await storage.getUserCount();
    res.json({ userCount });
  });

  const httpServer = createServer(app);
  return httpServer;
}
