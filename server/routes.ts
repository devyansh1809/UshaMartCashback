import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertPurchaseSchema } from "@shared/schema";

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

  // Cashback related routes
  app.post("/api/purchases", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Authentication required");
    }

    try {
      const purchaseData = insertPurchaseSchema.parse({
        ...req.body,
        purchaseDate: new Date(req.body.purchaseDate),
      });

      const purchase = await storage.createPurchase(req.user.id, purchaseData);
      res.status(201).json(purchase);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/api/purchases", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Authentication required");
    }

    try {
      let purchases;
      if (req.user.isAdmin) {
        // Admin sees all purchases
        purchases = await storage.getAllPurchases();
      } else {
        // Regular users only see their own purchases
        purchases = await storage.getUserPurchases(req.user.id);
      }
      res.json(purchases);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/api/purchases/:id/verify", async (req, res) => {
    if (!req.user?.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const purchase = await storage.verifyPurchase(parseInt(req.params.id));

      // Calculate cashback (10% of bill amount for this example)
      const cashbackAmount = Number(purchase.billAmount) * 0.1;
      const coupon = await storage.createCashbackCoupon(purchase.id, cashbackAmount);

      res.json(coupon);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/api/coupons", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Authentication required");
    }

    const coupons = await storage.getCashbackCouponsByUser(req.user.id);
    res.json(coupons);
  });

  const httpServer = createServer(app);
  return httpServer;
}