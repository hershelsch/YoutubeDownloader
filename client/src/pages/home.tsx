import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, Music, FileVideo, Shield, Zap, Archive, Play, Check, AlertCircle, FileArchive, Plus, X } from "lucide-react";
import { downloadRequestSchema, type DownloadRequest, type Download as DownloadType } from "@shared/schema";

interface ProgressData {
  downloadId: number;
  status: string;
  progress: number;
  error?: string;
}

export default function Home() {
  const [currentDownloadId, setCurrentDownloadId] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadType | null>(null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const form = useForm<DownloadRequest>({
    resolver: zodResolver(downloadRequestSchema),
    defaultValues: {
      url: "",
      format: "mp4",
      quality: "720p"
    }
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data: ProgressData = JSON.parse(event.data);
      if (data.downloadId === currentDownloadId) {
        setProgressData(data);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [currentDownloadId]);

  // Poll download status
  const { data: downloadData } = useQuery({
    queryKey: ['/api/downloads', currentDownloadId],
    enabled: !!currentDownloadId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (downloadData) {
      setDownloadStatus(downloadData);
    }
  }, [downloadData]);

  const downloadMutation = useMutation({
    mutationFn: async (data: DownloadRequest) => {
      const response = await apiRequest("POST", "/api/downloads", data);
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentDownloadId(data.downloadId);
      toast({
        title: "Download Started",
        description: "Your video download has been initiated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DownloadRequest) => {
    downloadMutation.mutate(data);
  };

  const resetForm = () => {
    form.reset();
    setCurrentDownloadId(null);
    setDownloadStatus(null);
    setProgressData(null);
    setVideoInfo(null);
  };

  const handleDownloadZip = () => {
    if (currentDownloadId) {
      window.open(`/api/downloads/${currentDownloadId}/zip`, '_blank');
    }
  };

  const isValidUrl = (url: string) => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const currentUrl = form.watch("url");
  const urlIsValid = currentUrl && isValidUrl(currentUrl);

  const getStatusMessage = () => {
    if (progressData) {
      switch (progressData.status) {
        case "downloading":
          return "Downloading video...";
        case "creating_zip":
          return "Creating ZIP file...";
        case "completed":
          return "Download completed!";
        case "failed":
          return "Download failed";
        default:
          return "Processing...";
      }
    }
    if (downloadStatus) {
      switch (downloadStatus.status) {
        case "pending":
          return "Preparing download...";
        case "downloading":
          return "Downloading video...";
        case "completed":
          return "Download completed!";
        case "failed":
          return "Download failed";
        default:
          return "Processing...";
      }
    }
    return "Processing...";
  };

  const getCurrentProgress = () => {
    return progressData?.progress || downloadStatus?.progress || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Download className="text-primary-foreground" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">YouTube Downloader</h1>
              <p className="text-sm text-gray-600">Download YouTube videos quickly and securely</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Download Form */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-900 mb-2">Download Video</h2>
            <p className="text-sm text-gray-600">Enter a YouTube URL to download the video as a zip file</p>
          </div>
          
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* URL Input */}
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-1">
                        <span>YouTube URL</span>
                        <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                          </div>
                          <Input
                            {...field}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="pl-10 pr-10"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            {urlIsValid && (
                              <Check className="w-5 h-5 text-green-500" />
                            )}
                            {currentUrl && !urlIsValid && (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                        </div>
                      </FormControl>
                      <p className="text-xs text-gray-500 flex items-center space-x-1">
                        <AlertCircle size={12} />
                        <span>Supports youtube.com and youtu.be links</span>
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Format Selection */}
                <FormField
                  control={form.control}
                  name="format"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Download Format</FormLabel>
                      <div className="grid grid-cols-3 gap-3">
                        <label className="relative">
                          <input
                            type="radio"
                            name="format"
                            value="mp4"
                            checked={field.value === "mp4"}
                            onChange={() => field.onChange("mp4")}
                            className="sr-only peer"
                          />
                          <div className="p-3 border-2 border-gray-200 rounded-lg cursor-pointer peer-checked:border-primary peer-checked:bg-primary/5 transition-colors duration-200">
                            <div className="text-center">
                              <FileVideo className="w-5 h-5 mx-auto mb-1 text-gray-600 peer-checked:text-primary" />
                              <div className="text-sm font-medium text-gray-900">MP4</div>
                              <div className="text-xs text-gray-500">Video + Audio</div>
                            </div>
                          </div>
                        </label>
                        <label className="relative">
                          <input
                            type="radio"
                            name="format"
                            value="mp3"
                            checked={field.value === "mp3"}
                            onChange={() => field.onChange("mp3")}
                            className="sr-only peer"
                          />
                          <div className="p-3 border-2 border-gray-200 rounded-lg cursor-pointer peer-checked:border-primary peer-checked:bg-primary/5 transition-colors duration-200">
                            <div className="text-center">
                              <Music className="w-5 h-5 mx-auto mb-1 text-gray-600 peer-checked:text-primary" />
                              <div className="text-sm font-medium text-gray-900">MP3</div>
                              <div className="text-xs text-gray-500">Audio Only</div>
                            </div>
                          </div>
                        </label>
                        <label className="relative">
                          <input
                            type="radio"
                            name="format"
                            value="webm"
                            checked={field.value === "webm"}
                            onChange={() => field.onChange("webm")}
                            className="sr-only peer"
                          />
                          <div className="p-3 border-2 border-gray-200 rounded-lg cursor-pointer peer-checked:border-primary peer-checked:bg-primary/5 transition-colors duration-200">
                            <div className="text-center">
                              <FileVideo className="w-5 h-5 mx-auto mb-1 text-gray-600 peer-checked:text-primary" />
                              <div className="text-sm font-medium text-gray-900">WebM</div>
                              <div className="text-xs text-gray-500">High Quality</div>
                            </div>
                          </div>
                        </label>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Quality Selection */}
                <FormField
                  control={form.control}
                  name="quality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Video Quality</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select quality" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                          <SelectItem value="720p">720p (HD)</SelectItem>
                          <SelectItem value="480p">480p (SD)</SelectItem>
                          <SelectItem value="360p">360p (Low)</SelectItem>
                          <SelectItem value="best">Best Available</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {/* Download Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={downloadMutation.isPending || !urlIsValid || !!currentDownloadId}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {downloadMutation.isPending ? "Starting Download..." : "Download Video"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Progress Card */}
        {currentDownloadId && downloadStatus?.status !== "completed" && (
          <Card className="mt-6 bg-white shadow-sm border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Downloading...</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-primary rounded-full animate-pulse" />
                  <span className="text-sm text-gray-600">{getCurrentProgress()}%</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <Progress value={getCurrentProgress()} className="h-2" />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="text-gray-500">Status</div>
                    <div className="font-medium text-gray-900">{getStatusMessage()}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-gray-500">File Size</div>
                    <div className="font-medium text-gray-900">
                      {downloadStatus?.fileSize || "Calculating..."}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Card */}
        {downloadStatus?.status === "completed" && (
          <Card className="mt-6 bg-white shadow-sm border border-gray-200 animate-in fade-in duration-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Download Ready!</h3>
                  <p className="text-sm text-gray-600">Your video has been processed and zipped</p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <div className="w-20 h-14 bg-gray-300 rounded flex items-center justify-center flex-shrink-0">
                    <Play className="w-6 h-6 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {downloadStatus.fileName || "YouTube Video"}
                    </h4>
                    <div className="mt-1 space-y-1">
                      <div className="text-sm text-gray-600">
                        Format: {downloadStatus.format?.toUpperCase()} • Quality: {downloadStatus.quality}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleDownloadZip}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <FileArchive className="w-4 h-4 mr-2" />
                  Download ZIP File
                  <span className="text-xs opacity-75 ml-2">
                    ({downloadStatus.fileSize})
                  </span>
                </Button>
                
                <Button
                  onClick={resetForm}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Download Another Video
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Card */}
        {downloadStatus?.status === "failed" && (
          <Card className="mt-6 bg-red-50 border border-red-200">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-red-900 mb-1">Download Failed</h4>
                  <p className="text-sm text-red-700">
                    {downloadStatus.errorMessage || "The video URL is invalid or the video is not available for download. Please check the URL and try again."}
                  </p>
                  <Button
                    onClick={resetForm}
                    variant="ghost"
                    className="mt-2 p-0 h-auto text-sm font-medium text-red-600 hover:text-red-500"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Section */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Secure & Private</h3>
            <p className="text-sm text-gray-600">Your downloads are processed securely and we don't store your data</p>
          </div>
          
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Fast Processing</h3>
            <p className="text-sm text-gray-600">High-speed servers ensure quick downloads and processing</p>
          </div>
          
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Archive className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">ZIP Delivery</h3>
            <p className="text-sm text-gray-600">Get your videos neatly packaged in downloadable ZIP files</p>
          </div>
        </div>
      </main>

      <footer className="mt-16 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center text-sm text-gray-600">
            <p>&copy; 2024 YouTube Downloader. Built with modern web technologies.</p>
            <p className="mt-2">Please respect copyright laws and only download content you have permission to use.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
