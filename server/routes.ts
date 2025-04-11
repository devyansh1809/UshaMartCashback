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
      
      // Enhance purchases with coupon information
      const enhancedPurchases = purchases.map(purchase => {
        // Find coupon for this purchase
        const coupon = Array.from(storage.coupons.values())
          .find(c => c.purchaseId === purchase.id);
          
        if (coupon) {
          return {
            ...purchase,
            couponCode: coupon.couponCode
          };
        }
        return purchase;
      });
      
      res.json(enhancedPurchases);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/api/purchases/:id/verify", async (req, res) => {
    if (!req.user?.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const purchaseId = parseInt(req.params.id);
      const purchase = await storage.verifyPurchase(purchaseId);

      // Use the provided cashback amount from the request, or calculate default (4%)
      const cashbackAmount = req.body.cashbackAmount || Number(purchase.billAmount) * 0.04;
      
      // Check if a coupon already exists for this purchase
      const existingCoupon = Array.from(storage.coupons.values()).find(
        coupon => coupon.purchaseId === purchaseId
      );
      
      let coupon;
      if (existingCoupon) {
        // Update the existing coupon amount
        coupon = await storage.updateCashbackCouponAmount(existingCoupon.id, cashbackAmount);
      } else {
        // Create a new coupon
        coupon = await storage.createCashbackCoupon(purchase.id, cashbackAmount);
      }

      res.json(coupon);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Add a new endpoint to get all coupons (for admin)
  app.get("/api/admin/coupons", async (req, res) => {
    if (!req.user?.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const purchases = await storage.getAllPurchases();
      const verifiedPurchases = purchases.filter(p => p.verificationStatus === 'verified');
      
      // Get coupon information for each verified purchase
      const result = [];
      for (const purchase of verifiedPurchases) {
        const coupons = Array.from(storage.coupons.values())
          .filter(coupon => coupon.purchaseId === purchase.id);
          
        if (coupons.length > 0) {
          // Add coupon code to purchase object
          result.push({
            ...purchase,
            couponCode: coupons[0].couponCode
          });
        }
      }
      
      res.json(result);
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

  // Add endpoint to redeem a coupon
  app.post("/api/coupons/:purchaseId/redeem", async (req, res) => {
    if (!req.user?.isAdmin) {
      return res.status(403).send("Admin access required");
    }

    try {
      const purchaseId = parseInt(req.params.purchaseId);
      
      // Find the purchase
      const purchase = await storage.getPurchaseById(purchaseId);
      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }
      
      // Find the coupon for this purchase
      const coupon = Array.from(storage.coupons.values()).find(
        c => c.purchaseId === purchaseId
      );
      
      if (!coupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }
      
      // Mark the coupon as redeemed and update its status
      const redeemedCoupon = await storage.updateCashbackCouponAmount(coupon.id, coupon.amount);
      redeemedCoupon.status = 'redeemed';
      
      // Add notification for the user
      const user = storage.users.get(purchase.userId);
      if (user) {
        // If you have a notifications system, you would add to it here
        // For now, just ensure the status is updated
        storage.coupons.set(coupon.id, redeemedCoupon);
      }
      
      // Return the redeemed coupon with purchase info
      res.json({
        ...redeemedCoupon,
        billNumber: purchase.billNumber
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}