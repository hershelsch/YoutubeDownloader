import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { downloadRequestSchema, type Download } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";
import { WebSocketServer } from "ws";
import ytdl from "ytdl-core";

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

let wss: WebSocketServer;

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup WebSocket for real-time progress updates
  wss = new WebSocketServer({ server: httpServer });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // Create downloads directory if it doesn't exist
  const downloadsDir = path.join(process.cwd(), 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  // Start download endpoint
  app.post("/api/downloads", async (req, res) => {
    try {
      const downloadData = downloadRequestSchema.parse(req.body);
      
      // Create download record
      const download = await storage.createDownload(downloadData);
      
      // Start download process asynchronously
      processDownload(download.id);
      
      res.json({ downloadId: download.id, status: "started" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get download status endpoint
  app.get("/api/downloads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const download = await storage.getDownload(id);
      
      if (!download) {
        return res.status(404).json({ error: "Download not found" });
      }
      
      res.json(download);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Download zip file endpoint
  app.get("/api/downloads/:id/zip", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const download = await storage.getDownload(id);
      
      if (!download || download.status !== "completed" || !download.zipPath) {
        return res.status(404).json({ error: "Download not ready" });
      }
      
      if (!fs.existsSync(download.zipPath)) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const fileName = download.fileName || "download.zip";
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.zip"`);
      res.setHeader('Content-Type', 'application/zip');
      
      const fileStream = fs.createReadStream(download.zipPath);
      fileStream.pipe(res);
      
      // Clean up file after download
      fileStream.on('end', () => {
        setTimeout(() => {
          if (fs.existsSync(download.zipPath!)) {
            fs.unlinkSync(download.zipPath!);
          }
        }, 5000);
      });
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}

// Process download using ytdl-core
async function processDownload(downloadId: number) {
  try {
    const download = await storage.getDownload(downloadId);
    if (!download) return;

    await storage.updateDownload(downloadId, { status: "downloading" });
    broadcastProgress(downloadId, { status: "downloading", progress: 0 });

    const downloadsDir = path.join(process.cwd(), 'downloads');
    const outputDir = path.join(downloadsDir, `download_${downloadId}`);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get video info first with API key for authentication
    const info = await ytdl.getInfo(download.url, {
      requestOptions: {
        headers: {
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': '2.20220801.00.00'
        }
      }
    });
    const videoTitle = info.videoDetails.title.replace(/[^\w\s-]/g, '').trim();
    
    // Determine format and quality
    let format;
    if (download.format === 'mp3') {
      format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
    } else {
      const qualityFilter = download.quality === 'best' ? 'highest' : download.quality.replace('p', '');
      if (download.format === 'mp4') {
        format = ytdl.chooseFormat(info.formats, { quality: qualityFilter, filter: format => format.container === 'mp4' });
      } else if (download.format === 'webm') {
        format = ytdl.chooseFormat(info.formats, { quality: qualityFilter, filter: format => format.container === 'webm' });
      }
    }

    if (!format) {
      throw new Error('No suitable format found');
    }

    const fileExtension = download.format === 'mp3' ? 'mp3' : format.container;
    const fileName = `${videoTitle}.${fileExtension}`;
    const filePath = path.join(outputDir, fileName);

    // Create download stream
    const stream = ytdl(download.url, { format: format });
    const writeStream = fs.createWriteStream(filePath);

    let downloadedBytes = 0;
    const totalBytes = parseInt(format.contentLength || '0');

    stream.on('progress', (chunkLength, downloaded, total) => {
      downloadedBytes = downloaded;
      const progress = Math.round((downloaded / total) * 80); // Reserve 20% for ZIP creation
      broadcastProgress(downloadId, { status: "downloading", progress });
    });

    stream.on('error', (error) => {
      throw error;
    });

    stream.pipe(writeStream);

    writeStream.on('finish', async () => {
      try {
        broadcastProgress(downloadId, { status: "creating_zip", progress: 90 });
        
        const zipPath = path.join(downloadsDir, `${videoTitle}_${downloadId}.zip`);
        await createZipFile(outputDir, zipPath);
        
        // Get file size
        const stats = fs.statSync(zipPath);
        const fileSize = formatFileSize(stats.size);
        
        await storage.updateDownload(downloadId, {
          status: "completed",
          progress: 100,
          fileName: videoTitle,
          fileSize: fileSize,
          zipPath: zipPath
        });
        
        broadcastProgress(downloadId, { status: "completed", progress: 100 });
        
        // Clean up original files
        fs.rmSync(outputDir, { recursive: true, force: true });
        
      } catch (error: any) {
        await storage.updateDownload(downloadId, {
          status: "failed",
          errorMessage: error.message
        });
        broadcastProgress(downloadId, { status: "failed", error: error.message });
      }
    });

    writeStream.on('error', async (error) => {
      await storage.updateDownload(downloadId, {
        status: "failed",
        errorMessage: error.message
      });
      broadcastProgress(downloadId, { status: "failed", error: error.message });
    });

  } catch (error: any) {
    console.error('Download processing error:', error);
    await storage.updateDownload(downloadId, {
      status: "failed",
      errorMessage: error.message
    });
    broadcastProgress(downloadId, { status: "failed", error: error.message });
  }
}

// Create zip file from directory
function createZipFile(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Broadcast progress to WebSocket clients
function broadcastProgress(downloadId: number, data: any) {
  if (!wss) return;
  
  const message = JSON.stringify({
    downloadId,
    ...data
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
