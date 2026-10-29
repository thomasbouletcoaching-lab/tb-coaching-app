// Récupération : conseil pour la séance du jour, sommeil, ressenti, réserves de glycogène (estimation).
// Porté depuis CalXsthenos (js/views/recup.js). Pas encore : jeûne, habitudes insuline, graphique sur 14 jours.
import { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from "react-native";
import { light as T } from "../src/theme";
import { useS, today } from "../src/state";
import { FEEL, D, addDays, setSleep, setFeel, glycogen, readiness } from "../src/logic/recovery";

const QUALITY = ["1 · très mauvaise", "2 · mauvaise", "3 · correcte", "4 · bonne", "5 · excellente"];

function DayPicker({ day, setDay }) {
  const t = today();
  return (
    <View style={styles.dayRow}>
      <Pressable onPress={() => setDay(addDays(day, -1))} style={styles.navBtn}><Text style={styles.navText}>‹</Text></Pressable>
      <Text style={styles.dayLabel}>{day === t ? "Aujourd'hui" : day}</Text>
      <Pressable onPress={() => setDay(addDays(day, 1))} disabled={day >= t} style={[styles.navBtn, day >= t && { opacity: 0.3 }]}>
        <Text style={styles.navText}>›</Text>
      </Pressable>
    </View>
  );
}

function ReadinessCard({ day }) {
  const r = readiness(day);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Pour ta séance</Text>
      <Text style={styles.big}>{r.icon} {r.text}</Text>
      {r.tips.map((t, i) => <Text key={i} style={styles.tip}>• {t}</Text>)}
    </View>
  );
}

