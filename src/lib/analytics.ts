/**
 * Provider-agnostic analytics. Disabled unless NEXT_PUBLIC_ANALYTICS_PROVIDER is set.
 * Never send content (answers, notes, card text): only event names and coarse props.
 */
type Props = Record<string, string | number | boolean>;

type Provider = { track: (event: string, props?: Props) => void };

const providers: Record<string, Provider> = {
  console: { track: (event, props) => console.info("[analytics]", event, props ?? {}) },
  plausible: {
    track: (event, props) => {
      const w = globalThis as unknown as { plausible?: (e: string, o?: { props?: Props }) => void };
      w.plausible?.(event, props ? { props } : undefined);
    },
  },
};

const active = providers[process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? ""];

export function track(event: string, props?: Props): void {
  if (!active || typeof window === "undefined") return;
  try {
    active.track(event, props);
  } catch {
    // analytics must never break the app
  }
}