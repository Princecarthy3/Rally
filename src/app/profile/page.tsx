"use client";

import { Camera, CheckCircle2, Image as ImageIcon, LoaderCircle, Trash2, UserRound } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { ProtectedPage } from "@/components/protected-page";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setName(profile?.display_name || user?.user_metadata?.display_name || "");
      setAvatar(profile?.avatar_url || "");
    });
  }, [profile, user]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image file size must be under 5MB.");
      return;
    }

    setError("");
    setMessage("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxSize = 256;

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setAvatar(dataUrl);
          setMessage("Avatar photo loaded. Click 'Save profile' to keep changes.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (name.trim().length < 2 || name.trim().length > 24) {
      setError("Display name must be 2–24 characters.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    setBusy(true);

    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim(),
        avatar_url: avatar.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (saveError) {
      setError(saveError.message);
    } else {
      await refreshProfile();
      setMessage("Profile saved successfully.");
    }
    setBusy(false);
  }

  const initial = name.trim().charAt(0).toUpperCase() || "R";

  return (
    <ProtectedPage>
      <main className="mx-auto max-w-4xl px-5 pb-28 pt-10 lg:px-8 lg:pt-14">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-violet-600">Your player card</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-.05em]">Profile</h1>
        <p className="mt-3 text-slate-500">Choose how friends will recognize you in Rally.</p>

        <div className="mt-10 grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="rounded-[28px] bg-slate-950 p-7 text-center text-white shadow-xl">
            <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-full border-4 border-white/10 bg-violet-600 grid place-items-center text-5xl font-black">
              {avatar ? (
                <img src={avatar} alt="Profile avatar" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <h2 className="mt-5 truncate text-xl font-black">{name || "Player"}</h2>
            <p className="mt-1 text-sm text-slate-400">Rally player</p>

            <div className="mt-7 grid grid-cols-2 gap-2 border-t border-white/10 pt-6">
              <div>
                <strong className="block text-xl">{profile?.wins ?? 0}</strong>
                <span className="text-xs text-slate-500">Wins</span>
              </div>
              <div>
                <strong className="block text-xl">{profile?.games_played ?? 0}</strong>
                <span className="text-xs text-slate-500">Games</span>
              </div>
            </div>
          </aside>

          <form onSubmit={save} className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <UserRound size={20} />
              </span>
              <div>
                <h2 className="font-black">Public details</h2>
                <p className="text-xs text-slate-400">Visible to opponents you play.</p>
              </div>
            </div>

            <div className="mt-7 space-y-6">
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Display name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  required
                  className="focus-ring w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none"
                />
                <span className="mt-1.5 block text-right text-xs text-slate-400">{name.length}/24</span>
              </label>

              {/* Avatar Upload Section */}
              <div>
                <span className="mb-2 block text-sm font-bold">Profile Avatar</span>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/png, image/jpeg, image/webp, image/gif"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="arcade-button bg-violet-600 text-white border-slate-900 shadow-[3px_3px_0_#171821]"
                  >
                    <Camera size={16} /> Upload image file
                  </button>

                  {avatar && (
                    <button
                      type="button"
                      onClick={() => setAvatar("")}
                      className="arcade-button bg-red-50 text-red-600 border-slate-900"
                    >
                      <Trash2 size={16} /> Remove
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-400">Upload any PNG, JPG, or WebP photo from your device.</p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold">
                  Or use an Image URL <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <input
                  value={avatar.startsWith("data:") ? "" : avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  type="url"
                  placeholder="https://…"
                  className="focus-ring w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold">Account email</span>
                <input
                  value={user?.email || ""}
                  disabled
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-slate-400"
                />
              </label>

              {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              {message && (
                <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <CheckCircle2 size={16} /> {message}
                </p>
              )}

              <button
                disabled={busy}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 font-bold text-white disabled:opacity-60"
              >
                {busy && <LoaderCircle size={17} className="animate-spin" />}
                Save profile
              </button>
            </div>
          </form>
        </div>
      </main>
    </ProtectedPage>
  );
}
