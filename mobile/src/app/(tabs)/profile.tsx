import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/api";
import type { User } from "@/types";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleSaveProfile() {
    setProfileError(null);
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      await api.put<User>("/users/me", { name, email });
      setProfileMessage("Profile updated.");
    } catch (err) {
      setProfileError((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.memberSince}>
            Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account details</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        {profileError && <Text style={styles.error}>{profileError}</Text>}
        {profileMessage && <Text style={styles.success}>{profileMessage}</Text>}
        <Pressable style={styles.button} onPress={handleSaveProfile} disabled={savingProfile}>
          <Text style={styles.buttonText}>{savingProfile ? "Saving…" : "Save changes"}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change password</Text>
        <Text style={styles.label}>Current password</Text>
        <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <Text style={styles.label}>New password</Text>
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        {passwordError && <Text style={styles.error}>{passwordError}</Text>}
        {passwordMessage && <Text style={styles.success}>{passwordMessage}</Text>}
        <Pressable style={styles.button} onPress={handleChangePassword} disabled={savingPassword}>
          <Text style={styles.buttonText}>{savingPassword ? "Saving…" : "Change password"}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 16 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#4f46e5", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  name: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  memberSince: { fontSize: 12, color: "#64748b", marginTop: 2 },
  section: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  label: { fontSize: 12, fontWeight: "600", color: "#334155", marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  error: { color: "#e11d48", fontSize: 12, marginTop: 8 },
  success: { color: "#059669", fontSize: 12, marginTop: 8 },
  button: { backgroundColor: "#4f46e5", borderRadius: 8, paddingVertical: 11, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  logoutButton: { borderWidth: 1, borderColor: "#e11d48", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  logoutText: { color: "#e11d48", fontWeight: "700", fontSize: 14 },
});
