"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { VideoRoom as Room } from "./video-room";

// The call's code (LiveKit) loads only when a call opens, so other pages stay light.
const VideoRoom = dynamic(() => import("./video-room").then((m) => m.VideoRoom), { ssr: false });

type RoomProps = Omit<ComponentProps<typeof Room>, "mini" | "callPath" | "onActive">;
type Call = { props: RoomProps; path: string };
const OpenCall = createContext<((call: Call) => void) | null>(null);

/**
 * Keeps a video call going while the person moves around the app, as in Zoom or
 * Teams. On the call's own page it shows in full; anywhere else it shrinks to a
 * small window in the corner (their video, mute, camera, "Back to the call"), and
 * recording, tools and screen sharing carry on. Lives in the app's layout, which
 * stays in place between pages. Leaving the page before joining closes it.
 */
export function CallHost({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [call, setCall] = useState<Call | null>(null);
  const [active, setActive] = useState(false);
  const here = !!call && pathname === call.path;
  const open = useCallback((next: Call) => {
    // The same room keeps its connection; only its details refresh.
    setCall((prev) => (prev?.props.roomId === next.props.roomId ? { ...prev, props: next.props } : next));
  }, []);
  // Off the call's page, a call that isn't on (not joined yet, or over) simply isn't shown.
  const shown = !!call && (here || active);

  return (
    <OpenCall.Provider value={open}>
      {shown && (
        // One element in both views, so the call is never rebuilt (or dropped) when it moves.
        <div className={here ? "" : "no-print fixed bottom-4 left-4 z-40 w-[min(calc(100vw-2rem),320px)] sm:bottom-5 sm:left-5"}>
          <VideoRoom key={call.props.roomId} {...call.props} mini={!here} callPath={call.path}
            onActive={setActive} />
        </div>
      )}
      {children}
    </OpenCall.Provider>
  );
}

/** Placed on a call's page: hands the call to the host (or shows it directly when there is none). */
export function CallPage({ path, ...props }: RoomProps & { path: string }) {
  const open = useContext(OpenCall);
  const key = JSON.stringify(props);
  useEffect(() => {
    open?.({ props: JSON.parse(key) as RoomProps, path });
  }, [open, key, path]);
  return open ? null : <VideoRoom {...props} />;
}
