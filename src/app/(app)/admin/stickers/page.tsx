import { supabaseAdmin } from "@/lib/supabase/server";
import { StarterStickers } from "@/components/admin/StarterStickers";

export default async function AdminStickers() {
  const { data } = await supabaseAdmin().from("stickers").select("id, path, animated").is("room_id", null).order("sort").order("created_at").limit(1000);
  return (
    <div>
      <h1 className="display text-[2.6rem] leading-none">Stickers</h1>
      <p className="mt-2 max-w-2xl text-[0.9rem] text-muted">
        The starter pack every couple gets in the chat. Upload WebP, PNG or GIF stickers (animated ones keep moving; up to 1 MB each), or any photo and it&apos;s fitted to a 512px square.
        Only add stickers you have the right to share with everyone.
      </p>
      <StarterStickers items={(data ?? []) as { id: string; path: string; animated: boolean }[]} />
    </div>
  );
}
