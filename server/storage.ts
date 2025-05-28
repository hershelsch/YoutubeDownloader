import { users, downloads, type User, type InsertUser, type Download, type InsertDownload } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Download methods
  createDownload(download: InsertDownload): Promise<Download>;
  getDownload(id: number): Promise<Download | undefined>;
  updateDownload(id: number, updates: Partial<Download>): Promise<Download | undefined>;
  getDownloadsByStatus(status: string): Promise<Download[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private downloads: Map<number, Download>;
  private currentUserId: number;
  private currentDownloadId: number;

  constructor() {
    this.users = new Map();
    this.downloads = new Map();
    this.currentUserId = 1;
    this.currentDownloadId = 1;
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
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createDownload(insertDownload: InsertDownload): Promise<Download> {
    const id = this.currentDownloadId++;
    const download: Download = {
      ...insertDownload,
      id,
      status: "pending",
      progress: 0,
      fileName: null,
      fileSize: null,
      zipPath: null,
      errorMessage: null,
      createdAt: new Date(),
    };
    this.downloads.set(id, download);
    return download;
  }

  async getDownload(id: number): Promise<Download | undefined> {
    return this.downloads.get(id);
  }

  async updateDownload(id: number, updates: Partial<Download>): Promise<Download | undefined> {
    const download = this.downloads.get(id);
    if (!download) return undefined;
    
    const updatedDownload = { ...download, ...updates };
    this.downloads.set(id, updatedDownload);
    return updatedDownload;
  }

  async getDownloadsByStatus(status: string): Promise<Download[]> {
    return Array.from(this.downloads.values()).filter(
      (download) => download.status === status,
    );
  }
}

export const storage = new MemStorage();
