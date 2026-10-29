// Profil : données qui servent aux calculs (poids, taille, âge, activité, objectif, niveau), compte et déconnexion.
// Porté depuis CalXsthenos (profil et onboarding). Pas encore : mesures corporelles, photos, réglages de notifications, export.
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet } from "react-native";
import { light as T } from "../src/theme";
import { useS, update, S } from "../src/state";
import * as C from "../src/cloud";
import { MAIN_LIFTS } from "../src/logic/engine";

const SEX = [["m", "Homme"], ["f", "Femme"]];
const ACTIVITY = [["low", "Sédentaire"], ["light", "Léger"], ["mid", "Modéré"], ["high", "Élevé"], ["vhigh", "Très élevé"]];
const GOAL = [["fat", "Perdre du gras"], ["recomp", "Recomposition"], ["strength", "Prise de force"], ["restart", "Reprise douce"]];
const LEVEL = [["beginner", "Débutant"], ["comeback", "Reprise"], ["intermediate", "Intermédiaire"], ["advanced", "Avancé"]];
const DIET = [["all", "Omnivore"], ["pesce", "Pescétarien"], ["vegetarian", "Végétarien"], ["vegan", "Vegan"]];

function Chips({ options, value, onChange }) {
  return (
    <View style={styles.chips}>
      {options.map(([k, label]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={[styles.chip, value === k && styles.chipOn]}>
          <Text style={[styles.chipText, value === k && { color: "#fff" }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Num({ label, value, onChange, decimal }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} keyboardType={decimal ? "decimal-pad" : "number-pad"} value={value} onChangeText={onChange} />
    </View>
  );
}

function ProfileForm() {
  const p = S().profile || {};
  const [name, setName] = useState(p.name || "");
  const [sex, setSex] = useState(p.sex || null);
  const [age, setAge] = useState(p.age != null ? String(p.age) : "");
  const [height, setHeight] = useState(p.height != null ? String(p.height) : "");
  const [weight, setWeight] = useState(p.weight != null ? String(p.weight).replace(".", ",") : "");
  const [activity, setActivity] = useState(p.activity || null);
  const [goal, setGoal] = useState(p.goal || null);
  const [level, setLevel] = useState(p.level || null);
  const [days, setDays] = useState(p.days != null ? String(p.days) : "");
  const [diet, setDiet] = useState(p.diet || "all");
  const [msg, setMsg] = useState("");

  function save() {
    const a = parseInt(age, 10), h = parseInt(height, 10), w = parseFloat(String(weight).replace(",", ".")), d = parseInt(days, 10);
    if (!(a > 10 && a < 100) || !(h > 100 && h < 230) || !(w > 30 && w < 300)) {
      setMsg("Âge, taille et poids doivent être renseignés et réalistes.");
      return;
    }
    if (!sex || !activity || !goal || !level) {
      setMsg("Choisis ton sexe, ton activité, ton objectif et ton niveau.");
      return;
    }
    update(st => {
      st.profile = { ...(st.profile || {}), name: name.trim(), sex, age: a, height: h, weight: w, activity, goal, level, days: Number.isFinite(d) ? d : 3, diet };
    });
    setMsg("Profil enregistré. Tes besoins sont recalculés.");
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Mes données</Text>
      <Text style={styles.soft}>Elles servent à calculer tes besoins et ta séance.</Text>

      <View style={{ marginTop: 10 }}>
        <Text style={styles.label}>Prénom</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
      </View>
      <Text style={styles.label}>Sexe</Text>
      <Chips options={SEX} value={sex} onChange={setSex} />
      <View style={styles.row3}>
        <View style={{ flex: 1 }}><Num label="Âge" value={age} onChange={setAge} /></View>
        <View style={{ flex: 1 }}><Num label="Taille (cm)" value={height} onChange={setHeight} /></View>
        <View style={{ flex: 1 }}><Num label="Poids (kg)" value={weight} onChange={setWeight} decimal /></View>
      </View>
      <Text style={styles.label}>Activité hors sport</Text>
      <Chips options={ACTIVITY} value={activity} onChange={setActivity} />
      <Text style={styles.label}>Objectif</Text>
      <Chips options={GOAL} value={goal} onChange={setGoal} />
      <Text style={styles.label}>Niveau</Text>
      <Chips options={LEVEL} value={level} onChange={setLevel} />
      <Num label="Jours d'entraînement par semaine" value={days} onChange={setDays} />
      <Text style={styles.label}>Alimentation</Text>
      <Chips options={DIET} value={diet} onChange={setDiet} />

      <Pressable onPress={save} style={styles.btn}><Text style={styles.btnText}>Enregistrer</Text></Pressable>
      {!!msg && <Text style={styles.soft}>{msg}</Text>}
    </View>
  );
}

function RecordsCard() {
  const rec = S().profile?.records || {};
  const [vals, setVals] = useState(() => Object.fromEntries(MAIN_LIFTS.map(([k]) => [k, rec[k]?.e1rm != null ? String(rec[k].e1rm).replace(".", ",") : ""])));
  const [msg, setMsg] = useState("");

  function save() {
    const records = {};
    MAIN_LIFTS.forEach(([k]) => {
      const n = parseFloat(String(vals[k]).replace(",", "."));
      if (Number.isFinite(n) && n > 0) records[k] = { e1rm: n };
    });
    update(st => { st.profile = { ...(st.profile || {}), records }; });
    setMsg("Records enregistrés. Les charges des séances sont recalculées.");
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Mes records (1RM estimé)</Text>
      <Text style={styles.soft}>Le plus lourd que tu peux soulever une fois, en kg. Sans record, les charges des séances restent vides.</Text>
      {MAIN_LIFTS.map(([k, label]) => (
        <View key={k} style={styles.recRow}>
          <Text style={[styles.rowName, { flex: 1 }]}>{label}</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={vals[k]} placeholder="kg" placeholderTextColor={T.steel}
            onChangeText={t => setVals(v => ({ ...v, [k]: t }))} />
        </View>
      ))}
      <Pressable onPress={save} style={styles.btn}><Text style={styles.btnText}>Enregistrer mes records</Text></Pressable>
      {!!msg && <Text style={styles.soft}>{msg}</Text>}
    </View>
  );
}

function AccountCard({ onSignedOut }) {
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!C.configured) { setLoaded(true); return; }
    C.currentUserId().then(uid => {
      if (!uid) { setLoaded(true); return; }
      return C.myProfile().then(p => setMe(p)).catch(() => {}).finally(() => setLoaded(true));
    });
  }, []);

  function signOut() {
    Alert.alert("Se déconnecter ?", "Tes données d'entraînement et de nutrition restent sur ce téléphone.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: async () => { await C.signOut(); setMe(null); onSignedOut(); } },
    ]);
  }

  if (!loaded) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Compte</Text>
      {me ? (
        <>
          <Text style={styles.soft}>{me.email}</Text>
          <Text style={styles.soft}>Formule : {me.tier || "gratuite"}</Text>
          <Pressable onPress={signOut} style={styles.linkBtn}><Text style={[styles.linkText, { color: T.red }]}>Se déconnecter</Text></Pressable>
        </>
      ) : (
        <Text style={styles.soft}>Pas connecté. Connecte-toi dans l'onglet Coaching pour échanger avec Thomas.</Text>
      )}
    </View>
  );
}

