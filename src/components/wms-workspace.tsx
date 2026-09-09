"use client";

import { useEffect, useState } from "react";
import { WmsResourceExplorer } from "@/components/wms-resource-explorer";
import { WmsTracker } from "@/components/wms-tracker";
import type { WmsTrackerTask } from "@/lib/wms-tracker-types";
import type { WmsModule } from "@/lib/wms-types";

type WmsView = "resources" | "tracker";

type WmsWorkspaceProps = {
  initialView: WmsView;
  initialModules: WmsModule[];
  initialTasks: WmsTrackerTask[];
  resourcesConnected: boolean;
  trackerConnected: boolean;
  canManageResources: boolean;
  canManageTracker: boolean;
  editorEmail?: string;
};

export function WmsWorkspace({
  initialView,
  initialModules,
  initialTasks,
  resourcesConnected,
  trackerConnected,
  canManageResources,
  canManageTracker,
  editorEmail,
}: WmsWorkspaceProps) {
  const [view, setView] = useState<WmsView>(initialView);

  useEffect(() => {
    function syncView() {
      const requested = new URL(window.location.href).searchParams.get("vista");
      setView(requested === "tracker" ? "tracker" : "resources");
    }
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);

  function selectView(nextView: WmsView) {
    setView(nextView);
    const url = new URL(window.location.href);
    if (nextView === "tracker") url.searchParams.set("vista", "tracker");
    else url.searchParams.delete("vista");
    window.history.pushState(null, "", url);
  }

  return (
    <>
      <nav className="mt-8 flex items-end gap-8 border-b border-[var(--line)]" aria-label="Vistas WMS" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === "resources"}
          aria-controls="wms-resources-panel"
          onClick={() => selectView("resources")}
          className={`relative pb-3 text-sm font-bold uppercase tracking-[0.06em] transition sm:text-base ${view === "resources" ? "text-[#2f9df4]" : "text-[var(--muted)] hover:text-[var(--navy)]"}`}
        >
          Recursos WMS
          {view === "resources" && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[#2f9df4]" />}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "tracker"}
          aria-controls="wms-tracker-panel"
          onClick={() => selectView("tracker")}
          className={`relative pb-3 text-sm font-bold uppercase tracking-[0.06em] transition sm:text-base ${view === "tracker" ? "text-[#2f9df4]" : "text-[var(--muted)] hover:text-[var(--navy)]"}`}
        >
          Tracker WMS
          {view === "tracker" && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[#2f9df4]" />}
        </button>
      </nav>

      <div id="wms-resources-panel" role="tabpanel" hidden={view !== "resources"}>
        {view === "resources" && (
          <WmsResourceExplorer
            initialModules={initialModules}
            canManage={resourcesConnected && canManageResources}
            editorEmail={editorEmail}
          />
        )}
      </div>

      <div id="wms-tracker-panel" role="tabpanel" hidden={view !== "tracker"}>
        {view === "tracker" && (
          <WmsTracker
            initialTasks={initialTasks}
            initialConnected={trackerConnected}
            canManage={canManageTracker}
            editorEmail={editorEmail}
          />
        )}
      </div>
    </>
  );
}
