"use client";
import { useEffect } from "react";
import { trackMothersDayView } from "@/lib/analytics";

export function MothersDayViewTracker() {
  useEffect(() => {
    trackMothersDayView();
  }, []);
  return null;
}
