// Coaching : connexion, fil de messages avec Thomas, quota de messages selon la formule.
// Porté depuis CalXsthenos (js/views/coach.js, js/cloud.js). Pas encore : programmes envoyés par le coach, notifications, réactions.
import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from "react-native";
import { light as T } from "../src/theme";
import * as C from "../src/cloud";

function AuthForm({ onDone }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (!email.includes("@") || password.length < 6) { setErr("E-mail valide et mot de passe d'au moins 6 caractères."); return; }
    setBusy(true);
    try {
      if (mode === "signup") await C.signUp(email.trim(), password, name.trim());
      else await C.signIn(email.trim(), password);
      onDone();
    } catch (e) {
      setErr(e.message || "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Coaching</Text>
      <Text style={styles.soft}>Connecte-toi pour échanger avec Thomas. Tes données d'entraînement et de nutrition restent sur ton téléphone.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{mode === "signup" ? "Créer mon compte" : "Me connecter"}</Text>
        {mode === "signup" && (
          <TextInput style={styles.input} placeholder="Prénom" placeholderTextColor={T.steel} value={name} onChangeText={setName} />
        )}
        <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor={T.steel} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Mot de passe (6 caractères min.)" placeholderTextColor={T.steel} secureTextEntry value={password} onChangeText={setPassword} />
        {!!err && <Text style={styles.err}>{err}</Text>}
        <Pressable onPress={submit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{mode === "signup" ? "Créer mon compte" : "Se connecter"}</Text>}
        </Pressable>
        <Pressable onPress={() => { setErr(""); setMode(mode === "signup" ? "signin" : "signup"); }} style={styles.linkBtn}>
          <Text style={styles.linkText}>{mode === "signup" ? "J'ai déjà un compte" : "Pas encore de compte ? Créer un compte"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Bubble({ m, me }) {
  const mine = m.sender === me;
  return (
    <View style={[styles.bubbleWrap, mine ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleCoach]}>
        <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{m.body}</Text>
      </View>
      <Text style={styles.time}>{new Date(m.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
    </View>
  );
}

function Thread({ uid }) {
  const [msgs, setMsgs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [left, setLeft] = useState(undefined);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [t, p, l] = await Promise.all([C.thread(), C.myProfile(), C.msgsLeft()]);
      setMsgs(t); setProfile(p); setLeft(l);
      C.markRead().catch(() => {});
      setErr("");
    } catch (e) {
      setErr(e.message || "Impossible de charger les messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setErr("");
    try {
      await C.send(body);
      setText("");
      await load();
    } catch (e) {
      setErr(e.message?.includes("row-level") || e.code === "42501"
        ? "Tu as atteint la limite de messages de ta formule cette semaine."
        : e.message || "Message non envoyé.");
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={T.blue} /></View>;

  const quota = left === null ? "Messages illimités" : left === undefined ? "" : `${left} message${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""} cette semaine`;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.chalk }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Coaching</Text>
          <Text style={styles.soft}>{profile?.tier ? `Formule : ${profile.tier}` : ""}{quota ? " · " + quota : ""}</Text>
        </View>
        <Pressable onPress={load} style={styles.navBtn}><Text style={styles.navText}>↻</Text></Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.thread}>
        {msgs.length === 0 && <Text style={styles.soft}>Pas encore de message. Écris à Thomas pour démarrer.</Text>}
        {msgs.map(m => <Bubble key={m.id} m={m} me={uid} />)}
      </ScrollView>

      {!!err && <Text style={styles.errBar}>{err}</Text>}
      <View style={styles.composer}>
        <TextInput style={styles.composerInput} placeholder="Écrire à Thomas" placeholderTextColor={T.steel} value={text} onChangeText={setText} multiline />
        <Pressable onPress={send} style={styles.sendBtn}><Text style={styles.btnText}>Envoyer</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function Coaching() {
  const [uid, setUid] = useState(undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    C.currentUserId().then(setUid);
  }, [tick]);

  if (!C.configured) {
    return (
      <View style={styles.center}>
        <Text style={styles.soft}>Connexion au serveur non configurée (variables EXPO_PUBLIC_SUPABASE_*).</Text>
      </View>
    );
  }
  if (uid === undefined) return <View style={styles.center}><ActivityIndicator color={T.blue} /></View>;
  if (!uid) return <AuthForm onDone={() => setTick(t => t + 1)} />;
  return <Thread uid={uid} />;
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40, backgroundColor: T.chalk },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.chalk, padding: 24 },
  header: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 8, backgroundColor: T.chalk },
  title: { fontSize: 24, fontWeight: "700", color: T.ink, marginBottom: 4 },
  soft: { color: T.soft, fontSize: 14, marginTop: 2 },
  err: { color: T.red, marginTop: 8 },
  errBar: { color: T.red, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: T.chalk },
  card: { backgroundColor: T.paper, borderRadius: 12, borderWidth: 1, borderColor: T.line, padding: 14, marginTop: 14, gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: T.ink },
  input: { borderWidth: 1, borderColor: T.line, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: T.ink, backgroundColor: T.chalk },
  btn: { backgroundColor: T.blue, borderRadius: 10, padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  linkBtn: { alignItems: "center", padding: 6 },
  linkText: { color: T.blue, fontWeight: "600" },
  navBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: T.line, alignItems: "center", justifyContent: "center", backgroundColor: T.paper },
  navText: { fontSize: 20, color: T.ink },
  thread: { padding: 16, gap: 10 },
  bubbleWrap: { gap: 2 },
  bubble: { maxWidth: "82%", borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: T.blue },
  bubbleCoach: { backgroundColor: T.paper, borderWidth: 1, borderColor: T.line },
  bubbleText: { fontSize: 15, color: T.ink },
  time: { fontSize: 11, color: T.steel, marginHorizontal: 4 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: T.line, backgroundColor: T.paper },
  composerInput: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, fontSize: 16, color: T.ink, backgroundColor: T.chalk },
  sendBtn: { backgroundColor: T.blue, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
});
