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
      toast.success("Scan complete!");
      setLocation(`/card/${result.id}`);
    } catch (error) {
      console.error("Scan error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to scan URL");
    } finally {
      setIsScanning(false);
    }
  };

  return { scanUrl, isScanning };
}
