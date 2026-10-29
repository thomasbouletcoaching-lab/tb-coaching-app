// Entraînement : choisir un programme, voir la séance du jour, l'enregistrer (charges, reps, séries validées).
// Porté depuis CalXsthenos (js/views/train.js). Pas encore : poubelle de séance, séances libres, historique.
import { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert, StyleSheet } from "react-native";
import { light as T } from "../src/theme";
import { useS, update, today, S } from "../src/state";
import { programs, program, weeksOf, phaseOf, schemeFor, buildSession, setsTxt, weekPlan, finishSession, KIND_LABEL, fmtKg } from "../src/logic/engine";

const LVL = { beginner: "Débutant", comeback: "Reprise", intermediate: "Intermédiaire", advanced: "Avancé" };
const SET_LABEL = { W: "Éch.", T: "Top", B: "Back", D: "DS", A: "AMRAP", E: "Échec", N: "" };

function startProgram(p) {
  update(st => { st.plan = { programId: p.id, startedAt: today(), week: 1, idx: 0, cycle: 1 }; });
}

function startSession() {
  update(st => { st.current = buildSession(); });
}

// Saisie d'un chiffre : on garde le texte tapé (« 82,5 » ou « 82. ») et on stocke le nombre
function setField(xi, si, field, text) {
  update(st => {
    const s = st.current.exercises[xi].sets[si];
    s[field + "Text"] = text;
    const n = parseFloat(String(text).replace(",", "."));
    s[field] = Number.isFinite(n) ? n : null;
  });
}

function toggleDone(xi, si) {
  update(st => {
    const s = st.current.exercises[xi].sets[si];
    s.done = !s.done;
    if (s.done && (s.kg == null) && s.pkg) { s.kg = s.pkg; s.kgText = fmtKg(s.pkg); }
  });
}

function finish() {
  const cur = S().current;
  if (!cur) return;
  const sets = cur.exercises.reduce((n, ex) => n + ex.sets.filter(s => s.done && s.type !== "W").length, 0);
  if (!sets && !cur.exercises.some(ex => ex.sets.some(s => s.done))) {
    Alert.alert("Aucune série validée", "Valide au moins une série avant de terminer, ou annule la séance.");
    return;
  }
  const done = finishSession(cur);
  const rec = (done.records || []).map(r => `${r.name} : ${fmtKg(r.after)} kg e1RM (avant ${fmtKg(r.before)})`);
  Alert.alert("Séance terminée", `${done.setsDone} séries · volume ${done.volume} kg${rec.length ? "\n\nRecords :\n" + rec.join("\n") : ""}`);
}

function cancel() {
  Alert.alert("Annuler cette séance ?", "Rien ne sera enregistré.", [
    { text: "Non", style: "cancel" },
    { text: "Annuler la séance", style: "destructive", onPress: () => update(st => { st.current = null; }) },
  ]);
}

