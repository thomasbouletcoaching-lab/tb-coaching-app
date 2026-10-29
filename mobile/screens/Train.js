// Entraînement : choisir un programme, voir la séance du jour avec les charges prévues.
// Porté depuis CalXsthenos (js/views/train.js). Pour l'instant : lecture de la séance, pas encore l'enregistrement.
import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { light as T } from "../src/theme";
import { useS, update, today } from "../src/state";
import { programs, program, weeksOf, phaseOf, schemeFor, buildSession, setsTxt, weekPlan, KIND_LABEL } from "../src/logic/engine";

const LVL = { beginner: "Débutant", comeback: "Reprise", intermediate: "Intermédiaire", advanced: "Avancé" };

function startProgram(p) {
  update(st => { st.plan = { programId: p.id, startedAt: today(), week: 1, idx: 0, cycle: 1 }; });
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
                {ex.sets?.length ? ex.sets.filter(s => s.type !== "W").map(s => `${s.reps}${s.kg ? " × " + s.kg + " kg" : ""}`).join(" · ") : ex.scheme}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.soft}>Pas de séance calculable pour l'instant.</Text>
      )}

      <Pressable onPress={() => setShowAll(v => !v)} style={styles.btn}>
        <Text style={styles.btnText}>{showAll ? "Masquer le cycle" : "Voir le cycle complet"}</Text>
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
  btn: { backgroundColor: T.blue, borderRadius: 10, padding: 14, marginTop: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  linkBtn: { padding: 14, alignItems: "center", marginTop: 10 },
  linkText: { color: T.blue, fontWeight: "600" },
});
