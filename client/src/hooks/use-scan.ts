import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export function useScan() {
  const [, setLocation] = useLocation();
  const [isScanning, setIsScanning] = useState(false);

  const scanUrl = async (url: string) => {
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setIsScanning(true);
    const toastId = toast.loading("Scanning... Results appear as they're detected");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Scan failed");
      }

      const result = await response.json();
      toast.dismiss(toastId);
      toast.success("Scan started! Deeper analysis running in background.");
      // Use domain in URL for cleaner sharing
      const domain = new URL(result.url).hostname.replace(/^www\./, '');
      setLocation(`/scan/${encodeURIComponent(domain)}`);
    } catch (error) {
      console.error("Scan error:", error);
      toast.dismiss(toastId);
      toast.error(error instanceof Error ? error.message : "Failed to scan URL");
    } finally {
      setIsScanning(false);
    }
  };

  const triggerProbeScan = async (scanId: string) => {
    const toastId = toast.loading("Running AI probe scan... This may take 30-60 seconds");
    
    try {
      const response = await fetch(`/api/scan/${scanId}/probe`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Probe scan failed");
      }

      toast.dismiss(toastId);
      toast.success("AI probe scan started!");
      return true;
    } catch (error) {
      console.error("Probe scan error:", error);
      toast.dismiss(toastId);
      toast.error(error instanceof Error ? error.message : "Failed to start probe scan");
      return false;
    }
  };

  return { scanUrl, isScanning, triggerProbeScan };
}
