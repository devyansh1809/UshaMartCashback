import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  billNumber: text("bill_number").notNull().unique(),
  billAmount: decimal("bill_amount").notNull(),
  purchaseDate: timestamp("purchase_date").notNull(),
  verificationStatus: text("verification_status").notNull().default('pending'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cashbackCoupons = pgTable("cashback_coupons", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull().references(() => purchases.id).unique(),
  couponCode: text("coupon_code").notNull().unique(),
  amount: decimal("amount").notNull(),
  status: text("status").notNull().default('active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    password: true,
    name: true,
    address: true,
    phone: true,
  })
  .extend({
    phone: z.string().min(10).max(10),
  });

export const insertPurchaseSchema = createInsertSchema(purchases)
  .pick({
    billNumber: true,
    billAmount: true,
    purchaseDate: true,
  })
  .extend({
    billNumber: z.string().min(1, "Bill number is required"),
    billAmount: z.number().positive("Amount must be positive"),
    purchaseDate: z.date(),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type CashbackCoupon = typeof cashbackCoupons.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;