export default function Profile() {
  const st = useS();
  const [, setTick] = useState(0);
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.soft}>{st.workouts.length} séance{st.workouts.length > 1 ? "s" : ""} enregistrée{st.workouts.length > 1 ? "s" : ""} · {Object.keys(st.food || {}).length} jour{Object.keys(st.food || {}).length > 1 ? "s" : ""} de journal</Text>
      <ProfileForm key={JSON.stringify(st.profile || {})} />
      <RecordsCard />
      <AccountCard onSignedOut={() => setTick(t => t + 1)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40, backgroundColor: T.chalk },
  title: { fontSize: 24, fontWeight: "700", color: T.ink, marginBottom: 2 },
  soft: { color: T.soft, fontSize: 14, marginTop: 2 },
  label: { color: T.soft, fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  card: { backgroundColor: T.paper, borderRadius: 12, borderWidth: 1, borderColor: T.line, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: T.ink, marginBottom: 2 },
  input: { borderWidth: 1, borderColor: T.line, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: T.ink, backgroundColor: T.chalk },
  row3: { flexDirection: "row", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: T.line, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10 },
  chipOn: { backgroundColor: T.blue, borderColor: T.blue },
  chipText: { color: T.ink, fontSize: 13, fontWeight: "600" },
  btn: { backgroundColor: T.blue, borderRadius: 10, padding: 14, marginTop: 16, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  linkBtn: { padding: 12, alignItems: "center", marginTop: 6 },
  linkText: { fontWeight: "600" },
  rowName: { fontSize: 15, fontWeight: "600", color: T.ink },
  recRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: T.line },
});