function ProgramList() {
  const list = programs();
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Choisis ton programme</Text>
      <Text style={styles.soft}>Le programme se place dans ton calendrier. Tu peux en changer plus tard.</Text>
      {list.slice(0, 40).map(p => (
        <Pressable key={p.id} onPress={() => startProgram(p)} style={styles.card}>
          <Text style={styles.cardTitle}>{p.name}</Text>
          <Text style={styles.soft}>{LVL[p.lvl] || p.lvl} · {p.split} · {p.s?.length || 0} séances · {weeksOf(p)} semaines</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SetRow({ ex, s, xi, si }) {
  const kgShown = s.kgText ?? (s.kg != null ? fmtKg(s.kg) : "");
  const repsShown = s.repsText ?? (s.reps != null ? String(s.reps) : "");
  return (
    <View style={[styles.setRow, s.done && styles.setDone]}>
      <Text style={styles.setNum}>{SET_LABEL[s.type] || si + 1}</Text>
      {!ex.bw && (
        <TextInput style={styles.input} keyboardType="decimal-pad" value={kgShown} placeholder={s.pkg ? fmtKg(s.pkg) : "kg"}
          placeholderTextColor={T.steel} onChangeText={t => setField(xi, si, "kg", t)} />
      )}
      <TextInput style={styles.input} keyboardType="number-pad" value={repsShown} placeholder={String(s.lo ?? "")}
        placeholderTextColor={T.steel} onChangeText={t => setField(xi, si, "reps", t)} />
      <Pressable onPress={() => toggleDone(xi, si)} style={[styles.check, s.done && styles.checkDone]}>
        <Text style={[styles.checkText, s.done && { color: "#fff" }]}>✓</Text>
      </Pressable>
    </View>
  );
}

function WorkoutView({ cur }) {
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>{cur.title || "Séance"}</Text>
      <Text style={styles.soft}>Semaine {cur.week} · {cur.phase || ""}{cur.comeback ? " · reprise : charges réduites de 10 %" : ""}</Text>

      {cur.exercises.map((ex, xi) => (
        <View key={xi} style={styles.card}>
          <Text style={styles.cardTitle}>{ex.name}</Text>
          <Text style={styles.soft}>{KIND_LABEL[ex.kind] || ""}{ex.note ? " · " + ex.note : ""}{ex.rest ? " · repos " + ex.rest + " s" : ""}</Text>
          {ex.sets.map((s, si) => <SetRow key={si} ex={ex} s={s} xi={xi} si={si} />)}
        </View>
      ))}

      <Pressable onPress={finish} style={styles.btn}><Text style={styles.btnText}>Terminer la séance</Text></Pressable>
      <Pressable onPress={cancel} style={styles.linkBtn}><Text style={[styles.linkText, { color: T.red }]}>Annuler la séance</Text></Pressable>
    </ScrollView>
  );
}

function ExerciseRow({ row, week, p }) {
  const scheme = schemeFor(p, row, week);
  const plan = row[5] && (Array.isArray(row[5].sets) || typeof row[5].sets === "number") ? weekPlan(row[5], week, p) : null;
  const txt = plan ? setsTxt(plan.sets) : scheme;
  return (
    <View style={styles.row}>
      <Text style={styles.rowName}>{row[0]}</Text>
      <Text style={styles.soft}>{KIND_LABEL[row[1]] || ""}</Text>
      <Text style={styles.rowScheme}>{txt || scheme}</Text>
    </View>
  );
}

function PlanView({ plan }) {
  const p = program(plan.programId);
  const [showAll, setShowAll] = useState(false);
  if (!p) return <Text style={styles.soft}>Programme introuvable.</Text>;
  const next = buildSession();
  const week = plan.week || 1;
  const sessions = p.s || [];

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>{p.name}</Text>
      <Text style={styles.soft}>Semaine {week} / {weeksOf(p)} · {phaseOf(p, week)}</Text>

      <Text style={styles.section}>Séance à faire</Text>
      {next ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{next.title || sessions[plan.idx]?.[0] || `Séance ${plan.idx + 1}`}</Text>
          {(next.exercises || []).map((ex, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowName}>{ex.name}</Text>
              <Text style={styles.rowScheme}>
                {ex.sets?.length ? ex.sets.filter(s => s.type !== "W").map(s => `${s.reps}${s.kg ? " × " + fmtKg(s.kg) + " kg" : ""}`).join(" · ") : ex.scheme}
              </Text>
            </View>
          ))}
          <Pressable onPress={startSession} style={styles.btn}><Text style={styles.btnText}>Démarrer la séance</Text></Pressable>
        </View>
      ) : (
        <Text style={styles.soft}>Pas de séance calculable pour l'instant.</Text>
      )}

      <Pressable onPress={() => setShowAll(v => !v)} style={styles.linkBtn}>
        <Text style={styles.linkText}>{showAll ? "Masquer le cycle" : "Voir le cycle complet"}</Text>
      </Pressable>

      {showAll && sessions.map(([title, day, rows], i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.soft}>{day}</Text>
          {(rows || []).map((r, j) => <ExerciseRow key={j} row={r} week={week} p={p} />)}
        </View>
      ))}

      <Pressable onPress={() => update(st => { st.plan = null; })} style={styles.linkBtn}>
        <Text style={styles.linkText}>Changer de programme</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function Train() {
  const st = useS();
  if (st.current) return <WorkoutView cur={st.current} />;
  return st.plan ? <PlanView plan={st.plan} /> : <ProgramList />;
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40, backgroundColor: T.chalk },
  title: { fontSize: 24, fontWeight: "700", color: T.ink, marginBottom: 6 },
  section: { fontSize: 13, fontWeight: "700", color: T.soft, textTransform: "uppercase", marginTop: 18, marginBottom: 6 },
  soft: { color: T.soft, fontSize: 14, marginTop: 2 },
  card: { backgroundColor: T.paper, borderRadius: 12, borderWidth: 1, borderColor: T.line, padding: 14, marginTop: 10 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: T.ink, marginBottom: 6 },
  row: { paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: T.line },
  rowName: { fontSize: 15, fontWeight: "600", color: T.ink },
  rowScheme: { fontSize: 14, color: T.blue, marginTop: 2 },
  setRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: T.line, borderRadius: 8 },
  setDone: { backgroundColor: T.good },
  setNum: { width: 46, fontSize: 13, fontWeight: "700", color: T.soft },
  input: { flex: 1, borderWidth: 1, borderColor: T.line, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, fontSize: 16, color: T.ink, backgroundColor: T.paper, textAlign: "center" },
  check: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: T.line, alignItems: "center", justifyContent: "center", backgroundColor: T.paper },
  checkDone: { backgroundColor: T.green, borderColor: T.green },
  checkText: { fontSize: 18, fontWeight: "700", color: T.steel },
  btn: { backgroundColor: T.blue, borderRadius: 10, padding: 14, marginTop: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  linkBtn: { padding: 14, alignItems: "center", marginTop: 10 },
  linkText: { color: T.blue, fontWeight: "600" },
});
