import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export type ScanMode = "passive" | "probe";

export function useScan() {
  const [, setLocation] = useLocation();
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("passive");

  const scanUrl = async (url: string, mode?: ScanMode) => {
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    const selectedMode = mode || scanMode;
    setIsScanning(true);

    const toastId = selectedMode === "probe" 
      ? toast.loading("Running deep probe scan... This may take up to 45 seconds")
      : toast.loading("Scanning...");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, mode: selectedMode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Scan failed");
      }

      const result = await response.json();
      toast.dismiss(toastId);
      toast.success(selectedMode === "probe" 
        ? "Probe scan complete! AI detection enhanced." 
        : "Scan complete!");
      setLocation(`/card/${result.id}`);
    } catch (error) {
      console.error("Scan error:", error);
      toast.dismiss(toastId);
      toast.error(error instanceof Error ? error.message : "Failed to scan URL");
    } finally {
      setIsScanning(false);
    }
  };

  return { scanUrl, isScanning, scanMode, setScanMode };
}
