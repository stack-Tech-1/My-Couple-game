import { supabaseAdmin } from "@/lib/supabase/server";
import { pictureUrl, type PictureRow } from "@/lib/solo/fixam-server";
import { FixamAdmin } from "@/components/admin/FixamAdmin";

export default async function AdminFixam() {
  const { data } = await supabaseAdmin().from("fixam_pictures").select("*").order("sort").order("created_at");
  const pictures = ((data ?? []) as PictureRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    place: p.place,
    note: p.note,
    link: p.link,
    own_photo: p.own_photo,
    credit: p.credit,
    live: p.live,
    feature_on: p.feature_on,
    url: pictureUrl(p.path),
  }));
  return (
    <div className="max-w-4xl">
      <h1 className="display text-[2.6rem] leading-none">Fix Am pictures</h1>
      <p className="mt-2 text-[0.9rem] text-muted">
        The photos in Fix Am, the Solo picture puzzle. Add your own (no credit needed) or free-to-use photos (show the credit the licence asks for). Changes show straight away.
      </p>
      <FixamAdmin pictures={pictures} />
    </div>
  );
}
