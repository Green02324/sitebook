import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { BackLink } from "../components/BackLink";
import type { User } from "../types";

export function Profile() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      await api.put<User>("/users/me", { name, email, avatarUrl: avatarUrl || null });
      setProfileMessage("Profile updated.");
    } catch (err) {
      setProfileError((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    setSavingPassword(true);
    try {
      await api.put("/users/me/password", { currentPassword, newPassword });
      setPasswordMessage("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <BackLink to="/dashboard" />

      <h1 className="text-2xl font-bold text-slate-900">Profile</h1>

      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">{initials}</div>
        )}
        <div>
          <div className="font-semibold text-slate-900">{user?.name}</div>
          <div className="text-sm text-slate-500">Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""}</div>
        </div>
      </div>

      <form className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4" onSubmit={handleProfileSubmit}>
        <h2 className="font-semibold text-slate-900">Account details</h2>
        <label className="text-sm font-medium text-slate-700">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Avatar URL
          <input
            value={avatarUrl ?? ""}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="https://…"
          />
        </label>
        {profileError && <div className="text-sm text-rose-600">{profileError}</div>}
        {profileMessage && <div className="text-sm text-emerald-600">{profileMessage}</div>}
        <button type="submit" disabled={savingProfile} className="self-start rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {savingProfile ? "Saving…" : "Save changes"}
        </button>
      </form>

      <form className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4" onSubmit={handlePasswordSubmit}>
        <h2 className="font-semibold text-slate-900">Change password</h2>
        <label className="text-sm font-medium text-slate-700">
          Current password
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          New password
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        {passwordError && <div className="text-sm text-rose-600">{passwordError}</div>}
        {passwordMessage && <div className="text-sm text-emerald-600">{passwordMessage}</div>}
        <button type="submit" disabled={savingPassword} className="self-start rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {savingPassword ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
