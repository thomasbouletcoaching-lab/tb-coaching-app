// Accueil : séance du jour, calories du jour, routine en 30 secondes (poids, pas, sommeil, eau).
// Porté depuis CalXsthenos (js/views/home.js). Pas encore : messages de Thomas, série, quêtes, rituel du matin.
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { light as T } from "../src/theme";
import { useS, update, today, S } from "../src/state";
import { nextSession } from "../src/logic/engine";
import { dayTarget, dayTotals, dayLog } from "../src/logic/nutrition";
import { burnedNow } from "../src/logic/energy";

const WATER_GOAL = 8; // verres de 25 cl

function setDaily(d, field, value) {
  update(st => {
    st.daily = st.daily || {};
    const x = st.daily[d] = st.daily[d] || {};
    x[field] = value;
  });
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

function TrainingCard() {
  const ns = nextSession();
  const cur = S().current;
  if (!S().plan) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Entraînement</Text>
        <Text style={styles.cardTitle}>Aucun programme choisi</Text>
        <Text style={styles.soft}>Choisis ton programme dans l'onglet Entraînement.</Text>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Entraînement · semaine {ns?.week} / {ns?.weeks}{ns?.phase ? " · " + ns.phase : ""}</Text>
      <Text style={styles.cardTitle}>{cur ? cur.title : ns?.title || "Séance"}</Text>
      <Text style={styles.soft}>{cur ? "Séance en cours : reprends-la dans l'onglet Entraînement." : "Ta prochaine séance est dans l'onglet Entraînement."}</Text>
    </View>
  );
}

function CaloriesCard() {
  const d = today();
  const t = dayTarget(d);
  const tot = dayTotals(d);
  const b = burnedNow(d);
  if (!t) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Calories</Text>
        <Text style={styles.soft}>Renseigne ton profil pour voir tes objectifs.</Text>
      </View>
    );
  }
  const left = Math.round(t.kcal - tot.kcal);
  const pct = t.kcal > 0 ? Math.min(100, Math.round((tot.kcal / t.kcal) * 100)) : 0;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Calories</Text>
      <Text style={styles.big}>{Math.round(tot.kcal)} <Text style={styles.soft}>/ {t.kcal} kcal</Text></Text>
      <View style={styles.track}><View style={[styles.fill, { width: pct + "%" }]} /></View>
      <View style={styles.row2}>
        <Text style={styles.soft}>{left >= 0 ? `Reste ${left} kcal` : `Dépassé de ${-left} kcal`}</Text>
        <Text style={styles.soft}>🔥 {Math.round(b.now)} kcal brûlées</Text>
      </View>
      <Text style={styles.soft}>{dayLog(d).length} aliment{dayLog(d).length > 1 ? "s" : ""} noté{dayLog(d).length > 1 ? "s" : ""}</Text>
    </View>
  );
}

function RoutineCard() {
  const d = today();
  const x = S().daily?.[d] || {};
  const foodN = dayLog(d).length;
  const filled = [x.weight, x.steps, x.sleep, x.water, foodN].filter(Boolean).length;
  const water = x.water || 0;

  return (
    <View style={styles.card}>
      <View style={styles.row2}>
        <Text style={styles.cardTitle}>Ma routine du jour</Text>
        <Text style={styles.big}>{filled}/5</Text>
      </View>
      <Text style={styles.soft}>Une journée compte dans ta série dès que 3 des 5 cases sont remplies.</Text>

      <Field label="Poids (kg)" hint="le matin, à jeun" value={x.weight} onSave={v => setDaily(d, "weight", v)} decimal />
      <Field label="Pas" hint={`objectif ${S().profile?.stepsGoal || 8000}`} value={x.steps} onSave={v => setDaily(d, "steps", v)} />
      <Field label="Sommeil (h)" hint="nuit dernière" value={x.sleep} onSave={v => setDaily(d, "sleep", v)} decimal />

      <View style={styles.waterRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>Eau</Text>
          <Text style={styles.soft}>{(water * 0.25).toFixed(2).replace(".", ",")} L · objectif {(WATER_GOAL * 0.25).toFixed(1).replace(".", ",")} L</Text>
        </View>
        <Pressable onPress={() => setDaily(d, "water", Math.max(0, water - 1))} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable>
        <Text style={styles.stepVal}>{water}</Text>
        <Pressable onPress={() => setDaily(d, "water", water + 1)} style={styles.step}><Text style={styles.stepText}>+</Text></Pressable>
      </View>

      <View style={styles.waterRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>Nutrition</Text>
          <Text style={styles.soft}>{foodN ? `${foodN} aliment${foodN > 1 ? "s" : ""} noté${foodN > 1 ? "s" : ""}` : "Pas encore noté : onglet Nutrition"}</Text>
        </View>
      </View>
    </View>
  );
}

// Champ saisi : on garde le texte tapé et on n'enregistre le nombre qu'à la fin de la saisie
function Field({ label, hint, value, onSave, decimal }) {
  const shown = value != null && value !== "" ? String(value).replace(".", ",") : "";
  return (
    <View style={styles.fieldRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{label}</Text>
        <Text style={styles.soft}>{hint}</Text>
      </View>
      <TextInput
        style={styles.input}
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        defaultValue={shown}
        key={shown}
        placeholder="–"
        placeholderTextColor={T.steel}
        onEndEditing={e => {
          const n = parseFloat(String(e.nativeEvent.text).replace(",", "."));
          onSave(Number.isFinite(n) && n > 0 ? n : null);
        }}
      />
    </View>
  );
}

export default function Home() {
  useS();
  const name = S().profile?.name;
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>{greeting()}{name ? ", " + name : ""}</Text>
      <Text style={styles.soft}>{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</Text>
      <TrainingCard />
      <CaloriesCard />
      <RoutineCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40, backgroundColor: T.chalk },
  title: { fontSize: 24, fontWeight: "700", color: T.ink, marginBottom: 2 },
  soft: { color: T.soft, fontSize: 14, marginTop: 2 },
  label: { color: T.soft, fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginBottom: 4 },
  card: { backgroundColor: T.paper, borderRadius: 12, borderWidth: 1, borderColor: T.line, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: T.ink },
  big: { fontSize: 24, fontWeight: "700", color: T.ink, marginTop: 4 },
  rowName: { fontSize: 15, fontWeight: "600", color: T.ink },
  row2: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  track: { height: 8, borderRadius: 4, backgroundColor: T.line, marginTop: 8, marginBottom: 6, overflow: "hidden" },
  fill: { height: 8, backgroundColor: T.blue },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: T.line },
  input: { width: 90, borderWidth: 1, borderColor: T.line, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, fontSize: 16, color: T.ink, backgroundColor: T.chalk, textAlign: "center" },
  waterRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: T.line },
  step: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: T.line, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 20, color: T.ink },
  stepVal: { width: 28, textAlign: "center", fontSize: 16, fontWeight: "700", color: T.ink },
});
