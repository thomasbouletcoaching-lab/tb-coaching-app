import { View, Text, StyleSheet } from "react-native";
import { light } from "../src/theme";

// Écran provisoire : chaque onglet sera remplacé par le portage de l'écran web correspondant
export default function Placeholder({ title, note }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: light.chalk, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 22, fontWeight: "800", color: light.ink, marginBottom: 8 },
  note: { fontSize: 14, color: light.soft, textAlign: "center" },
});
