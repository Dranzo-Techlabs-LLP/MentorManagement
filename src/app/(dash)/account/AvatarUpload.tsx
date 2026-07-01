"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";

export function AvatarUpload({ name, src }: { name: string; src?: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Selected profile"
          className="rounded-full object-cover"
          style={{ width: 72, height: 72 }}
        />
      ) : (
        <Avatar name={name} src={src} size={72} />
      )}
      <div>
        <label className="btn-outline cursor-pointer">
          <Camera className="h-4 w-4" /> Change photo
          <input
            type="file"
            name="avatar"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
        </label>
        <p className="mt-1 text-xs text-slate-400">JPG or PNG, up to 5MB.</p>
      </div>
    </div>
  );
}
