"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Icon } from "@/design/icons";
import { useRoom } from "@/lib/realtime/RoomProvider";

/** Appears only after a second of trouble, so brief blips don't flash at people. */
export function ConnectionBanner() {
  const { connection } = useRoom();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (connection === "live" || connection === "connecting") {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 1000);
    return () => clearTimeout(t);
  }, [connection]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden border-b border-line bg-sunk"
          role="status"
        >
          <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-[0.85rem] font-medium sm:px-8">
            <Icon name="wifiOff" size={16} />
            {connection === "offline"
              ? "You're offline. We'll catch you up the moment you're back."
              : "Lost the thread for a sec. Reconnecting…"}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}