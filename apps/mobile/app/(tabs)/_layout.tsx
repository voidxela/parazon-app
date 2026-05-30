import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface TabConfig {
  name: string;
  title: string;
  icon: IoniconName;
  iconFocused: IoniconName;
}

const TABS: TabConfig[] = [
  { name: "index",   title: "Dashboard", icon: "grid-outline",    iconFocused: "grid"    },
  { name: "arsenal", title: "Arsenal",   icon: "shield-outline",  iconFocused: "shield"  },
  { name: "market",  title: "Market",    icon: "bar-chart-outline",iconFocused: "bar-chart"},
  { name: "oracle",  title: "Oracle",    icon: "sparkles-outline", iconFocused: "sparkles"},
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background.primary },
        headerTintColor: Colors.accent.gold,
        headerTitleStyle: { fontWeight: "700", letterSpacing: 2 },
        tabBarStyle: { backgroundColor: Colors.background.surface, borderTopColor: Colors.border.subtle },
        tabBarActiveTintColor: Colors.accent.gold,
        tabBarInactiveTintColor: Colors.text.muted,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? tab.iconFocused : tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
