import { ensureMonitoring, getLandingPages, getState } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    ensureMonitoring();
    
    const state = getState();
    const landingPages = getLandingPages();
    
    // Wait for initial checks to complete if monitoring just initialized
    // Check if this is the first time (all pages have UNKNOWN status)
    const allUnknown = landingPages.every((page) => {
      const pageState = state.get(page.id);
      return !pageState || pageState.status === "UNKNOWN" || !pageState.lastChecked;
    });
    
    // If all pages are UNKNOWN, wait longer for checks to complete
    if (allUnknown) {
      const maxWaitTime = 15000; // 15 seconds max for initial checks
      const startTime = Date.now();
      let attempts = 0;
      const maxAttempts = 30; // Check every 500ms
      
      while (attempts < maxAttempts && Date.now() - startTime < maxWaitTime) {
        const stillUnknown = landingPages.some((page) => {
          const pageState = state.get(page.id);
          return !pageState || pageState.status === "UNKNOWN" || !pageState.lastChecked;
        });
        
        if (!stillUnknown) {
          console.log(`All checks completed after ${Date.now() - startTime}ms`);
          break;
        }
        
        // Wait 500ms before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
    }
    
    const results = landingPages.map((page) => {
      const pageState = state.get(page.id);
      return {
        ...page,
        ...(pageState || {
          status: "UNKNOWN",
          reason: "Pending first check",
          lastChecked: null,
          risk: "Unknown"
        })
      };
    });

    return Response.json({ 
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in /api/pages:", error);
    return Response.json({ 
      results: [], 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
