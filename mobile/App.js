import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { light } from "./src/theme";
import Placeholder from "./screens/Placeholder";
import Train from "./screens/Train";
import Nutrition from "./screens/Nutrition";
import Recovery from "./screens/Recovery";
import { loadState } from "./src/state";

const Tab = createBottomTabNavigator();

// Mêmes six onglets que l'app CalXsthenos, avec les couleurs de TB my Coach
const TABS = [
  ["Accueil", "Accueil"],
  ["Entraînement", "Entraînement"],
  ["Nutrition", "Nutrition"],
  ["Récupération", "Récupération"],
  ["Coaching", "Coaching"],
  ["Profil", "Profil"],
];

// Écrans déjà portés : les autres onglets restent en attente
const SCREENS = { "Entraînement": () => <Train />, "Nutrition": () => <Nutrition />, "Récupération": () => <Recovery /> };

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: light.chalk, card: light.paper, text: light.ink, primary: light.blue, border: light.line },
};

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { loadState().then(() => setReady(true)); }, []);
  if (!ready) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: light.chalk }}><ActivityIndicator color={light.blue} /></View>;
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="dark" />
      <Tab.Navigator screenOptions={{ headerStyle: { backgroundColor: light.paper }, headerTintColor: light.ink, tabBarActiveTintColor: light.blue, tabBarInactiveTintColor: light.steel }}>
        {TABS.map(([name, label]) => (
          <Tab.Screen key={name} name={name} options={{ tabBarLabel: label }}>
            {SCREENS[name] || (() => <Placeholder title={label} note="Écran en cours de portage depuis CalXsthenos." />)}
          </Tab.Screen>
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}