function SleepCard({ day }) {
  const x = D(day);
  const [h, setH] = useState(x.sleep != null ? String(x.sleep).replace(".", ",") : "");
  const [q, setQ] = useState(x.sleepQ || null);
  const [bed, setBed] = useState(x.bed || "");
  const [wake, setWake] = useState(x.wake || "");
  const [msg, setMsg] = useState("");

  function save() {
    let hours = parseFloat(String(h).replace(",", "."));
    if (!(hours > 0) && bed && wake) {
      const [a, b] = bed.split(":").map(Number), [c, e] = wake.split(":").map(Number);
      if ([a, b, c, e].every(Number.isFinite)) {
        hours = ((c * 60 + e) - (a * 60 + b) + 1440) % 1440 / 60;
        hours = Math.round(hours * 4) / 4;
      }
    }
    if (!(hours > 0 && hours < 16)) { setMsg("Indique tes heures de sommeil, ou ton coucher et ton lever."); return; }
    setSleep(day, { h: hours, q, bed, wake });
    setMsg("Nuit enregistrée.");
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Sommeil</Text>
      <Text style={styles.label}>Heures dormies</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={h} onChangeText={setH} placeholder="ex. 7,5" placeholderTextColor={T.steel} />
      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Coucher</Text>
          <TextInput style={styles.input} value={bed} onChangeText={setBed} placeholder="23:30" placeholderTextColor={T.steel} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Lever</Text>
          <TextInput style={styles.input} value={wake} onChangeText={setWake} placeholder="07:00" placeholderTextColor={T.steel} />
        </View>
      </View>
      <Text style={styles.label}>Qualité</Text>
      <View style={styles.chips}>
        {QUALITY.map((l, i) => (
          <Pressable key={i} onPress={() => setQ(i + 1)} style={[styles.chip, q === i + 1 && styles.chipOn]}>
            <Text style={[styles.chipText, q === i + 1 && { color: "#fff" }]}>{i + 1}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={save} style={styles.btn}><Text style={styles.btnText}>Enregistrer ma nuit</Text></Pressable>
      {!!msg && <Text style={styles.soft}>{msg}</Text>}
    </View>
  );
}

function FeelCard({ day }) {
  const f = D(day).feel || {};
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Ressenti</Text>
      {FEEL.map(([k, label, lo, hi]) => {
        const v = f[k] ?? 5;
        return (
          <View key={k} style={styles.feelRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{label}</Text>
              <Text style={styles.soft}>{lo} → {hi}</Text>
            </View>
            <Pressable onPress={() => setFeel(day, k, Math.max(1, v - 1))} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable>
            <Text style={styles.stepVal}>{v}</Text>
            <Pressable onPress={() => setFeel(day, k, Math.min(10, v + 1))} style={styles.step}><Text style={styles.stepText}>+</Text></Pressable>
          </View>
        );
      })}
    </View>
  );
}

function GlycogenCard({ day }) {
  const g = glycogen(day);
  const note = !g.known
    ? "Note tes repas dans Nutrition : l'estimation apparaît dès le premier repas."
    : g.lvl === "pleines" ? "Assez de carburant pour une séance longue et lourde."
    : g.lvl === "correctes" ? "Suffisant pour une séance normale."
    : "Réserves basses : pense aux glucides avant la séance.";
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Réserves de glycogène <Text style={styles.soft}>(estimation)</Text></Text>
      <Text style={styles.big}>{g.pct} % · {g.lvl}</Text>
      <View style={styles.track}><View style={[styles.fill, { width: g.pct + "%" }]} /></View>
      <Text style={styles.soft}>{g.carbs24} g de glucides sur 24 h / {g.need} g repère</Text>
      <Text style={styles.tip}>{note}</Text>
      <Text style={styles.soft}>Calcul indicatif : glucides des dernières 24 h comparés à 3 g/kg, moins le jeûne au-delà de 12 h et la séance de la veille.</Text>
    </View>
  );
}

export default function Recovery() {
  useS();
  const [day, setDay] = useState(today());
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Récupération</Text>
      <Text style={styles.soft}>Sommeil, ressenti et énergie. Repères indicatifs, pas un avis médical.</Text>
      <DayPicker day={day} setDay={setDay} />
      <ReadinessCard day={day} />
      <SleepCard key={"s" + day} day={day} />
      <FeelCard day={day} />
      <GlycogenCard day={day} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40, backgroundColor: T.chalk },
  title: { fontSize: 24, fontWeight: "700", color: T.ink, marginBottom: 4 },
  soft: { color: T.soft, fontSize: 14, marginTop: 2 },
  label: { color: T.soft, fontSize: 13, fontWeight: "600", marginTop: 10, marginBottom: 4 },
  card: { backgroundColor: T.paper, borderRadius: 12, borderWidth: 1, borderColor: T.line, padding: 14, marginTop: 10 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: T.ink, marginBottom: 6 },
  big: { fontSize: 20, fontWeight: "700", color: T.ink, marginBottom: 4 },
  tip: { color: T.ink, fontSize: 14, marginTop: 6 },
  rowName: { fontSize: 15, fontWeight: "600", color: T.ink },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  dayLabel: { fontSize: 16, fontWeight: "700", color: T.ink },
  navBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: T.line, alignItems: "center", justifyContent: "center", backgroundColor: T.paper },
  navText: { fontSize: 22, color: T.ink },
  input: { borderWidth: 1, borderColor: T.line, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: T.ink, backgroundColor: T.chalk },
  row2: { flexDirection: "row", gap: 10 },
  chips: { flexDirection: "row", gap: 8, marginTop: 4 },
  chip: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: T.line, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: T.blue, borderColor: T.blue },
  chipText: { color: T.ink, fontWeight: "700" },
  btn: { backgroundColor: T.blue, borderRadius: 10, padding: 14, marginTop: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  feelRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: T.line },
  step: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: T.line, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 20, color: T.ink },
  stepVal: { width: 28, textAlign: "center", fontSize: 16, fontWeight: "700", color: T.ink },
  track: { height: 8, borderRadius: 4, backgroundColor: T.line, marginTop: 6, marginBottom: 6, overflow: "hidden" },
  fill: { height: 8, backgroundColor: T.blue },
});
