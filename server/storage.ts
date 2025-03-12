import { users, purchases, cashbackCoupons, type User, type InsertUser, type Purchase, type InsertPurchase, type CashbackCoupon } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const MemoryStore = createMemoryStore(session);
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

function generateCouponCode(): string {
  // Generate an 8-byte (16 character) hexadecimal code
  const bytes = randomBytes(8);
  return bytes.toString('hex').toUpperCase();
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUserCount(): Promise<number>;
  sessionStore: session.Store;

  // Purchase and Cashback methods
  createPurchase(userId: number, purchase: InsertPurchase): Promise<Purchase>;
  getPurchaseByBillNumber(billNumber: string): Promise<Purchase | undefined>;
  getUserPurchases(userId: number): Promise<Purchase[]>;
  getAllPurchases(): Promise<Purchase[]>;  // New method for admin
  verifyPurchase(purchaseId: number): Promise<Purchase>;
  createCashbackCoupon(purchaseId: number, amount: number): Promise<CashbackCoupon>;
  getCashbackCouponsByUser(userId: number): Promise<CashbackCoupon[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private purchases: Map<number, Purchase>;
  coupons: Map<number, CashbackCoupon>; // Changed to public for direct access
  currentId: number;
  currentPurchaseId: number;
  currentCouponId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.purchases = new Map();
    this.coupons = new Map();
    this.currentId = 1;
    this.currentPurchaseId = 1;
    this.currentCouponId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });

    // Create default admin user with properly hashed password
    this.initAdminUser();
  }

  private async initAdminUser() {
    const adminUser = {
      username: "admin",
      password: await hashPassword("admin123"),
      name: "Admin User",
      address: "Admin Address",
      phone: "1234567890",
      isAdmin: true,
    };

    await this.createUser(adminUser as any);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id, isAdmin: insertUser.isAdmin ?? false };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async createPurchase(userId: number, purchase: InsertPurchase): Promise<Purchase> {
    const existingPurchase = await this.getPurchaseByBillNumber(purchase.billNumber);
    if (existingPurchase) {
      throw new Error("Bill number already exists");
    }

    const id = this.currentPurchaseId++;
    const newPurchase: Purchase = {
      id,
      userId,
      billNumber: purchase.billNumber,
      billAmount: purchase.billAmount.toString(), // Convert to string for storage
      purchaseDate: purchase.purchaseDate,
      verificationStatus: 'pending',
      createdAt: new Date(),
    };

    this.purchases.set(id, newPurchase);
    return newPurchase;
  }

  async getPurchaseByBillNumber(billNumber: string): Promise<Purchase | undefined> {
    return Array.from(this.purchases.values()).find(
      (purchase) => purchase.billNumber === billNumber
    );
  }

  async getUserPurchases(userId: number): Promise<Purchase[]> {
    return Array.from(this.purchases.values()).filter(
      (purchase) => purchase.userId === userId
    );
  }

  async getAllPurchases(): Promise<Purchase[]> {
    return Array.from(this.purchases.values());
  }

  async verifyPurchase(purchaseId: number): Promise<Purchase> {
    const purchase = this.purchases.get(purchaseId);
    if (!purchase) {
      throw new Error("Purchase not found");
    }

    const verifiedPurchase = {
      ...purchase,
      verificationStatus: 'verified'
    };

    this.purchases.set(purchaseId, verifiedPurchase);
    return verifiedPurchase;
  }

  async createCashbackCoupon(purchaseId: number, amount: number): Promise<CashbackCoupon> {
    const purchase = this.purchases.get(purchaseId);
    if (!purchase) {
      throw new Error("Purchase not found");
    }

    // Check if a coupon already exists for this purchase
    const existingCoupon = Array.from(this.coupons.values()).find(
      (coupon) => coupon.purchaseId === purchaseId
    );
    if (existingCoupon) {
      // Instead of failing, update and return the existing coupon
      return this.updateCashbackCouponAmount(existingCoupon.id, amount);
    }

    const id = this.currentCouponId++;
    const coupon: CashbackCoupon = {
      id,
      purchaseId,
      couponCode: generateCouponCode(),
      amount: amount.toString(), // Convert to string for storage
      status: 'active',
      createdAt: new Date(),
    };

    this.coupons.set(id, coupon);
    return coupon;
  }
  
  async updateCashbackCouponAmount(couponId: number, newAmount: number): Promise<CashbackCoupon> {
    const coupon = this.coupons.get(couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }
    
    // Update only the amount, preserve the same coupon code
    const updatedCoupon: CashbackCoupon = {
      ...coupon,
      amount: newAmount.toString(), // Convert to string for storage
    };
    
    this.coupons.set(couponId, updatedCoupon);
    return updatedCoupon;
  }

  async getCashbackCouponsByUser(userId: number): Promise<CashbackCoupon[]> {
    // Get all purchases for this user that are verified
    const userPurchases = await this.getUserPurchases(userId);
    const verifiedPurchaseIds = userPurchases
      .filter(p => p.verificationStatus === 'verified')
      .map(p => p.id);

    // Return only coupons for verified purchases
    return Array.from(this.coupons.values())
      .filter(coupon => verifiedPurchaseIds.includes(coupon.purchaseId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort by newest first
  }
}

export const storage = new MemStorage();