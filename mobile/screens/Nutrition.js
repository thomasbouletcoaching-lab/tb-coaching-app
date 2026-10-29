// Nutrition : cibles du jour, totaux face aux cibles, journal par repas, recherche dans la base Ciqual.
// Porté depuis CalXsthenos (js/nutrition.js + js/views/food.js). Pas encore : plats, plan alimentaire, scan de code-barres, tickets.
import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from "react-native";
import { light as T } from "../src/theme";
import { useS, today } from "../src/state";
import { loadCiqual, loadModels, targets, dayTarget, searchFoods, dayLog, dayTotals, addEntry, removeEntry, entryFromFood, MEALS } from "../src/logic/nutrition";

function Bar({ label, value, goal, unit = "g" }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <View style={styles.bar}>
      <View style={styles.barHead}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barVal}>{Math.round(value)} / {goal ? Math.round(goal) : "–"} {unit}</Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: pct + "%" }]} /></View>
    </View>
  );
}

function Summary() {
  const t = targets();
  const dt = dayTarget() || t;
  const tot = dayTotals();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Aujourd'hui</Text>
      {t ? (
        <>
          <Text style={styles.big}>{tot.kcal} <Text style={styles.soft}>/ {dt?.kcal ?? "–"} kcal</Text></Text>
          <Bar label="Protéines" value={tot.p} goal={dt?.prot} />
          <Bar label="Glucides" value={tot.c} goal={dt?.carbs} />
          <Bar label="Lipides" value={tot.f} goal={dt?.fat} />
        </>
      ) : (
        <Text style={styles.soft}>Renseigne ton profil (poids, taille, âge) pour calculer tes cibles.</Text>
      )}
    </View>
  );
}

function Journal() {
  return (
    <>
      {MEALS.map(meal => {
        const items = dayLog().filter(e => e.meal === meal);
        if (!items.length) return null;
        return (
          <View key={meal} style={styles.card}>
            <Text style={styles.cardTitle}>{meal}</Text>
            {items.map(e => (
              <View key={e.id} style={styles.entry}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName}>{e.label}</Text>
                  <Text style={styles.soft}>{e.g ? e.g + " g · " : ""}{e.kcal} kcal · P {e.p} · G {e.c} · L {e.f}</Text>
                </View>
                <Pressable onPress={() => removeEntry(e.id)} hitSlop={10}><Text style={styles.remove}>✕</Text></Pressable>
              </View>
            ))}
          </View>
        );
      })}
    </>
  );
}

function AddFood() {
  const [meal, setMeal] = useState(MEALS[1]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [grams, setGrams] = useState("100");
  const results = q.trim() ? searchFoods(q, 12) : [];

  function add() {
    const g = parseFloat(String(grams).replace(",", "."));
    if (!sel || !Number.isFinite(g) || g <= 0) return;
    addEntry(entryFromFood(sel, g, meal), today());
    setSel(null); setQ(""); setGrams("100");
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Ajouter un aliment</Text>
      <View style={styles.chips}>
        {MEALS.map(m => (
          <Pressable key={m} onPress={() => setMeal(m)} style={[styles.chip, meal === m && styles.chipOn]}>
            <Text style={[styles.chipText, meal === m && { color: "#fff" }]}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={styles.input} value={q} onChangeText={t => { setQ(t); setSel(null); }} placeholder="Chercher (ex. riz cuit, poulet)" placeholderTextColor={T.steel} />

      {sel ? (
        <View style={styles.selBox}>
          <Text style={styles.entryName}>{sel.n}</Text>
          <Text style={styles.soft}>{sel.kcal} kcal pour 100 g · P {sel.p} · G {sel.c} · L {sel.f}</Text>
          <View style={styles.gramRow}>
            <TextInput style={[styles.input, { flex: 1 }]} keyboardType="decimal-pad" value={grams} onChangeText={setGrams} />
            <Text style={styles.soft}>g</Text>
          </View>
          <Pressable onPress={add} style={styles.btn}><Text style={styles.btnText}>Ajouter au journal</Text></Pressable>
        </View>
      ) : (
        results.map((f, i) => (
          <Pressable key={i} onPress={() => setSel(f)} style={styles.result}>
            <Text style={styles.entryName}>{f.n}</Text>
            <Text style={styles.soft}>{f.cat} · {f.kcal} kcal / 100 g</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

export default function Nutrition() {
  useS();
  const [ready, setReady] = useState(false);
  useEffect(() => { Promise.all([loadModels(), loadCiqual()]).then(() => setReady(true)); }, []);
  if (!ready) return <View style={styles.center}><Text style={styles.soft}>Chargement de la base alimentaire…</Text></View>;
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Nutrition</Text>
      <Summary />
      <Journal />
      <AddFood />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40, backgroundColor: T.chalk },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.chalk },
  title: { fontSize: 24, fontWeight: "700", color: T.ink, marginBottom: 6 },
  soft: { color: T.soft, fontSize: 14 },
  card: { backgroundColor: T.paper, borderRadius: 12, borderWidth: 1, borderColor: T.line, padding: 14, marginTop: 10 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: T.ink, marginBottom: 6 },
  big: { fontSize: 28, fontWeight: "700", color: T.ink, marginBottom: 8 },
  bar: { marginTop: 8 },
  barHead: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { color: T.ink, fontWeight: "600" },
  barVal: { color: T.soft, fontSize: 13 },
  track: { height: 8, borderRadius: 4, backgroundColor: T.line, marginTop: 4, overflow: "hidden" },
  fill: { height: 8, backgroundColor: T.blue },
  entry: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: T.line },
  entryName: { fontSize: 15, fontWeight: "600", color: T.ink },
  remove: { fontSize: 18, color: T.red, paddingHorizontal: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: T.line, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10 },
  chipOn: { backgroundColor: T.blue, borderColor: T.blue },
  chipText: { color: T.ink, fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: T.line, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: T.ink, backgroundColor: T.paper },
  result: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: T.line },
  selBox: { marginTop: 10, gap: 6 },
  gramRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  btn: { backgroundColor: T.blue, borderRadius: 10, padding: 14, marginTop: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
